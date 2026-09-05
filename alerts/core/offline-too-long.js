/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

function threshold(settings) {
    const configured = settings && settings.offlinetoolong;
    return ((configured != null) && (typeof configured.hours === 'number') && Number.isFinite(configured.hours) && (configured.hours >= 0)) ? configured.hours : 24;
}

module.exports = {
    definition: { id: 'device.health.offlineTooLong', title: 'Device offline too long', group: 'Device health', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0 },
    source: 'connectivity', periodic: true,
    evaluate: function (context) {
        const hours = threshold(context.settings), now = Date.now();
        if (hours <= 0) { if (typeof context.removeObservation === 'function') context.removeObservation(''); return context.isActive('') ? [{ state: 'healthy', detail: 'Offline duration monitoring is disabled' }] : []; }
        if (context.data && (context.data.connected === true)) {
            if (typeof context.removeObservation === 'function') context.removeObservation('');
            return [{ state: 'healthy', detail: 'Agent is connected' }];
        }
        var observation = context.getObservation('');
        if (!context.periodic && context.data && (context.data.connected === false)) {
            if ((observation == null) || (typeof observation.disconnectedSince !== 'number')) {
                observation = { disconnectedSince: now };
                context.setObservation('', observation);
            }
        }
        if ((observation == null) || (typeof observation.disconnectedSince !== 'number')) return [];
        const elapsed = Math.max(0, now - observation.disconnectedSince), detail = 'Agent has been offline for ' + (elapsed / 3600000).toFixed(1) + ' hours';
        return [{ state: (elapsed >= (hours * 3600000)) ? 'active' : 'unknown', detail: detail, variables: { disconnectedSince: observation.disconnectedSince } }];
    },
    _test: { threshold: threshold }
};
module.exports.settings = { key: 'offlinetoolong', fields: [["hours","number",24,0,87600]] };
