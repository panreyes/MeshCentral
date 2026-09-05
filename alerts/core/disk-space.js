/**
* @description Low disk space alert evaluator
* @license Apache-2.0
*/

/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const storage = require('../lib/storage');

function getSettings(alertSettings) {
    var warningPercent = 15, recoveryPercent = 20;
    const settings = alertSettings && alertSettings.diskspace;
    if ((settings != null) && (typeof settings === 'object')) {
        if ((typeof settings.warningpercent === 'number') && Number.isFinite(settings.warningpercent) && (settings.warningpercent >= 0) && (settings.warningpercent < 100)) warningPercent = settings.warningpercent;
        if ((typeof settings.recoverypercent === 'number') && Number.isFinite(settings.recoverypercent) && (settings.recoverypercent > 0) && (settings.recoverypercent <= 100)) recoveryPercent = settings.recoverypercent;
    }
    if (recoveryPercent <= warningPercent) recoveryPercent = Math.min(100, warningPercent + 5);
    return { warningPercent: warningPercent, recoveryPercent: recoveryPercent };
}

function evaluate(context) {
    const result = [], volumes = storage.normalizeVolumes(context.data), thresholds = getSettings(context.settings);
    for (var i = 0; i < volumes.length; i++) {
        const volume = volumes[i];
        var state = 'unknown';
        if (volume.freePercent < thresholds.warningPercent) {
            state = 'active';
        } else if (volume.freePercent >= thresholds.recoveryPercent) {
            state = 'healthy';
        } else if ((typeof context.isActive === 'function') && context.isActive(volume.instanceKey)) {
            state = 'active';
        }
        result.push({
            instanceKey: volume.instanceKey,
            state: state,
            detail: volume.volume + ' has ' + volume.freePercent.toFixed(1) + '% free (' + storage.formatBytes(volume.freeBytes) + ' of ' + storage.formatBytes(volume.totalBytes) + ')'
        });
    }
    return result;
}

module.exports = {
    definition: { id: 'device.health.diskSpace', title: 'Low disk space', group: 'Device health', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'sysinfo',
    evaluate: evaluate,
    _test: { getSettings: getSettings }
};
module.exports.settings = { key: 'diskspace', fields: [
    ['warningpercent', 'number', 15, 0, 99.99],
    ['recoverypercent', 'number', 20, 0.01, 100]
], validate: function (values) { if (values.recoverypercent <= values.warningpercent) return 'Invalid thresholds in diskspace'; } };
