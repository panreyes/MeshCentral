/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const values = require('../lib/value');

module.exports = {
    definition: { id: 'device.security.missingRecoveryKey', title: 'Missing BitLocker recovery key', group: 'Device security', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'sysinfo',
    evaluate: function (context) {
        const configured = context.settings && context.settings.missingrecoverykey, required = configured && (configured.required === true);
        const windows = context.data && context.data.hardware && context.data.hardware.windows;
        const volumes = windows && windows.volumes;
        if ((volumes == null) || (typeof volumes !== 'object') || Array.isArray(volumes)) return [];
        const keys = ((windows.bitlocker != null) && (typeof windows.bitlocker === 'object') && !Array.isArray(windows.bitlocker)) ? windows.bitlocker : {}, output = [];
        for (var drive in volumes) {
            const volume = volumes[drive];
            if ((volume == null) || (typeof volume !== 'object') || (values.finiteNumber(volume.dType) !== 3) || (values.finiteNumber(volume.volumeStatus) !== 1) || (values.finiteNumber(volume.protectionStatus) !== 1)) continue;
            const instanceKey = values.instanceKey('bitlocker', drive.toUpperCase()), stored = (typeof volume.recoveryPassword === 'string') || ((typeof volume.identifier === 'string') && (keys[volume.identifier] != null) && (typeof keys[volume.identifier].rp === 'string'));
            if (!required) output.push({ instanceKey: instanceKey, state: 'healthy', detail: drive + ': recovery-key policy is disabled' });
            else output.push({ instanceKey: instanceKey, state: stored ? 'healthy' : 'active', detail: drive + (stored ? ': a BitLocker recovery key is stored' : ': no BitLocker recovery key is stored'), variables: { drive: drive, keyStored: stored } });
        }
        return output;
    }
};
module.exports.settings = { key: 'missingrecoverykey', fields: [["required","boolean",false]] };
