/*jshint node: true */
'use strict';

module.exports = {
    definition: { id: 'device.health.pendingReboot', title: 'Pending reboot', group: 'Device health', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'coreinfo',
    evaluate: function (context) {
        if (!context.data || !Array.isArray(context.data.pr)) return [{ state: 'unknown' }];
        return [(context.data.pr.length > 0) ? { state: 'active', detail: context.data.pr.join(', ') } : { state: 'healthy', detail: 'No pending reboot' }];
    }
};
