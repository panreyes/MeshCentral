/*jshint node: true */
/*jshint esversion: 6 */
'use strict';
module.exports = {
    definition: { id: 'device.compliance.passwordPolicy', title: 'Password policy', group: 'Device compliance', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 }, source: 'telemetry',
    evaluate: function (context) {
        const expected = context.settings && context.settings.passwordpolicy, actual = context.data && context.data.localSecurity && context.data.localSecurity.passwordPolicy;
        if (!expected || (expected.enabled !== true)) return context.isActive('') ? [{ state: 'healthy', detail: 'Password policy monitoring is disabled' }] : [];
        if (!actual) return [];
        const failures = [];
        if ((expected.minimumlength > 0) && (!(actual.minimumLength >= expected.minimumlength))) failures.push('minimum length');
        if ((expected.lockoutthreshold > 0) && (!(actual.lockoutThreshold > 0) || (actual.lockoutThreshold > expected.lockoutthreshold))) failures.push('lockout threshold');
        if ((expected.maximumagedays > 0) && (!(actual.maximumAgeDays > 0) || (actual.maximumAgeDays > expected.maximumagedays))) failures.push('maximum age');
        return [{ state: failures.length ? 'active' : 'healthy', detail: failures.length ? ('Password policy failures: ' + failures.join(', ')) : 'Password policy satisfies the configured requirements', variables: { failures: failures } }];
    }
};
module.exports.settings = { key: 'passwordpolicy', fields: [["enabled","boolean",false],["minimumlength","integer",12,0,128],["maximumagedays","integer",90,0,999],["lockoutthreshold","integer",10,0,999]] };
