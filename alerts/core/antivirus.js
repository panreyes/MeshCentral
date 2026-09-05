/*jshint node: true */
'use strict';

const securityCenter = require('../lib/security-center');

module.exports = {
    definition: { id: 'device.health.antivirus', title: 'Antivirus protection', group: 'Device health', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'coreinfo',
    evaluate: function (context) { return [securityCenter.evaluate(context.data && context.data.wsc, context.data && context.data.lsc, 'antiVirus')]; }
};
