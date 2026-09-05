/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const values = require('../lib/value');
const storage = require('../lib/storage');

function installedMemory(hardware) {
    var items, property;
    if (hardware.windows && Array.isArray(hardware.windows.memory)) { items = hardware.windows.memory; property = 'Capacity'; }
    else if (hardware.linux && hardware.linux.memory && Array.isArray(hardware.linux.memory.Memory_Device)) { items = hardware.linux.memory.Memory_Device; property = 'Size'; }
    else if (hardware.darwin && Array.isArray(hardware.darwin.memory)) { items = hardware.darwin.memory; property = 'Size'; }
    else return null;
    var total = 0, count = 0;
    items.forEach(function (item) { const size = item && values.parseBytes(item[property]); if ((size != null) && (size > 0)) { total += size; count++; } });
    return (count > 0) ? total / Math.pow(1024, 3) : null;
}

function architecture(hardware) {
    if (hardware.windows && hardware.windows.osinfo && (typeof hardware.windows.osinfo.OSArchitecture === 'string')) return hardware.windows.osinfo.OSArchitecture.toLowerCase();
    if (hardware.linux && (typeof hardware.linux.machine === 'string')) return hardware.linux.machine.toLowerCase();
    if (hardware.darwin && (typeof hardware.darwin.machine === 'string')) return hardware.darwin.machine.toLowerCase();
    return null;
}

module.exports = {
    definition: { id: 'device.compliance.hardwareRequirements', title: 'Hardware requirements', group: 'Device compliance', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'sysinfo',
    evaluate: function (context) {
        const configured = context.settings && context.settings.hardwarerequirements;
        if ((configured == null) || (typeof configured !== 'object')) return [];
        const minMemory = ((typeof configured.minimummemorygigabytes === 'number') && (configured.minimummemorygigabytes > 0)) ? configured.minimummemorygigabytes : 0;
        const minStorage = ((typeof configured.minimumstoragegigabytes === 'number') && (configured.minimumstoragegigabytes > 0)) ? configured.minimumstoragegigabytes : 0;
        const allowed = Array.isArray(configured.allowedarchitectures) ? configured.allowedarchitectures.filter(function (x) { return typeof x === 'string'; }).map(function (x) { return x.toLowerCase(); }) : [];
        if ((minMemory === 0) && (minStorage === 0) && (allowed.length === 0)) return context.isActive('') ? [{ state: 'healthy', detail: 'Hardware requirements are disabled' }] : [];
        const hardware = context.data && context.data.hardware;
        if ((hardware == null) || (typeof hardware !== 'object')) return [];
        const failures = [], observed = {};
        if (minMemory > 0) { const memory = installedMemory(hardware); if (memory != null) { observed.memoryGigabytes = Number(memory.toFixed(1)); if (memory < minMemory) failures.push('memory ' + memory.toFixed(1) + ' GB < ' + minMemory + ' GB'); } }
        if (minStorage > 0) {
            const volumes = storage.normalizeVolumes(context.data), total = volumes.reduce(function (sum, x) { return sum + x.totalBytes; }, 0) / Math.pow(1024, 3);
            if (volumes.length > 0) { observed.storageGigabytes = Number(total.toFixed(1)); if (total < minStorage) failures.push('storage ' + total.toFixed(1) + ' GB < ' + minStorage + ' GB'); }
        }
        if (allowed.length > 0) { const arch = architecture(hardware); if (arch != null) { observed.architecture = arch; if (!allowed.some(function (x) { return arch.indexOf(x) >= 0; })) failures.push('architecture ' + arch + ' is not allowed'); } }
        if (Object.keys(observed).length === 0) return [];
        return [{ state: (failures.length > 0) ? 'active' : 'healthy', detail: (failures.length > 0) ? failures.join('; ') : 'Reported hardware meets configured requirements', variables: observed }];
    },
    _test: { installedMemory: installedMemory, architecture: architecture }
};
module.exports.settings = { key: 'hardwarerequirements', fields: [["minimummemorygigabytes","number",0,0,1048576],["minimumstoragegigabytes","number",0,0,1073741824],["allowedarchitectures","strings",[],null,null,null,32]] };
