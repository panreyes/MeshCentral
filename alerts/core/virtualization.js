/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

function virtualState(data) {
    const identifiers = data && data.hardware && data.hardware.identifiers;
    if ((identifiers == null) || (typeof identifiers !== 'object')) return null;
    const text = ['board_name', 'board_vendor', 'bios_vendor', 'chassis_type', 'product_name', 'product_uuid'].map(function (key) { return (typeof identifiers[key] === 'string') ? identifiers[key] : ''; }).join(' ').toLowerCase();
    if (/vmware|virtualbox|virtual machine|kvm|qemu|xen|hyper-v|parallels|bhyve/.test(text)) return true;
    return (text.trim().length > 0) ? false : null;
}

module.exports = {
    definition: { id: 'device.compliance.virtualization', title: 'Virtualization policy', group: 'Device compliance', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'sysinfo',
    evaluate: function (context) {
        const configured = context.settings && context.settings.virtualization, expected = configured && configured.expected;
        if (['physical', 'virtual'].indexOf(expected) < 0) return context.isActive('') ? [{ state: 'healthy', detail: 'Virtualization policy is disabled' }] : [];
        const detected = virtualState(context.data);
        if (detected == null) return [];
        const actual = detected ? 'virtual' : 'physical';
        return [{ state: (actual === expected) ? 'healthy' : 'active', detail: 'Device is ' + actual + '; policy requires ' + expected, variables: { actual: actual, expected: expected } }];
    },
    _test: { virtualState: virtualState }
};
