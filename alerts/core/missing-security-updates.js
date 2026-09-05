/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

module.exports = {
    definition: { id: 'device.security.missingSecurityUpdates', title: 'Missing security updates', group: 'Device security', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'telemetry',
    evaluate: function (context) {
        const configured = context.settings && context.settings.missingsecurityupdates;
        if ((configured == null) || (configured.enabled !== true)) return context.isActive('') ? [{ state: 'healthy', detail: 'Security update monitoring is disabled' }] : [];
        const updates = context.data && context.data.securityUpdates;
        if ((updates == null) || (typeof updates !== 'object') || !Number.isInteger(updates.pending) || (updates.pending < 0)) return [];
        const titles = Array.isArray(updates.titles) ? updates.titles.filter(function (x) { return typeof x === 'string'; }).slice(0, 10) : [];
        return [{ state: (updates.pending > 0) ? 'active' : 'healthy', detail: (updates.pending > 0) ? (updates.pending + ' security update(s) are pending' + (titles.length ? ': ' + titles.join(', ') : '')) : 'No pending security updates were found', variables: { pending: updates.pending, titles: titles } }];
    }
};
