/*jshint node: true */
'use strict';

const securityCenter = require('../lib/security-center');

module.exports = {
    definition: { id: 'device.health.automaticUpdates', title: 'Automatic updates', group: 'Device health', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'coreinfo',
    evaluate: function (context) { return [securityCenter.evaluate(context.data && context.data.wsc, null, 'autoUpdate')]; }
};
