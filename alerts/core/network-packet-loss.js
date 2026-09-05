/*jshint node: true */
/*jshint esversion: 6 */
'use strict';
module.exports = {
    definition: { id: 'device.health.networkPacketLoss', title: 'Network packet loss', group: 'Device health', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 }, source: 'telemetry',
    evaluate: function (context) {
        const x = context.settings && context.settings.networkpacketloss, targets = x && x.targets, warning = (x && x.warningpercent > 0) ? x.warningpercent : 25, recovery = (x && x.recoverypercent >= 0) ? x.recoverypercent : 5, probes = context.data && context.data.networkProbes, output = [];
        if (!Array.isArray(targets) || (targets.length === 0)) return context.getObservations().map(function (item) { context.removeObservation(item.instanceKey); return { instanceKey: item.instanceKey, state: 'healthy', detail: 'Packet-loss monitoring is disabled' }; });
        if (!Array.isArray(probes)) return output;
        probes.forEach(function (probe) {
            const loss = Number(probe && probe.lossPercent), target = probe && probe.target;
            if ((typeof target !== 'string') || (targets.indexOf(target) < 0) || !Number.isFinite(loss) || (loss < 0) || (loss > 100) || (probe.gateway === true)) return;
            context.setObservation(target, { target: target });
            var state = 'unknown'; if (loss >= warning) state = 'active'; else if (loss <= recovery) state = 'healthy'; else if (context.isActive(target)) state = 'active';
            output.push({ instanceKey: target, state: state, detail: target + ': ' + loss.toFixed(1) + '% packet loss', variables: { target: target, lossPercent: loss } });
        });
        return output;
    }
};
