/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

module.exports = {
    definition: { id: 'device.security.domainTrustFailure', title: 'Domain trust failure', group: 'Device security', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'telemetry',
    evaluate: function (context) {
        const configured = context.settings && context.settings.domaintrustfailure;
        if ((configured == null) || (configured.enabled !== true)) return context.isActive('') ? [{ state: 'healthy', detail: 'Domain trust verification is disabled' }] : [];
        const trust = context.data && context.data.domainTrust;
        if ((trust == null) || (typeof trust !== 'object') || (typeof trust.healthy !== 'boolean')) return [];
        const domain = (typeof trust.domain === 'string') ? trust.domain : 'the configured domain';
        return [{ state: trust.healthy ? 'healthy' : 'active', detail: trust.healthy ? ('Secure channel to ' + domain + ' is healthy') : ('Secure channel to ' + domain + ' failed'), variables: { domain: domain, healthy: trust.healthy } }];
    }
};
module.exports.settings = { key: 'domaintrustfailure', fields: [["enabled","boolean",false]] };
