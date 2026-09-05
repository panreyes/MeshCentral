/**
* @description Stable network inventory normalization for built-in alerts
* @license Apache-2.0
*/

/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

function normalizeMac(value) {
    if (typeof value !== 'string') return null;
    const compact = value.toLowerCase().replace(/[^0-9a-f]/g, '');
    if ((compact.length !== 12) || (/^0{12}$/.test(compact)) || (/^f{12}$/.test(compact))) return null;
    return compact.match(/.{2}/g).join(':');
}

function usableAddress(value) {
    if (typeof value !== 'string') return false;
    const x = value.toLowerCase().split('%')[0];
    return !((x === '127.0.0.1') || x.startsWith('127.') || (x === '::1') || x.startsWith('fe80:') || x.startsWith('169.254.'));
}

function records(netinfo) {
    const result = [];
    if ((netinfo == null) || (typeof netinfo !== 'object')) return result;
    if ((netinfo.netif2 != null) && (typeof netinfo.netif2 === 'object') && !Array.isArray(netinfo.netif2)) {
        for (var name in netinfo.netif2) {
            const layers = netinfo.netif2[name];
            if (!Array.isArray(layers)) continue;
            for (var i = 0; i < layers.length; i++) {
                const layer = layers[i];
                if ((layer == null) || (typeof layer !== 'object')) continue;
                const mac = normalizeMac(layer.mac), address = usableAddress(layer.address) ? layer.address.toLowerCase().split('%')[0] : null;
                if ((mac != null) || (address != null)) result.push({ name: name, mac: mac, address: address, family: layer.family, gateway: (typeof layer.gateway === 'string') ? layer.gateway : undefined });
            }
        }
    } else if (Array.isArray(netinfo.netif)) {
        for (var j = 0; j < netinfo.netif.length; j++) {
            const item = netinfo.netif[j];
            if ((item == null) || (typeof item !== 'object')) continue;
            const oldMac = normalizeMac(item.mac), oldAddress = usableAddress(item.v4addr) ? item.v4addr.toLowerCase() : null;
            if ((oldMac != null) || (oldAddress != null)) result.push({ name: item.name, mac: oldMac, address: oldAddress, family: 'IPv4', gateway: (typeof item.v4gateway === 'string') ? item.v4gateway : undefined });
        }
    }
    return result;
}

function snapshot(netinfo) {
    return records(netinfo).map(function (x) { return [x.name || '', x.mac || '', x.address || '', x.family || '', x.gateway || ''].join('|'); }).sort();
}

function identities(netinfo) {
    const result = [];
    records(netinfo).forEach(function (x) { if ((x.mac != null) && (result.indexOf('mac:' + x.mac) < 0)) result.push('mac:' + x.mac); });
    return result.sort();
}

module.exports = { normalizeMac: normalizeMac, usableAddress: usableAddress, records: records, snapshot: snapshot, identities: identities };
