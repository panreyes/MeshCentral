/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

function normalize(value) { return (typeof value === 'string') ? value.trim().toLowerCase().split('%')[0] : null; }

module.exports = {
    definition: { id: 'device.network.dnsCompliance', title: 'DNS server compliance', group: 'Device network', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'sysinfo',
    evaluate: function (context) {
        const configured = context.settings && context.settings.dnscompliance, allowedValues = configured && configured.allowedservers;
        if (!Array.isArray(allowedValues) || (allowedValues.length === 0)) return context.isActive('') ? [{ state: 'healthy', detail: 'DNS compliance policy is disabled' }] : [];
        const reportedValues = context.data && context.data.hardware && context.data.hardware.network && context.data.hardware.network.dns;
        if (!Array.isArray(reportedValues) || (reportedValues.length === 0)) return [];
        const allowed = allowedValues.map(normalize).filter(function (x) { return x != null; }), reported = reportedValues.map(normalize).filter(function (x) { return x != null; });
        if ((allowed.length === 0) || (reported.length === 0)) return [];
        const unexpected = reported.filter(function (x) { return allowed.indexOf(x) < 0; });
        return [{ state: (unexpected.length > 0) ? 'active' : 'healthy', detail: (unexpected.length > 0) ? ('Unexpected DNS servers: ' + unexpected.join(', ')) : 'All reported DNS servers are allowed', variables: { unexpected: unexpected, reported: reported } }];
    },
    _test: { normalize: normalize }
};
module.exports.settings = { key: 'dnscompliance', fields: [["allowedservers","strings",[],null,null,null,128]] };
