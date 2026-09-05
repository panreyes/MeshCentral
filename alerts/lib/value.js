/**
* @description Shared value normalization for built-in alerts
* @license Apache-2.0
*/

/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const crypto = require('crypto');

module.exports.finiteNumber = function (value) {
    if ((typeof value === 'string') && (value.trim().length > 0)) value = Number(value);
    return ((typeof value === 'number') && Number.isFinite(value)) ? value : null;
};

module.exports.parseBytes = function (value) {
    if ((typeof value === 'number') && Number.isFinite(value) && (value >= 0)) return value;
    if (typeof value !== 'string') return null;
    const match = value.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*([KMGTPE]?)(?:I?B)?$/i);
    if (match == null) return null;
    const amount = Number(match[1]), exponent = ['', 'K', 'M', 'G', 'T', 'P', 'E'].indexOf(match[2].toUpperCase());
    if (!Number.isFinite(amount) || (exponent < 0)) return null;
    return amount * Math.pow(1024, exponent);
};

module.exports.instanceKey = function (namespace, identity) {
    identity = String(identity);
    const key = namespace + ':' + identity;
    if (key.length <= 128) return key;
    return namespace + ':sha256:' + crypto.createHash('sha256').update(identity).digest('hex');
};

module.exports.parseDate = function (value, platform) {
    if ((platform === 'darwin') && (typeof value === 'number') && Number.isFinite(value)) return value * 1000;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    const wmi = value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\.\d+)?([+-]\d{3})?/);
    if (wmi != null) {
        var timestamp = Date.UTC(Number(wmi[1]), Number(wmi[2]) - 1, Number(wmi[3]), Number(wmi[4]), Number(wmi[5]), Number(wmi[6]));
        if (wmi[7] != null) timestamp -= Number(wmi[7]) * 60000;
        return Number.isFinite(timestamp) ? timestamp : null;
    }
    const parsedTimestamp = Date.parse(value);
    return Number.isFinite(parsedTimestamp) ? parsedTimestamp : null;
};

module.exports.compareVersions = function (left, right) {
    if ((typeof left !== 'string') || (typeof right !== 'string') || (left.length === 0) || (right.length === 0)) return null;
    const a = left.match(/\d+/g), b = right.match(/\d+/g);
    if ((a == null) || (b == null)) return null;
    const length = Math.max(a.length, b.length);
    for (var i = 0; i < length; i++) {
        const av = Number(a[i] || 0), bv = Number(b[i] || 0);
        if (av < bv) return -1;
        if (av > bv) return 1;
    }
    return 0;
};

module.exports.sortedObject = function (value) {
    if (Array.isArray(value)) return value.map(module.exports.sortedObject);
    if ((value == null) || (typeof value !== 'object')) return value;
    const result = {};
    Object.keys(value).sort().forEach(function (key) { result[key] = module.exports.sortedObject(value[key]); });
    return result;
};
