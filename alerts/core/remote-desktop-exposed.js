/*jshint node: true */
/*jshint esversion: 6 */
'use strict';
module.exports = {
    definition: { id: 'device.security.remoteDesktopExposed', title: 'Remote access exposed', group: 'Device security', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 }, source: 'telemetry',
    evaluate: function (context) {
        const x = context.settings && context.settings.remotedesktopexposed, remote = context.data && context.data.localSecurity && context.data.localSecurity.remoteAccess;
        if (!x || (x.enabled !== true)) return context.isActive('') ? [{ state: 'healthy', detail: 'Remote access exposure policy is disabled' }] : [];
        if (!remote) return [];
        const exposed = [];
        if ((x.allowrdp === false) && remote.rdp) exposed.push('RDP');
        if ((x.allowssh === false) && remote.ssh) exposed.push('SSH');
        return [{ state: exposed.length ? 'active' : 'healthy', detail: exposed.length ? ('Disallowed remote access is listening: ' + exposed.join(', ')) : 'Remote access exposure matches policy', variables: { exposed: exposed } }];
    }
};
module.exports.settings = { key: 'remotedesktopexposed', fields: [["enabled","boolean",false],["allowrdp","boolean",true],["allowssh","boolean",true]] };
