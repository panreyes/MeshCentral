/**
* @description Shared Windows and Linux Security Center alert evaluation
* @license Apache-2.0
*/

/*jshint node: true */
'use strict';

module.exports.evaluate = function (primary, secondary, key) {
    const values = [];
    if ((primary != null) && (typeof primary === 'object') && (primary[key] != null)) values.push({ source: 'wsc', value: primary[key] });
    if ((secondary != null) && (typeof secondary === 'object') && (secondary[key] != null)) values.push({ source: 'lsc', value: secondary[key] });
    var healthy = false;
    for (var i = 0; i < values.length; i++) {
        const item = values[i];
        const active = ((item.source === 'wsc') && ((item.value === 'WARNING') || (item.value === 'PROBLEM'))) || ((item.source === 'lsc') && (item.value === 'BAD'));
        if (active) return { state: 'active', detail: item.value };
        if (item.value === 'OK') { healthy = true; } else { return { state: 'unknown' }; }
    }
    return healthy ? { state: 'healthy', detail: 'OK' } : { state: 'unknown' };
};
