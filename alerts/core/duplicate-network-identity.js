/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const network = require('../lib/network');

module.exports = {
    definition: { id: 'device.network.duplicateIdentity', title: 'Duplicate network identity', group: 'Device network', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'netinfo', periodic: true,
    evaluate: function (context) {
        const configured = context.settings && context.settings.duplicatenetworkidentity;
        if (configured && (configured.enabled === false)) return context.isActive('') ? [{ state: 'healthy', detail: 'Duplicate network identity monitoring is disabled' }] : [];
        const identities = network.identities(context.data);
        if (identities.length === 0) return [];
        const duplicates = context.findDuplicateNetworkIdentities(identities);
        if (duplicates.length === 0) return [{ state: 'healthy', detail: 'No duplicate MAC address detected' }];
        return [{ state: 'active', detail: 'MAC address also reported by another device', variables: { identities: duplicates.map(function (x) { return x.identity; }), duplicateCount: duplicates.length } }];
    }
};
module.exports.settings = { key: 'duplicatenetworkidentity', fields: [["enabled","boolean",true]] };
