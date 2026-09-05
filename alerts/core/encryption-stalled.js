/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const values = require('../lib/value');

function threshold(settings) {
    const configured = settings && settings.encryptionstalled;
    return ((configured != null) && (typeof configured.hours === 'number') && Number.isFinite(configured.hours) && (configured.hours >= 0)) ? configured.hours : 24;
}

function result(instanceKey, drive, status, since, hours, now) {
    const elapsed = Math.max(0, now - since), detail = drive + ': BitLocker conversion status ' + status + ' has not changed for ' + (elapsed / 3600000).toFixed(1) + ' hours';
    return { instanceKey: instanceKey, state: (elapsed >= (hours * 3600000)) ? 'active' : 'unknown', detail: detail, variables: { status: status, since: since } };
}

module.exports = {
    definition: { id: 'device.security.encryptionStalled', title: 'Disk encryption stalled', group: 'Device security', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'sysinfo', periodic: true,
    evaluate: function (context) {
        const hours = threshold(context.settings), now = Date.now(), output = [];
        if (hours <= 0) {
            context.getObservations().forEach(function (item) { context.removeObservation(item.instanceKey); output.push({ instanceKey: item.instanceKey, state: 'healthy', detail: 'Encryption progress monitoring is disabled' }); });
            return output;
        }
        if (context.periodic) {
            context.getObservations().forEach(function (item) {
                const x = item.data;
                if (x && (typeof x.since === 'number') && ([2, 3, 4, 5].indexOf(x.status) >= 0)) output.push(result(item.instanceKey, x.drive, x.status, x.since, hours, now));
            });
            return output;
        }
        const volumes = context.data && context.data.hardware && context.data.hardware.windows && context.data.hardware.windows.volumes;
        if ((volumes == null) || (typeof volumes !== 'object') || Array.isArray(volumes)) return [];
        for (var drive in volumes) {
            const volume = volumes[drive], instanceKey = values.instanceKey('bitlocker', drive.toUpperCase());
            if ((volume == null) || (typeof volume !== 'object')) continue;
            const status = values.finiteNumber(volume.volumeStatus);
            if ([2, 3, 4, 5].indexOf(status) >= 0) {
                var observation = context.getObservation(instanceKey);
                if ((observation == null) || (observation.status !== status)) { observation = { drive: drive, status: status, since: now }; context.setObservation(instanceKey, observation); }
                output.push(result(instanceKey, drive, status, observation.since, hours, now));
            } else if (status != null) {
                context.removeObservation(instanceKey);
                output.push({ instanceKey: instanceKey, state: 'healthy', detail: drive + ': BitLocker conversion is not pending' });
            }
        }
        return output;
    },
    _test: { threshold: threshold }
};
