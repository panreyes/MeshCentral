/**
* @description Durable sample helpers for telemetry alerts
* @license Apache-2.0
*/

/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

function finite(value) { const x = Number(value); return Number.isFinite(x) ? x : null; }

function append(context, instanceKey, value, time, maximumAge, maximumSamples) {
    var observation = context.getObservation(instanceKey) || { samples: [] };
    observation.samples = Array.isArray(observation.samples) ? observation.samples.filter(function (x) {
        return x && (typeof x.time === 'number') && (typeof x.value === 'number') && (x.time >= (time - maximumAge)) && (x.time <= time);
    }) : [];
    const last = observation.samples[observation.samples.length - 1];
    if ((last == null) || (last.time < time)) observation.samples.push({ time: time, value: value });
    else if (last.time === time) last.value = value;
    if (observation.samples.length > maximumSamples) observation.samples = observation.samples.slice(-maximumSamples);
    context.setObservation(instanceKey, observation);
    return observation.samples;
}

function sustained(samples, threshold, duration) {
    if (!Array.isArray(samples) || (samples.length < 2)) return false;
    var start = samples.length - 1;
    while ((start > 0) && (samples[start - 1].value >= threshold)) start--;
    return (samples[start].value >= threshold) && ((samples[samples.length - 1].time - samples[start].time) >= duration);
}

module.exports = { finite: finite, append: append, sustained: sustained };
