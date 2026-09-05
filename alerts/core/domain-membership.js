/*jshint node: true */
'use strict';

module.exports = {
    definition: { id: 'device.compliance.domainMembership', title: 'Domain membership', group: 'Device compliance', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'sysinfo',
    evaluate: function (context) {
        const configured = context.settings && context.settings.domainmembership;
        if ((configured == null) || (configured.required !== true)) return [];
        const osinfo = context.data && context.data.hardware && context.data.hardware.windows && context.data.hardware.windows.osinfo;
        if ((osinfo == null) || (typeof osinfo !== 'object') || (typeof osinfo.PartOfDomain !== 'boolean')) return [];
        if (osinfo.PartOfDomain === false) return [{ state: 'active', detail: 'Device is not joined to a domain' }];
        if (typeof osinfo.Domain !== 'string') return [{ state: 'unknown' }];
        const allowed = Array.isArray(configured.alloweddomains) ? configured.alloweddomains.filter(function (x) { return typeof x === 'string'; }).map(function (x) { return x.toLowerCase(); }) : [];
        if ((allowed.length > 0) && (allowed.indexOf(osinfo.Domain.toLowerCase()) < 0)) return [{ state: 'active', detail: 'Device is joined to unexpected domain ' + osinfo.Domain }];
        return [{ state: 'healthy', detail: 'Device is joined to domain ' + osinfo.Domain }];
    }
};
