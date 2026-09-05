/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const placeholders = /^(|none|unknown|not specified|not available|system serial number|to be filled by o\.e\.m\.|default string|0+|f+)$/i;

module.exports = {
    definition: { id: 'device.inventory.incompleteIdentifiers', title: 'Incomplete hardware identifiers', group: 'Device inventory', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'sysinfo',
    evaluate: function (context) {
        const configured = context.settings && context.settings.incompleteidentifiers;
        if ((configured == null) || (configured.enabled !== true)) return context.isActive('') ? [{ state: 'healthy', detail: 'Hardware identifier completeness monitoring is disabled' }] : [];
        const identifiers = context.data && context.data.hardware && context.data.hardware.identifiers;
        if ((identifiers == null) || (typeof identifiers !== 'object')) return [];
        const missing = [];
        [['product_uuid', 'product UUID'], ['board_serial', 'board serial'], ['chassis_serial', 'chassis serial']].forEach(function (item) {
            if ((typeof identifiers[item[0]] !== 'string') || placeholders.test(identifiers[item[0]].trim())) missing.push(item[1]);
        });
        return [{ state: (missing.length > 0) ? 'active' : 'healthy', detail: (missing.length > 0) ? ('Missing or placeholder identifiers: ' + missing.join(', ')) : 'Required hardware identifiers are present', variables: { identifiers: missing } }];
    },
    _test: { placeholders: placeholders }
};
