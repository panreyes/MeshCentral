/*jshint node: true */
'use strict';

const values = require('../lib/value');

function flag(value) {
    if ((value === true) || (value === 1)) return true;
    if ((value === false) || (value === 0)) return false;
    return null;
}

module.exports = {
    definition: { id: 'device.security.tpm', title: 'TPM compliance', group: 'Device security', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'sysinfo',
    evaluate: function (context) {
        const configured = context.settings && context.settings.tpm;
        if ((configured == null) || (configured.required !== true)) return [];
        const tpm = context.data && context.data.hardware && context.data.hardware.tpm;
        if ((tpm == null) || (typeof tpm !== 'object')) return [];
        const activated = flag(tpm.IsActivated), enabled = flag(tpm.IsEnabled), owned = flag(tpm.IsOwned);
        if ((activated === false) || (enabled === false) || (owned === false)) {
            const disabled = [];
            if (activated === false) disabled.push('not activated');
            if (enabled === false) disabled.push('disabled');
            if (owned === false) disabled.push('not owned');
            return [{ state: 'active', detail: 'TPM is ' + disabled.join(', ') }];
        }
        const minimum = (typeof configured.minimumversion === 'string') ? configured.minimumversion : '2.0';
        const version = (typeof tpm.SpecVersion === 'string') ? tpm.SpecVersion.split(',')[0] : null;
        const comparison = values.compareVersions(version, minimum);
        if (comparison === -1) return [{ state: 'active', detail: 'TPM version ' + version + ' is below required version ' + minimum }];
        if ((activated === true) && (enabled === true) && (owned === true) && (comparison != null) && (comparison >= 0)) return [{ state: 'healthy', detail: 'TPM ' + version + ' is enabled and ready' }];
        return [{ state: 'unknown' }];
    },
    _test: { flag: flag }
};
module.exports.settings = { key: 'tpm', fields: [["required","boolean",false],["minimumversion","string","2.0"]] };
