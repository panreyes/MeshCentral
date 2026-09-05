/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

module.exports = {
    definition: { id: 'device.security.secureBoot', title: 'Secure Boot', group: 'Device security', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'sysinfo',
    evaluate: function (context) {
        const configured = context.settings && context.settings.secureboot, required = configured && (configured.required === true);
        if (!required) return context.isActive('') ? [{ state: 'healthy', detail: 'Secure Boot is not required by policy' }] : [];
        const hardware = context.data && context.data.hardware;
        if (hardware == null) return [];
        var platform, enabled;
        if (hardware.windows && (typeof hardware.windows.secureBoot === 'boolean')) { platform = 'Windows'; enabled = hardware.windows.secureBoot; }
        else if (hardware.linux && (typeof hardware.linux.secureBoot === 'boolean')) { platform = 'Linux'; enabled = hardware.linux.secureBoot; }
        else return [];
        return [{ state: enabled ? 'healthy' : 'active', detail: platform + ' Secure Boot is ' + (enabled ? 'enabled' : 'disabled'), variables: { platform: platform.toLowerCase(), enabled: enabled } }];
    }
};
