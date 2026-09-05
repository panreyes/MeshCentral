/*jshint node: true */
'use strict';

module.exports = {
    definition: { id: 'device.security.legacyBootMode', title: 'Legacy boot mode', group: 'Device security', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'sysinfo',
    evaluate: function (context) {
        const configured = context.settings && context.settings.legacybootmode;
        if ((configured == null) || (configured.requireuefi !== true)) return (typeof context.getState === 'function') && context.getState('') ? [{ state: 'healthy', detail: 'UEFI requirement is disabled' }] : [];
        const mode = context.data && context.data.hardware && context.data.hardware.identifiers && context.data.hardware.identifiers.bios_mode;
        if (typeof mode !== 'string') return [];
        const normalized = mode.trim().toLowerCase();
        if (normalized.indexOf('uefi') >= 0) return [{ state: 'healthy', detail: 'Device boots using ' + mode }];
        if (normalized.indexOf('legacy') >= 0) return [{ state: 'active', detail: 'Device boots using ' + mode + '; UEFI is required' }];
        return [{ state: 'unknown' }];
    }
};
