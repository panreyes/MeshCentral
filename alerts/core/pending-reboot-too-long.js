/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

function threshold(settings) {
    const configured = settings && settings.pendingreboottoolong;
    return ((configured != null) && (typeof configured.days === 'number') && Number.isFinite(configured.days) && (configured.days >= 0)) ? configured.days : 3;
}

module.exports = {
    definition: { id: 'device.health.pendingRebootTooLong', title: 'Pending reboot for too long', group: 'Device health', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'coreinfo', periodic: true,
    evaluate: function (context) {
        const days = threshold(context.settings), now = Date.now();
        var observation = context.getObservation('');
        if (days <= 0) {
            context.removeObservation('');
            return context.isActive('') ? [{ state: 'healthy', detail: 'Pending reboot duration monitoring is disabled' }] : [];
        }
        if (!context.periodic) {
            if (!Array.isArray(context.data && context.data.pr)) return [];
            if (context.data.pr.length === 0) {
                context.removeObservation('');
                return [{ state: 'healthy', detail: 'No reboot is pending' }];
            }
            const reasons = context.data.pr.filter(function (x) { return typeof x === 'string'; }).slice(0, 20);
            if ((observation == null) || (typeof observation.since !== 'number')) observation = { since: now, reasons: reasons };
            else observation.reasons = reasons;
            context.setObservation('', observation);
        }
        if ((observation == null) || (typeof observation.since !== 'number')) return [];
        const elapsed = Math.max(0, now - observation.since), detail = 'Reboot has been pending for ' + (elapsed / 86400000).toFixed(1) + ' days' + ((observation.reasons && observation.reasons.length > 0) ? ': ' + observation.reasons.join(', ') : '');
        return [{ state: (elapsed >= (days * 86400000)) ? 'active' : 'unknown', detail: detail, variables: { since: observation.since, reasons: observation.reasons || [] } }];
    },
    _test: { threshold: threshold }
};
