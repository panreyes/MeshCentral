/*jshint node: true */
/*jshint esversion: 6 */
'use strict';
module.exports = {
    definition: { id: 'device.security.unexpectedListeningPort', title: 'Unexpected listening port', group: 'Device security', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 }, source: 'telemetry',
    evaluate: function (context) {
        const allowed = context.settings && context.settings.unexpectedlisteningport && context.settings.unexpectedlisteningport.allowedports, ports = context.data && context.data.localSecurity && context.data.localSecurity.listeningPorts;
        if (!(context.settings && context.settings.unexpectedlisteningport && (context.settings.unexpectedlisteningport.enabled === true))) return context.isActive('') ? [{ state: 'healthy', detail: 'Listening port policy is disabled' }] : [];
        if (!Array.isArray(allowed) || !Array.isArray(ports)) return [];
        const unexpected = ports.filter(function (x) { return Number.isInteger(x) && (allowed.indexOf(x) < 0); });
        return [{ state: unexpected.length ? 'active' : 'healthy', detail: unexpected.length ? ('Unexpected listening TCP ports: ' + unexpected.join(', ')) : 'All listening TCP ports are allowed', variables: { unexpected: unexpected } }];
    }
};
module.exports.settings = { key: 'unexpectedlisteningport', fields: [["enabled","boolean",false],["allowedports","integers",[],1,65535,null,1024]] };
