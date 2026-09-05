/*jshint node: true */
'use strict';

const values = require('../lib/value');

module.exports = {
    definition: { id: 'device.health.biosAge', title: 'BIOS age', group: 'Device health', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'sysinfo',
    evaluate: function (context) {
        const configured = context.settings && context.settings.biosage;
        const warningDays = ((configured != null) && (typeof configured.warningdays === 'number') && Number.isFinite(configured.warningdays) && (configured.warningdays >= 0)) ? configured.warningdays : 1825;
        const biosDate = context.data && context.data.hardware && context.data.hardware.identifiers && context.data.hardware.identifiers.bios_date;
        const timestamp = values.parseDate(biosDate), now = Date.now();
        if ((timestamp == null) || (timestamp > (now + 86400000)) || ((now - timestamp) > (36500 * 86400000))) return [];
        const ageDays = (now - timestamp) / 86400000;
        return [{ state: ((warningDays > 0) && (ageDays >= warningDays)) ? 'active' : 'healthy', detail: 'BIOS firmware is ' + Math.floor(ageDays) + ' days old' }];
    }
};
module.exports.settings = { key: 'biosage', fields: [["warningdays","number",1825,0,36500]] };
