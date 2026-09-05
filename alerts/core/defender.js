/*jshint node: true */
'use strict';

module.exports = {
    definition: { id: 'device.health.defender', title: 'Microsoft Defender', group: 'Device health', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'coreinfo',
    evaluate: function (context) {
        const defender = context.data && context.data.defender;
        if ((defender == null) || (typeof defender !== 'object')) return [{ state: 'unknown' }];
        const disabled = [];
        if (defender.RealTimeProtection === false) disabled.push('Real-time protection');
        if (defender.TamperProtected === false) disabled.push('Tamper protection');
        if (disabled.length > 0) return [{ state: 'active', detail: disabled.join(', ') }];
        if ((defender.RealTimeProtection === true) && (defender.TamperProtected === true)) return [{ state: 'healthy', detail: 'Protection enabled' }];
        return [{ state: 'unknown' }];
    }
};
