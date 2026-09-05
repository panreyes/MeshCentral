/**
* @description Stable hardware identity normalization for built-in alerts
* @license Apache-2.0
*/

/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const placeholders = /^(|none|unknown|not specified|not available|system serial number|to be filled by o\.e\.m\.|default string|0+|f+)$/i;

function normalize(value) {
    if (typeof value !== 'string') return null;
    value = value.trim().toLowerCase();
    return ((value.length === 0) || placeholders.test(value)) ? null : value;
}

function identities(sysinfo) {
    const identifiers = sysinfo && sysinfo.hardware && sysinfo.hardware.identifiers;
    if ((identifiers == null) || (typeof identifiers !== 'object')) return [];
    const result = [];
    [['uuid', identifiers.product_uuid], ['board', identifiers.board_serial], ['chassis', identifiers.chassis_serial]].forEach(function (item) {
        const value = normalize(item[1]);
        if (value != null) result.push(item[0] + ':' + value);
    });
    return result;
}

module.exports = { normalize: normalize, identities: identities, placeholders: placeholders };
