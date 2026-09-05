/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const hardwareIdentity = require('../lib/hardware-identity');

module.exports = {
    definition: { id: 'device.inventory.duplicateHardwareIdentity', title: 'Duplicate hardware identity', group: 'Device inventory', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'sysinfo', periodic: true, periodicAll: true,
    evaluate: function (context) {
        const configured = context.settings && context.settings.duplicatehardwareidentity;
        if (configured && (configured.enabled === false)) return context.isActive('') ? [{ state: 'healthy', detail: 'Duplicate hardware identity monitoring is disabled' }] : [];
        const identities = hardwareIdentity.identities(context.data);
        if (identities.length === 0) return [];
        const duplicates = context.findDuplicateHardwareIdentities(identities);
        if (duplicates.length === 0) return [{ state: 'healthy', detail: 'No duplicate hardware identity detected' }];
        const types = duplicates.map(function (x) { return x.identity; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
        return [{ state: 'active', detail: 'Duplicate ' + types.join(', ') + ' also reported by another device', variables: { identityTypes: types, duplicateCount: duplicates.length } }];
    }
};
module.exports.settings = { key: 'duplicatehardwareidentity', fields: [["enabled","boolean",true]] };
