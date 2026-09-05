/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const values = require('../lib/value');

function getThreshold(alertSettings) {
    const configured = alertSettings && alertSettings.batterycycles;
    if ((configured != null) && (typeof configured.warningcycles === 'number') && Number.isFinite(configured.warningcycles) && (configured.warningcycles >= 0)) return configured.warningcycles;
    return 800;
}

module.exports = {
    definition: { id: 'device.health.batteryCycles', title: 'Battery cycle count', group: 'Device health', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'sysinfo',
    evaluate: function (context) {
        const batteries = context.data && context.data.hardware && context.data.hardware.battery, threshold = getThreshold(context.settings), result = [];
        if (!Array.isArray(batteries)) return result;
        for (var i = 0; i < batteries.length; i++) {
            const battery = batteries[i];
            if ((battery == null) || (typeof battery !== 'object')) continue;
            const cycles = values.finiteNumber(battery.CycleCount);
            if ((cycles == null) || (cycles <= 0)) continue;
            const identity = battery.SerialNumber || battery.InstanceName || battery.DeviceName || String(i);
            result.push({
                instanceKey: values.instanceKey('battery-cycles', identity),
                state: ((threshold > 0) && (cycles >= threshold)) ? 'active' : 'healthy',
                detail: (battery.DeviceName || identity) + ' has completed ' + Math.floor(cycles) + ' charge cycles'
            });
        }
        return result;
    },
    _test: { getThreshold: getThreshold }
};
