/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const values = require('../lib/value');

module.exports = {
    definition: { id: 'device.security.diskEncryption', title: 'Disk encryption', group: 'Device security', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'sysinfo',
    evaluate: function (context) {
        const configured = context.settings && context.settings.diskencryption;
        if ((configured == null) || (configured.required !== true)) return [];
        const volumes = context.data && context.data.hardware && context.data.hardware.windows && context.data.hardware.windows.volumes;
        if ((volumes == null) || (typeof volumes !== 'object') || Array.isArray(volumes)) return [];
        const result = [];
        for (var drive in volumes) {
            const volume = volumes[drive];
            if ((volume == null) || (typeof volume !== 'object') || (values.finiteNumber(volume.dType) !== 3)) continue;
            const protection = values.finiteNumber(volume.protectionStatus), conversion = values.finiteNumber(volume.volumeStatus);
            var state = 'unknown', detail = drive + ': encryption status is unknown';
            if ((protection === 0) || (conversion === 0)) { state = 'active'; detail = drive + ': is not protected by BitLocker'; }
            else if ((protection === 1) && (conversion === 1)) { state = 'healthy'; detail = drive + ': is fully encrypted and protected'; }
            else if ((conversion != null) && ([2, 3, 4, 5].indexOf(conversion) >= 0)) { state = 'active'; detail = drive + ': is not fully encrypted (conversion status ' + conversion + ')'; }
            result.push({ instanceKey: values.instanceKey('bitlocker', drive.toUpperCase()), state: state, detail: detail });
        }
        return result;
    }
};
