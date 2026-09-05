/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const values = require('../lib/value');
const MAX_DETAIL_LENGTH = 2048;

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

function compactJson(value, maximum) {
    var text;
    try { text = JSON.stringify(value); } catch (ex) { text = 'unavailable'; }
    if (typeof text !== 'string') text = 'null';
    if (text.length <= maximum) return text;
    return text.substring(0, Math.max(0, maximum - 1)) + '\u2026';
}

function changeDetail(previous, current, changed) {
    const names = { gpu: 'GPU', storage: 'Storage', memory: 'Memory', tpm: 'TPM' };
    const prefix = 'Hardware inventory changed: ', separatorLength = Math.max(0, changed.length - 1) * 2;
    var fixedLength = prefix.length + separatorLength;
    for (var i = 0; i < changed.length; i++) fixedLength += names[changed[i]].length + ' [Previous: ; New: ]'.length;
    const valueLength = Math.max(32, Math.floor((MAX_DETAIL_LENGTH - fixedLength) / (changed.length * 2)));
    const details = [];
    for (var j = 0; j < changed.length; j++) {
        const key = changed[j];
        details.push(names[key] + ' [Previous: ' + compactJson(previous[key], valueLength) + '; New: ' + compactJson(current[key], valueLength) + ']');
    }
    const detail = prefix + details.join('; ');
    return (detail.length <= MAX_DETAIL_LENGTH) ? detail : (detail.substring(0, MAX_DETAIL_LENGTH - 1) + '\u2026');
}

module.exports = {
    definition: { id: 'device.inventory.hardwareChanged', title: 'Hardware inventory changed', group: 'Device inventory', kind: 'event', channels: ['web', 'email', 'messaging'], severity: 'info', requiredRight: 0x00100000 },
    translations: {"es":{"title":"Inventario de hardware modificado","group":"Inventario del dispositivo","settings":{"enabled":"Activado"},"detail":[["Hardware inventory changed: ","Inventario de hardware modificado: "],["Storage [","Almacenamiento ["],["Memory [","Memoria ["],["Previous: ","Anterior: "],["New: ","Nuevo: "]]}},
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
        return [{ detail: changeDetail(previous, current, changed) }];
    },
    _test: { selectedInventory: selectedInventory, stableArray: stableArray, changeDetail: changeDetail }
};
module.exports.settings = { key: 'hardwarechanged', fields: [["enabled","boolean",true]] };
