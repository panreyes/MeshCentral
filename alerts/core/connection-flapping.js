/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

function settings(alertSettings) {
    var windowMinutes = 10, transitionCount = 6, recoveryMinutes = 30;
    const configured = alertSettings && alertSettings.connectionflapping;
    if ((configured != null) && (typeof configured === 'object')) {
        if ((typeof configured.windowminutes === 'number') && Number.isFinite(configured.windowminutes) && (configured.windowminutes > 0)) windowMinutes = configured.windowminutes;
        if ((typeof configured.transitioncount === 'number') && Number.isFinite(configured.transitioncount) && (configured.transitioncount >= 2)) transitionCount = Math.floor(configured.transitioncount);
        if ((typeof configured.recoveryminutes === 'number') && Number.isFinite(configured.recoveryminutes) && (configured.recoveryminutes > 0)) recoveryMinutes = configured.recoveryminutes;
    }
    return { windowMinutes: windowMinutes, transitionCount: transitionCount, recoveryMinutes: recoveryMinutes };
}

module.exports = {
    definition: { id: 'device.health.connectionFlapping', title: 'Unstable agent connection', group: 'Device health', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0 },
    source: 'connectivity',
    evaluate: function (context) {
        const thresholds = settings(context.settings), now = Date.now(), cutoff = now - (thresholds.windowMinutes * 60000);
        const history = Array.isArray(context.data && context.data.history) ? context.data.history.filter(function (time) { return (typeof time === 'number') && Number.isFinite(time) && (time >= cutoff) && (time <= now); }) : [];
        const activeState = (typeof context.getState === 'function') ? context.getState('') : null;
        var lastTransition = (history.length > 0) ? history[history.length - 1] : null;
        if ((lastTransition == null) && activeState && activeState.variables && (typeof activeState.variables.lastTransition === 'number')) lastTransition = activeState.variables.lastTransition;
        if (activeState != null) {
            if ((lastTransition != null) && ((now - lastTransition) >= (thresholds.recoveryMinutes * 60000))) return [{ state: 'healthy', detail: 'Agent connection has remained stable for ' + thresholds.recoveryMinutes + ' minutes' }];
            if (context.data && (context.data.transition === true)) return [{ state: 'active', detail: history.length + ' agent connection changes occurred within ' + thresholds.windowMinutes + ' minutes', variables: { transitionCount: history.length, lastTransition: lastTransition } }];
            return [{ state: 'unknown' }];
        }
        if (history.length >= thresholds.transitionCount) return [{ state: 'active', detail: history.length + ' agent connection changes occurred within ' + thresholds.windowMinutes + ' minutes', variables: { transitionCount: history.length, lastTransition: lastTransition } }];
        return [{ state: 'unknown' }];
    },
    _test: { settings: settings }
};
module.exports.settings = { key: 'connectionflapping', fields: [["windowminutes","number",10,1,1440],["transitioncount","integer",6,2,1000],["recoveryminutes","number",30,1,1440]] };
