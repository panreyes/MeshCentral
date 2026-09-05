/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const storage = require('../lib/storage');

function settings(all) {
    var horizonDays = 0, recoveryDays = 30, minimumSpanHours = 6, minimumSamples = 3;
    const x = all && all.diskexhaustionforecast;
    if (x && (typeof x === 'object')) {
        if ((typeof x.horizondays === 'number') && Number.isFinite(x.horizondays) && (x.horizondays >= 0)) horizonDays = x.horizondays;
        if ((typeof x.recoverydays === 'number') && Number.isFinite(x.recoverydays) && (x.recoverydays > 0)) recoveryDays = x.recoverydays;
        if ((typeof x.minimumspanhours === 'number') && Number.isFinite(x.minimumspanhours) && (x.minimumspanhours > 0)) minimumSpanHours = x.minimumspanhours;
        if (Number.isInteger(x.minimumsamples) && (x.minimumsamples >= 2)) minimumSamples = x.minimumsamples;
    }
    if (recoveryDays <= horizonDays) recoveryDays = horizonDays + 7;
    return { horizonDays: horizonDays, recoveryDays: recoveryDays, minimumSpanHours: minimumSpanHours, minimumSamples: minimumSamples };
}

module.exports = {
    definition: { id: 'device.health.diskExhaustionForecast', title: 'Disk exhaustion forecast', group: 'Device health', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'sysinfo',
    evaluate: function (context) {
        const limits = settings(context.settings), output = [], now = Date.now();
        const sampleTime = ((context.data != null) && (typeof context.data.time === 'number') && Number.isFinite(context.data.time) && (context.data.time <= (now + 60000))) ? context.data.time : now;
        if (limits.horizonDays <= 0) {
            context.getObservations().forEach(function (item) { context.removeObservation(item.instanceKey); output.push({ instanceKey: item.instanceKey, state: 'healthy', detail: 'Disk exhaustion forecasting is disabled' }); });
            return output;
        }
        const volumes = storage.normalizeVolumes(context.data);
        for (var i = 0; i < volumes.length; i++) {
            const volume = volumes[i], instanceKey = volume.instanceKey;
            var observation = context.getObservation(instanceKey) || { volume: volume.volume, samples: [] };
            observation.volume = volume.volume;
            observation.samples = Array.isArray(observation.samples) ? observation.samples.filter(function (sample) { return sample && (typeof sample.time === 'number') && (typeof sample.freeBytes === 'number') && (sample.time >= (now - (30 * 86400000))) && (sample.time <= now); }) : [];
            const lastExisting = observation.samples[observation.samples.length - 1];
            if ((lastExisting == null) || (lastExisting.time < sampleTime)) observation.samples.push({ time: sampleTime, freeBytes: volume.freeBytes });
            else if (lastExisting.time === sampleTime) lastExisting.freeBytes = volume.freeBytes;
            if (observation.samples.length > 50) observation.samples = observation.samples.slice(-50);
            context.setObservation(instanceKey, observation);
            if (observation.samples.length < limits.minimumSamples) { output.push({ instanceKey: instanceKey, state: 'unknown' }); continue; }
            const first = observation.samples[0], last = observation.samples[observation.samples.length - 1], spanDays = (last.time - first.time) / 86400000;
            if (spanDays < (limits.minimumSpanHours / 24)) { output.push({ instanceKey: instanceKey, state: 'unknown' }); continue; }
            const consumedPerDay = (first.freeBytes - last.freeBytes) / spanDays;
            if (consumedPerDay <= 0) { output.push({ instanceKey: instanceKey, state: context.isActive(instanceKey) ? 'healthy' : 'unknown', detail: volume.volume + ': free space is not decreasing' }); continue; }
            const daysRemaining = last.freeBytes / consumedPerDay;
            var state = 'unknown';
            if (daysRemaining <= limits.horizonDays) state = 'active';
            else if (daysRemaining >= limits.recoveryDays) state = 'healthy';
            else if (context.isActive(instanceKey)) state = 'active';
            output.push({ instanceKey: instanceKey, state: state, detail: volume.volume + ': projected to fill in ' + daysRemaining.toFixed(1) + ' days', variables: { daysRemaining: Number(daysRemaining.toFixed(1)), samples: observation.samples.length } });
        }
        return output;
    },
    _test: { settings: settings }
};
