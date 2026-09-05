/*jshint node: true */
/*jshint esversion: 6 */
'use strict';
module.exports = {
    definition: { id: 'device.security.unexpectedLocalAdministrator', title: 'Unexpected local administrator', group: 'Device security', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 }, source: 'telemetry',
    evaluate: function (context) {
        const allowed = context.settings && context.settings.unexpectedlocaladministrator && context.settings.unexpectedlocaladministrator.allowed, reported = context.data && context.data.localSecurity && context.data.localSecurity.administrators;
        if (!Array.isArray(allowed) || !Array.isArray(reported) || (allowed.length === 0)) return context.isActive('') && Array.isArray(allowed) && (allowed.length === 0) ? [{ state: 'healthy', detail: 'Local administrator policy is disabled' }] : [];
        const normalized = allowed.map(function (x) { return String(x).toLowerCase(); }), unexpected = reported.filter(function (x) { return (typeof x === 'string') && (normalized.indexOf(x.toLowerCase()) < 0); });
        return [{ state: unexpected.length ? 'active' : 'healthy', detail: unexpected.length ? ('Unexpected local administrators: ' + unexpected.join(', ')) : 'All local administrators are allowed', variables: { unexpected: unexpected } }];
    }
};
