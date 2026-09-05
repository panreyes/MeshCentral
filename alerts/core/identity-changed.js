/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const identityFields = {
    product_uuid: 'product UUID',
    board_serial: 'board serial number',
    bios_serial: 'BIOS serial number',
    chassis_serial: 'chassis serial number'
};

function identity(data) {
    const identifiers = data && data.hardware && data.hardware.identifiers;
    if ((identifiers == null) || (typeof identifiers !== 'object')) return null;
    const result = {};
    for (var key in identityFields) {
        if ((typeof identifiers[key] === 'string') && (identifiers[key].trim().length > 0)) result[key] = identifiers[key].trim();
    }
    return result;
}

module.exports = {
    definition: { id: 'device.inventory.identityChanged', title: 'Device identity changed', group: 'Device inventory', kind: 'event', channels: ['web', 'email', 'messaging'], severity: 'warning', requiredRight: 0x00100000 },
    source: 'sysinfo',
    evaluate: function (context) {
        const configured = context.settings && context.settings.identitychanged;
        if ((configured != null) && (configured.enabled === false)) return [];
        const previous = identity(context.previousData), current = identity(context.data);
        if ((previous == null) || (current == null)) return [];
        const changed = [];
        for (var key in identityFields) {
            if ((previous[key] != null) && (current[key] != null) && (previous[key] !== current[key])) changed.push(identityFields[key]);
        }
        if (changed.length === 0) return [];
        return [{ detail: 'Device identity changed: ' + changed.join(', '), variables: { changed: changed } }];
    },
    _test: { identity: identity }
};
