/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

function settings(all) {
    const x = all && all.clockdrift;
    var warningSeconds = 300, recoverySeconds = 120;
    if (x && (typeof x === 'object')) {
        if ((typeof x.warningseconds === 'number') && (x.warningseconds > 0)) warningSeconds = x.warningseconds;
        if ((typeof x.recoveryseconds === 'number') && (x.recoveryseconds >= 0)) recoverySeconds = x.recoveryseconds;
    }
    if (recoverySeconds >= warningSeconds) recoverySeconds = Math.max(0, warningSeconds / 2);
    return { warningSeconds: warningSeconds, recoverySeconds: recoverySeconds };
}

module.exports = {
    definition: { id: 'device.compliance.clockDrift', title: 'Clock drift', group: 'Device compliance', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'telemetry',
    evaluate: function (context) {
        const agentTime = Number(context.data && context.data.agentTime), receivedTime = Number(context.data && context.data.receivedTime), limits = settings(context.settings);
        if (!Number.isFinite(agentTime) || !Number.isFinite(receivedTime)) return [];
        const driftSeconds = Math.abs(receivedTime - agentTime) / 1000;
        var state = 'unknown';
        if (driftSeconds >= limits.warningSeconds) state = 'active';
        else if (driftSeconds <= limits.recoverySeconds) state = 'healthy';
        else if (context.isActive('')) state = 'active';
        return [{ state: state, detail: 'Device clock differs from the server by ' + driftSeconds.toFixed(1) + ' seconds', variables: { driftSeconds: Number(driftSeconds.toFixed(1)) } }];
    },
    _test: { settings: settings }
};
