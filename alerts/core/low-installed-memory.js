/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const values = require('../lib/value');

function configuredMinimum(settings, platform) {
    const configured = settings && settings.lowinstalledmemory;
    if ((configured == null) || (typeof configured !== 'object')) return 0;
    var minimum = configured.minimumgigabytes;
    const platformKey = 'minimum' + platform + 'gigabytes';
    if (configured[platformKey] != null) minimum = configured[platformKey];
    return ((typeof minimum === 'number') && Number.isFinite(minimum) && (minimum > 0)) ? minimum : 0;
}

function memoryInventory(data) {
    const hardware = data && data.hardware;
    if ((hardware == null) || (typeof hardware !== 'object')) return null;
    if (hardware.windows && Array.isArray(hardware.windows.memory)) return { platform: 'windows', items: hardware.windows.memory, property: 'Capacity' };
    if (hardware.linux && hardware.linux.memory && Array.isArray(hardware.linux.memory.Memory_Device)) return { platform: 'linux', items: hardware.linux.memory.Memory_Device, property: 'Size' };
    if (hardware.darwin && Array.isArray(hardware.darwin.memory)) return { platform: 'darwin', items: hardware.darwin.memory, property: 'Size' };
    return null;
}

module.exports = {
    definition: { id: 'device.health.lowInstalledMemory', title: 'Low installed memory', group: 'Device health', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'sysinfo',
    evaluate: function (context) {
        const inventory = memoryInventory(context.data);
        if (inventory == null) return [];
        const minimumGigabytes = configuredMinimum(context.settings, inventory.platform);
        if (minimumGigabytes <= 0) return [];
        var totalBytes = 0, valid = 0;
        for (var i = 0; i < inventory.items.length; i++) {
            const item = inventory.items[i];
            if ((item == null) || (typeof item !== 'object')) continue;
            const bytes = values.parseBytes(item[inventory.property]);
            if ((bytes == null) || (bytes <= 0)) continue;
            totalBytes += bytes;
            valid++;
        }
        if ((valid === 0) || !Number.isFinite(totalBytes)) return [];
        const installedGigabytes = totalBytes / Math.pow(1024, 3);
        return [{ state: (installedGigabytes < minimumGigabytes) ? 'active' : 'healthy', detail: 'Device has ' + installedGigabytes.toFixed(1) + ' GB of memory; minimum is ' + minimumGigabytes + ' GB' }];
    },
    _test: { configuredMinimum: configuredMinimum, memoryInventory: memoryInventory }
};
