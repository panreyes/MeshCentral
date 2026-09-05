/*jshint node: true */
/*jshint esversion: 6 */
'use strict';
module.exports = {
    definition: { id: 'device.network.gatewayUnreachable', title: 'Gateway unreachable', group: 'Device network', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 }, source: 'telemetry',
    evaluate: function (context) {
        const probes = context.data && context.data.networkProbes, output = [];
        if (!(context.settings && context.settings.gatewayunreachable && (context.settings.gatewayunreachable.enabled === true))) return context.getObservations().map(function (item) { context.removeObservation(item.instanceKey); return { instanceKey: item.instanceKey, state: 'healthy', detail: 'Gateway monitoring is disabled' }; });
        if (!Array.isArray(probes)) return output;
        probes.forEach(function (probe) { if (probe && (probe.gateway === true) && (typeof probe.target === 'string') && (typeof probe.reachable === 'boolean')) { context.setObservation(probe.target, { gateway: probe.target }); output.push({ instanceKey: probe.target, state: probe.reachable ? 'healthy' : 'active', detail: 'Gateway ' + probe.target + ' is ' + (probe.reachable ? 'reachable' : 'unreachable'), variables: { gateway: probe.target, reachable: probe.reachable } }); } });
        return output;
    }
};
