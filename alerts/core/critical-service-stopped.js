/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

function configuredServices(settings) {
    const list = settings && settings.criticalservicestopped && settings.criticalservicestopped.services;
    return Array.isArray(list) ? list.filter(function (x) { return (typeof x === 'string') && (x.length > 0); }).slice(0, 64) : [];
}

module.exports = {
    definition: { id: 'device.health.criticalServiceStopped', title: 'Critical service stopped', group: 'Device health', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'telemetry',
    evaluate: function (context) {
        const configured = configuredServices(context.settings), reported = context.data && context.data.services, output = [];
        if (configured.length === 0) {
            context.getObservations().forEach(function (item) { context.removeObservation(item.instanceKey); if (context.isActive(item.instanceKey)) output.push({ instanceKey: item.instanceKey, state: 'healthy', detail: 'Critical service monitoring is disabled' }); });
            return output;
        }
        if (!Array.isArray(reported)) return output;
        const byName = {};
        reported.forEach(function (x) { if (x && (typeof x.name === 'string') && (typeof x.running === 'boolean')) byName[x.name.toLowerCase()] = x; });
        configured.forEach(function (name) {
            const service = byName[name.toLowerCase()];
            if (service == null) return;
            const instanceKey = name.toLowerCase();
            context.setObservation(instanceKey, { name: name });
            output.push({ instanceKey: instanceKey, state: service.running ? 'healthy' : 'active', detail: name + ' is ' + (service.running ? 'running' : 'stopped'), variables: { service: name, running: service.running } });
        });
        return output;
    },
    _test: { configuredServices: configuredServices }
};
module.exports.settings = { key: 'criticalservicestopped', fields: [["services","strings",[],null,null,null,64]] };
