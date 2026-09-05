/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

function policy(settings) {
    const x = settings && settings.softwarepolicy;
    function clean(list) { return Array.isArray(list) ? list.filter(function (v) { return (typeof v === 'string') && (v.length > 0); }).slice(0, 64) : []; }
    return { required: clean(x && x.required), prohibited: clean(x && x.prohibited) };
}

module.exports = {
    definition: { id: 'device.compliance.softwarePolicy', title: 'Software policy', group: 'Device compliance', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'telemetry',
    evaluate: function (context) {
        const configured = policy(context.settings), software = context.data && context.data.software;
        if ((configured.required.length === 0) && (configured.prohibited.length === 0)) return context.isActive('') ? [{ state: 'healthy', detail: 'Software policy is disabled' }] : [];
        if ((software == null) || !Array.isArray(software.installed)) return [];
        const installed = software.installed.filter(function (x) { return typeof x === 'string'; }).map(function (x) { return x.toLowerCase(); });
        const matches = function (pattern) { const p = pattern.toLowerCase(); return installed.some(function (name) { return name.indexOf(p) >= 0; }); };
        const missing = configured.required.filter(function (x) { return !matches(x); }), prohibited = configured.prohibited.filter(matches);
        const active = (missing.length > 0) || (prohibited.length > 0), parts = [];
        if (missing.length) parts.push('missing: ' + missing.join(', '));
        if (prohibited.length) parts.push('prohibited: ' + prohibited.join(', '));
        return [{ state: active ? 'active' : 'healthy', detail: active ? ('Software policy mismatch (' + parts.join('; ') + ')') : 'Software policy is satisfied', variables: { missing: missing, prohibited: prohibited } }];
    },
    _test: { policy: policy }
};
