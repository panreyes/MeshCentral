/*jshint node: true */
/*jshint esversion: 6 */
'use strict';
module.exports = {
    definition: { id: 'device.security.insecureProtocolEnabled', title: 'Insecure protocol enabled', group: 'Device security', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 }, source: 'telemetry',
    evaluate: function (context) {
        const required = context.settings && context.settings.insecureprotocolenabled && context.settings.insecureprotocolenabled.check, protocols = context.data && context.data.localSecurity && context.data.localSecurity.protocols;
        if (!Array.isArray(required) || !protocols || (required.length === 0)) return context.isActive('') && Array.isArray(required) && (required.length === 0) ? [{ state: 'healthy', detail: 'Insecure protocol policy is disabled' }] : [];
        const enabled = required.filter(function (name) { return protocols[name] === true; });
        return [{ state: enabled.length ? 'active' : 'healthy', detail: enabled.length ? ('Enabled insecure protocols: ' + enabled.join(', ')) : 'No configured insecure protocols are enabled', variables: { enabled: enabled } }];
    }
};
