/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

function threshold(settings) {
    const configured = settings && settings.inventorystale;
    return ((configured != null) && (typeof configured.hours === 'number') && Number.isFinite(configured.hours) && (configured.hours >= 0)) ? configured.hours : 24;
}

module.exports = {
    definition: { id: 'device.health.inventoryStale', title: 'Device inventory is stale', group: 'Device health', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'inventory', periodic: true,
    evaluate: function (context) {
        const hours = threshold(context.settings), now = Date.now();
        if (hours <= 0) { context.removeObservation(''); return context.isActive('') ? [{ state: 'healthy', detail: 'Inventory freshness monitoring is disabled' }] : []; }
        var observation = context.getObservation('');
        if (!context.periodic) {
            const time = context.data && context.data.time;
            if ((typeof time !== 'number') || !Number.isFinite(time) || (time > (now + 60000))) return [];
            observation = { lastCheck: time };
            context.setObservation('', observation);
            return context.isActive('') ? [{ state: 'healthy', detail: 'Device inventory check is current' }] : [{ state: 'unknown' }];
        }
        if ((observation == null) || (typeof observation.lastCheck !== 'number') || (context.connected !== true)) return [{ state: 'unknown' }];
        const age = Math.max(0, now - observation.lastCheck);
        return [{ state: (age >= (hours * 3600000)) ? 'active' : 'healthy', detail: 'Last inventory check was ' + (age / 3600000).toFixed(1) + ' hours ago', variables: { lastCheck: observation.lastCheck } }];
    },
    _test: { threshold: threshold }
};
