/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const values = require('../lib/value');

function settings(alertSettings) {
    var warningDays = 30, recoveryDays = 25;
    const configured = alertSettings && alertSettings.excessiveuptime;
    if ((configured != null) && (typeof configured === 'object')) {
        if ((typeof configured.warningdays === 'number') && Number.isFinite(configured.warningdays) && (configured.warningdays >= 0)) warningDays = configured.warningdays;
        if ((typeof configured.recoverydays === 'number') && Number.isFinite(configured.recoverydays) && (configured.recoverydays >= 0)) recoveryDays = configured.recoverydays;
    }
    if (recoveryDays >= warningDays) recoveryDays = Math.max(0, warningDays - 5);
    return { warningDays: warningDays, recoveryDays: recoveryDays };
}

module.exports = {
    definition: { id: 'device.health.excessiveUptime', title: 'Excessive uptime', group: 'Device health', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'sysinfo',
    evaluate: function (context) {
        const hardware = context.data && context.data.hardware;
        if ((hardware == null) || (typeof hardware !== 'object')) return [];
        var platform, bootValue;
        if (hardware.windows && hardware.windows.osinfo) { platform = 'windows'; bootValue = hardware.windows.osinfo.LastBootUpTime; }
        else if (hardware.linux) { platform = 'linux'; bootValue = hardware.linux.LastBootUpTime; }
        else if (hardware.darwin) { platform = 'darwin'; bootValue = hardware.darwin.LastBootUpTime; }
        const bootTime = values.parseDate(bootValue, platform), now = Date.now();
        if ((bootTime == null) || (bootTime > now) || ((now - bootTime) > (36500 * 86400000))) return [];
        const uptimeDays = (now - bootTime) / 86400000, thresholds = settings(context.settings);
        var state = 'unknown';
        if ((thresholds.warningDays > 0) && (uptimeDays >= thresholds.warningDays)) state = 'active';
        else if ((thresholds.warningDays === 0) || (uptimeDays <= thresholds.recoveryDays)) state = 'healthy';
        else if ((typeof context.isActive === 'function') && context.isActive('')) state = 'active';
        return [{ state: state, detail: 'Device uptime is ' + uptimeDays.toFixed(1) + ' days' }];
    },
    _test: { settings: settings }
};
module.exports.settings = { key: 'excessiveuptime', fields: [["warningdays","number",30,0,36500],["recoverydays","number",25,0,36500]], validate: function (values) { if (values.warningdays <= values.recoverydays) return 'Invalid thresholds in excessiveuptime'; } };
