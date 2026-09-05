/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

function system(data, node) {
    const hardware = data && data.hardware;
    if (!hardware) return null;
    if (hardware.windows) {
        const info = hardware.windows.osinfo || {};
        return { platform: 'windows', text: [info.Caption, info.Version, info.BuildNumber].filter(function (x) { return (typeof x === 'string') && (x.length > 0); }).join(' ') };
    }
    if (hardware.linux) {
        const release = hardware.linux.osRelease || {};
        return { platform: 'linux', text: [release.prettyName, release.id, release.versionId, hardware.linux.kernel_release, node && node.osdesc].filter(function (x) { return (typeof x === 'string') && (x.length > 0); }).join(' ') };
    }
    if (hardware.darwin) return { platform: 'darwin', text: (node && node.osdesc) || '' };
    return null;
}

module.exports = {
    definition: { id: 'device.compliance.osEndOfLife', title: 'Operating system support lifecycle', group: 'Device compliance', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'sysinfo', periodic: true, periodicAll: true,
    evaluate: function (context) {
        const configured = context.settings && context.settings.osendoflife, rules = configured && configured.rules;
        if (!Array.isArray(rules) || (rules.length === 0)) return context.isActive('') ? [{ state: 'healthy', detail: 'Operating system lifecycle policy is disabled' }] : [];
        const current = system(context.data, context.node);
        if ((current == null) || (current.text.length === 0)) return [];
        var match = null;
        for (var i = 0; i < rules.length; i++) {
            const rule = rules[i];
            if ((rule == null) || (typeof rule !== 'object') || (rule.platform !== current.platform) || (typeof rule.match !== 'string') || (rule.match.length === 0) || (typeof rule.endoflife !== 'string')) continue;
            if (current.text.toLowerCase().indexOf(rule.match.toLowerCase()) >= 0) { match = rule; break; }
        }
        if (match == null) return [{ state: 'unknown', detail: 'No lifecycle rule matches ' + current.text }];
        const endOfLife = Date.parse(match.endoflife + (/^\d{4}-\d{2}-\d{2}$/.test(match.endoflife) ? 'T23:59:59Z' : ''));
        if (!Number.isFinite(endOfLife)) return [];
        const warningDays = ((typeof match.warningdays === 'number') && Number.isFinite(match.warningdays) && (match.warningdays >= 0)) ? match.warningdays : 90;
        const remainingDays = (endOfLife - Date.now()) / 86400000;
        return [{ state: (remainingDays <= warningDays) ? 'active' : 'healthy', detail: current.text + ' reaches end of support on ' + match.endoflife + ' (' + Math.floor(remainingDays) + ' days remaining)', variables: { platform: current.platform, endOfLife: match.endoflife, remainingDays: Math.floor(remainingDays) } }];
    },
    _test: { system: system }
};
module.exports.settings = { key: 'osendoflife', fields: [["rules","rules",[],null,null,null,256]] };
