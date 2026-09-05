/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const numbers = require('../lib/value');

function settings(all) {
    const x = all && all.criticalbatterycharge;
    var warningPercent = 10, recoveryPercent = 20;
    if (x && (typeof x === 'object')) {
        if ((typeof x.warningpercent === 'number') && (x.warningpercent >= 0) && (x.warningpercent < 100)) warningPercent = x.warningpercent;
        if ((typeof x.recoverypercent === 'number') && (x.recoverypercent > 0) && (x.recoverypercent <= 100)) recoveryPercent = x.recoverypercent;
    }
    if (recoveryPercent <= warningPercent) recoveryPercent = Math.min(100, warningPercent + 10);
    return { warningPercent: warningPercent, recoveryPercent: recoveryPercent };
}

module.exports = {
    definition: { id: 'device.health.criticalBatteryCharge', title: 'Critical battery charge', group: 'Device health', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'sysinfo',
    evaluate: function (context) {
        const batteries = context.data && context.data.hardware && context.data.hardware.battery, limits = settings(context.settings), output = [];
        if (!Array.isArray(batteries)) return output;
        for (var i = 0; i < batteries.length; i++) {
            const battery = batteries[i], charge = numbers.finiteNumber(battery && battery.BatteryCharge);
            if ((battery == null) || (charge == null) || (charge < 0) || (charge > 100)) continue;
            const identity = battery.SerialNumber || battery.DeviceName || String(i), instanceKey = numbers.instanceKey('battery-charge', identity), discharging = battery.Discharging === true, charging = battery.Charging === true;
            var state = 'unknown';
            if (charging || (charge >= limits.recoveryPercent)) state = 'healthy';
            else if (discharging && (charge <= limits.warningPercent)) state = 'active';
            else if (context.isActive(instanceKey)) state = 'active';
            output.push({ instanceKey: instanceKey, state: state, detail: (battery.DeviceName || identity) + ' charge is ' + charge.toFixed(1) + '%' + (discharging ? ' and discharging' : ''), variables: { percent: Number(charge.toFixed(1)), discharging: discharging, charging: charging } });
        }
        return output;
    },
    _test: { settings: settings }
};
