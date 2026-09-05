/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const samples = require('../lib/samples');

function settings(all) {
    const x = all && all.sustainedmemorypressure;
    var warningPercent = 90, recoveryPercent = 80, durationMinutes = 15;
    if (x && (typeof x === 'object')) {
        if ((typeof x.warningpercent === 'number') && (x.warningpercent > 0) && (x.warningpercent <= 100)) warningPercent = x.warningpercent;
        if ((typeof x.recoverypercent === 'number') && (x.recoverypercent >= 0) && (x.recoverypercent < 100)) recoveryPercent = x.recoverypercent;
        if ((typeof x.durationminutes === 'number') && (x.durationminutes > 0)) durationMinutes = x.durationminutes;
    }
    if (recoveryPercent >= warningPercent) recoveryPercent = Math.max(0, warningPercent - 10);
    return { warningPercent: warningPercent, recoveryPercent: recoveryPercent, durationMinutes: durationMinutes };
}

module.exports = {
    definition: { id: 'device.health.sustainedMemoryPressure', title: 'Sustained memory pressure', group: 'Device health', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'telemetry',
    evaluate: function (context) {
        const value = samples.finite(context.data && context.data.memory && context.data.memory.percentConsumed), limits = settings(context.settings);
        if ((value == null) || (value < 0) || (value > 100)) return [];
        const time = samples.finite(context.data.time), now = Date.now(), sampleTime = ((time != null) && (time <= (now + 60000))) ? time : now;
        const history = samples.append(context, '', value, sampleTime, Math.max(86400000, limits.durationMinutes * 120000), 288);
        var state = 'unknown';
        if (value <= limits.recoveryPercent) state = 'healthy';
        else if (samples.sustained(history, limits.warningPercent, limits.durationMinutes * 60000)) state = 'active';
        else if (context.isActive('')) state = 'active';
        return [{ state: state, detail: 'Memory utilization is ' + value.toFixed(1) + '%', variables: { percent: Number(value.toFixed(1)) } }];
    },
    _test: { settings: settings }
};
