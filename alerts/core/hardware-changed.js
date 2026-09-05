/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const values = require('../lib/value');

function selectedInventory(sysinfo) {
    const hardware = sysinfo && sysinfo.hardware;
    if ((hardware == null) || (typeof hardware !== 'object')) return null;
    const identifiers = hardware.identifiers || {}, result = {};
    const system = {};
    for (var systemKey of ['product_uuid', 'board_name', 'board_vendor', 'board_version', 'board_serial']) {
        if ((typeof identifiers[systemKey] === 'string') && (identifiers[systemKey].length > 0)) system[systemKey] = identifiers[systemKey];
    }
    result.system = (Object.keys(system).length > 0) ? system : null;
    result.gpu = Array.isArray(identifiers.gpu_name) ? stableArray(identifiers.gpu_name.filter(function (x) { return typeof x === 'string'; })) : null;
    result.storage = Array.isArray(identifiers.storage_devices) ? stableArray(identifiers.storage_devices.filter(function (x) { return (x != null) && (typeof x === 'object'); }).map(function (x) { return { Caption: x.Caption, Model: x.Model, SerialNumber: x.SerialNumber, Size: x.Size }; })) : null;
    result.tpm = ((hardware.tpm != null) && (typeof hardware.tpm === 'object')) ? hardware.tpm : null;
    if (hardware.windows && Array.isArray(hardware.windows.memory)) result.memory = stableArray(hardware.windows.memory.filter(function (x) { return (x != null) && (typeof x === 'object'); }).map(function (x) { return { BankLabel: x.BankLabel, Capacity: x.Capacity, Speed: x.Speed, PartNumber: x.PartNumber, SerialNumber: x.SerialNumber }; }));
    else if (hardware.linux && hardware.linux.memory && Array.isArray(hardware.linux.memory.Memory_Device)) result.memory = stableArray(hardware.linux.memory.Memory_Device.filter(function (x) { return (x != null) && (typeof x === 'object'); }).map(function (x) { return { Locator: x.Locator, Size: x.Size, Speed: x.Speed, Part_Number: x.Part_Number, Serial_Number: x.Serial_Number }; }));
    else if (hardware.darwin && Array.isArray(hardware.darwin.memory)) result.memory = stableArray(hardware.darwin.memory.filter(function (x) { return (x != null) && (typeof x === 'object'); }));
    else result.memory = null;
    return values.sortedObject(result);
}

function stableArray(items) {
    return items.map(values.sortedObject).sort(function (a, b) { return JSON.stringify(a).localeCompare(JSON.stringify(b)); });
}

module.exports = {
    definition: { id: 'device.inventory.hardwareChanged', title: 'Hardware inventory changed', group: 'Device inventory', kind: 'event', channels: ['web', 'email', 'messaging'], severity: 'info', requiredRight: 0x00100000 },
    source: 'sysinfo',
    evaluate: function (context) {
        const configured = context.settings && context.settings.hardwarechanged;
        if ((configured != null) && (configured.enabled === false)) return [];
        const previous = selectedInventory(context.previousData), current = selectedInventory(context.data);
        if ((previous == null) || (current == null)) return [];
        const changed = [];
        // Stable identity fields have their own higher-severity event.
        for (var key of ['gpu', 'storage', 'memory', 'tpm']) {
            if ((previous[key] == null) || (current[key] == null)) continue;
            if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) changed.push(key);
        }
        if (changed.length === 0) return [];
        return [{ detail: 'Hardware inventory changed: ' + changed.join(', '), variables: { changed: changed } }];
    },
    _test: { selectedInventory: selectedInventory, stableArray: stableArray }
};
module.exports.settings = { key: 'hardwarechanged', fields: [["enabled","boolean",true]] };
