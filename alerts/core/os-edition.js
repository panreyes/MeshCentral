/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

function platformAndName(context) {
    const hardware = context.data && context.data.hardware;
    if (!hardware) return null;
    if (hardware.windows) { const x = hardware.windows.osinfo; return { platform: 'windows', name: x && ((typeof x.Caption === 'string') ? x.Caption : ((typeof x.Name === 'string') ? x.Name : context.node.osdesc)) }; }
    if (hardware.linux) return { platform: 'linux', name: context.node && context.node.osdesc };
    if (hardware.darwin) return { platform: 'darwin', name: context.node && context.node.osdesc };
    return null;
}

module.exports = {
    definition: { id: 'device.compliance.osEdition', title: 'Operating system edition', group: 'Device compliance', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'sysinfo',
    evaluate: function (context) {
        const current = platformAndName(context), configured = context.settings && context.settings.osedition;
        if ((current == null) || (typeof current.name !== 'string') || (configured == null)) return [];
        const allowed = configured['allowed' + current.platform];
        if (!Array.isArray(allowed) || (allowed.length === 0)) return context.isActive('') ? [{ state: 'healthy', detail: 'Operating system edition policy is disabled for this platform' }] : [];
        const name = current.name.toLowerCase(), matches = allowed.some(function (x) { return (typeof x === 'string') && (x.length > 0) && (name.indexOf(x.toLowerCase()) >= 0); });
        return [{ state: matches ? 'healthy' : 'active', detail: current.name + (matches ? ' is allowed' : ' is not in the allowed ' + current.platform + ' editions'), variables: { platform: current.platform, os: current.name } }];
    },
    _test: { platformAndName: platformAndName }
};
