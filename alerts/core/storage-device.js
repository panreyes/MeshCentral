/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const values = require('../lib/value');

module.exports = {
    definition: { id: 'device.health.storageDevice', title: 'Storage device health', group: 'Device health', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'sysinfo',
    evaluate: function (context) {
        const result = [], hardware = context.data && context.data.hardware;
        const drives = hardware && hardware.windows && hardware.windows.drives;
        if (!Array.isArray(drives)) return result;
        for (var i = 0; i < drives.length; i++) {
            const drive = drives[i];
            if ((drive == null) || (typeof drive !== 'object') || (typeof drive.Status !== 'string')) continue;
            const status = drive.Status.trim(), normalized = status.toUpperCase();
            var state = 'active';
            if (normalized === 'OK') state = 'healthy';
            if ((normalized.length === 0) || (normalized === 'UNKNOWN')) state = 'unknown';
            const identity = drive.DeviceID || drive.SerialNumber || drive.Model || String(i);
            const name = drive.Model || drive.Caption || identity;
            result.push({ instanceKey: values.instanceKey('storage', identity), state: state, detail: name + ' reports status ' + status });
        }
        return result;
    }
};
