/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const values = require('../lib/value');

function settings(alertSettings) {
    var warningPercent = 70, recoveryPercent = 80;
    const configured = alertSettings && alertSettings.battery;
    if ((configured != null) && (typeof configured === 'object')) {
        if ((typeof configured.warningpercent === 'number') && Number.isFinite(configured.warningpercent) && (configured.warningpercent >= 0) && (configured.warningpercent < 100)) warningPercent = configured.warningpercent;
        if ((typeof configured.recoverypercent === 'number') && Number.isFinite(configured.recoverypercent) && (configured.recoverypercent > 0) && (configured.recoverypercent <= 100)) recoveryPercent = configured.recoverypercent;
    }
    if (recoveryPercent <= warningPercent) recoveryPercent = Math.min(100, warningPercent + 10);
    return { warningPercent: warningPercent, recoveryPercent: recoveryPercent };
}

module.exports = {
    definition: { id: 'device.health.battery', title: 'Battery health', group: 'Device health', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'sysinfo',
    evaluate: function (context) {
        const result = [], batteries = context.data && context.data.hardware && context.data.hardware.battery, thresholds = settings(context.settings);
        if (!Array.isArray(batteries)) return result;
        for (var i = 0; i < batteries.length; i++) {
            const battery = batteries[i];
            if ((battery == null) || (typeof battery !== 'object')) continue;
            const full = values.finiteNumber(battery.FullChargedCapacity), designed = values.finiteNumber(battery.DesignedCapacity);
            var health = ((full != null) && (full > 0) && (designed != null) && (designed > 0)) ? ((full * 100) / designed) : values.finiteNumber(battery.Health);
            // Some agent platforms use Health=0 when capacity data could not be read.
            if ((health === 0) && !((full != null) && (designed != null) && (designed > 0))) health = null;
            if ((health == null) || (health < 0) || (health > 100)) continue;
            const identity = battery.SerialNumber || battery.DeviceName || String(i), instanceKey = values.instanceKey('battery', identity);
            var state = 'unknown';
            if (health < thresholds.warningPercent) state = 'active';
            else if (health >= thresholds.recoveryPercent) state = 'healthy';
            else if ((typeof context.isActive === 'function') && context.isActive(instanceKey)) state = 'active';
            result.push({ instanceKey: instanceKey, state: state, detail: (battery.DeviceName || identity) + ' health is ' + health.toFixed(1) + '%' });
        }
        return result;
    },
    _test: { settings: settings }
};
module.exports.settings = { key: 'battery', fields: [["warningpercent","number",70,0,99.99],["recoverypercent","number",80,0.01,100]], validate: function (values) { if (values.recoverypercent <= values.warningpercent) return 'Invalid thresholds in battery'; } };
