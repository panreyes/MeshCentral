/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const network = require('../lib/network');

module.exports = {
    definition: { id: 'device.network.configurationChanged', title: 'Network configuration changed', group: 'Device network', kind: 'event', channels: ['web', 'email', 'messaging'], severity: 'info', requiredRight: 0x00100000 },
    source: 'netinfo',
    evaluate: function (context) {
        const configured = context.settings && context.settings.networkconfigurationchanged;
        if ((configured == null) || (configured.enabled !== true) || (context.previousData == null)) return [];
        const previous = network.snapshot(context.previousData), current = network.snapshot(context.data);
        if ((previous.length === 0) || (current.length === 0) || (JSON.stringify(previous) === JSON.stringify(current))) return [];
        return [{ detail: 'Network interfaces, addresses or gateways changed', variables: { previous: previous.slice(0, 20), current: current.slice(0, 20) } }];
    }
};
