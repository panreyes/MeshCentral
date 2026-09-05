/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const samples = require('../lib/samples');
const values = require('../lib/value');

function settings(all) {
    const x = all && all.hightemperature;
    var warningCelsius = 85, recoveryCelsius = 75, consecutiveSamples = 3;
    if (x && (typeof x === 'object')) {
        if ((typeof x.warningcelsius === 'number') && (x.warningcelsius > 0) && (x.warningcelsius <= 200)) warningCelsius = x.warningcelsius;
        if ((typeof x.recoverycelsius === 'number') && (x.recoverycelsius >= -50) && (x.recoverycelsius < 200)) recoveryCelsius = x.recoverycelsius;
        if (Number.isInteger(x.consecutivesamples) && (x.consecutivesamples > 0) && (x.consecutivesamples <= 100)) consecutiveSamples = x.consecutivesamples;
    }
    if (recoveryCelsius >= warningCelsius) recoveryCelsius = warningCelsius - 5;
    return { warningCelsius: warningCelsius, recoveryCelsius: recoveryCelsius, consecutiveSamples: consecutiveSamples };
}

module.exports = {
    definition: { id: 'device.health.highTemperature', title: 'High temperature', group: 'Device health', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'telemetry',
    evaluate: function (context) {
        const thermals = context.data && context.data.thermals, limits = settings(context.settings), output = [], seen = {};
        if (!Array.isArray(thermals)) return output;
        for (var i = 0; i < thermals.length; i++) {
            const sensor = thermals[i], temperature = samples.finite(sensor && sensor.temperature);
            if ((sensor == null) || (typeof sensor.name !== 'string') || (temperature == null) || (temperature < -50) || (temperature > 200)) continue;
            const instanceKey = values.instanceKey('thermal', sensor.name), observation = context.getObservation(instanceKey) || { highCount: 0 };
            seen[instanceKey] = true;
            observation.highCount = (temperature >= limits.warningCelsius) ? ((Number(observation.highCount) || 0) + 1) : 0;
            observation.temperature = temperature;
            context.setObservation(instanceKey, observation);
            var state = 'unknown';
            if (temperature <= limits.recoveryCelsius) state = 'healthy';
            else if (observation.highCount >= limits.consecutiveSamples) state = 'active';
            else if (context.isActive(instanceKey)) state = 'active';
            output.push({ instanceKey: instanceKey, state: state, detail: sensor.name + ' is at ' + temperature.toFixed(1) + ' °C', variables: { sensor: sensor.name, celsius: Number(temperature.toFixed(1)) } });
        }
        context.getObservations().forEach(function (item) { if (seen[item.instanceKey] !== true) output.push({ instanceKey: item.instanceKey, state: 'unknown' }); });
        return output;
    },
    _test: { settings: settings }
};
