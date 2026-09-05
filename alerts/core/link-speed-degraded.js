/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const values = require('../lib/value');

function settings(all) {
    const x = all && all.linkspeeddegraded;
    var ratioPercent = 50, recoveryPercent = 80, minimumBaselineMbps = 100;
    if (x && (typeof x === 'object')) {
        if ((typeof x.ratiopercent === 'number') && (x.ratiopercent > 0) && (x.ratiopercent < 100)) ratioPercent = x.ratiopercent;
        if ((typeof x.recoverypercent === 'number') && (x.recoverypercent > 0) && (x.recoverypercent <= 100)) recoveryPercent = x.recoverypercent;
        if ((typeof x.minimumbaselinembps === 'number') && (x.minimumbaselinembps >= 0)) minimumBaselineMbps = x.minimumbaselinembps;
    }
    if (recoveryPercent <= ratioPercent) recoveryPercent = Math.min(100, ratioPercent + 20);
    return { ratioPercent: ratioPercent, recoveryPercent: recoveryPercent, minimumBaselineMbps: minimumBaselineMbps };
}

function links(data) {
    const result = {}, netif2 = data && data.netif2;
    if ((netif2 == null) || (typeof netif2 !== 'object') || Array.isArray(netif2)) return result;
    for (var name in netif2) {
        if (!Array.isArray(netif2[name])) continue;
        for (var i = 0; i < netif2[name].length; i++) {
            const layer = netif2[name][i], speed = Number(layer && layer.speed);
            if (!Number.isFinite(speed) || (speed <= 0)) continue;
            const identity = ((typeof layer.mac === 'string') && layer.mac) ? layer.mac : name;
            const key = values.instanceKey('link', identity);
            if ((result[key] == null) || (speed > result[key].speed)) result[key] = { name: name, speed: speed };
        }
    }
    return result;
}

module.exports = {
    definition: { id: 'device.network.linkSpeedDegraded', title: 'Link speed degraded', group: 'Device network', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'netinfo',
    evaluate: function (context) {
        const current = links(context.data), limits = settings(context.settings), output = [], seen = {};
        for (var instanceKey in current) {
            const link = current[instanceKey], currentMbps = link.speed / 1000000;
            var observation = context.getObservation(instanceKey) || { baseline: link.speed };
            if (!Number.isFinite(observation.baseline) || (link.speed > observation.baseline)) observation.baseline = link.speed;
            observation.name = link.name;
            context.setObservation(instanceKey, observation);
            seen[instanceKey] = true;
            if ((observation.baseline / 1000000) < limits.minimumBaselineMbps) { output.push({ instanceKey: instanceKey, state: 'unknown' }); continue; }
            const ratio = (link.speed * 100) / observation.baseline;
            var state = 'unknown';
            if (ratio <= limits.ratioPercent) state = 'active';
            else if (ratio >= limits.recoveryPercent) state = 'healthy';
            else if (context.isActive(instanceKey)) state = 'active';
            output.push({ instanceKey: instanceKey, state: state, detail: link.name + ' negotiated ' + currentMbps.toFixed(0) + ' Mbps; learned baseline is ' + (observation.baseline / 1000000).toFixed(0) + ' Mbps', variables: { currentMbps: Number(currentMbps.toFixed(1)), baselineMbps: Number((observation.baseline / 1000000).toFixed(1)) } });
        }
        context.getObservations().forEach(function (item) { if (seen[item.instanceKey] !== true) output.push({ instanceKey: item.instanceKey, state: 'unknown' }); });
        return output;
    },
    _test: { settings: settings, links: links }
};
module.exports.settings = { key: 'linkspeeddegraded', fields: [["ratiopercent","number",50,0.01,99.99],["recoverypercent","number",80,0.01,100],["minimumbaselinembps","number",100,0,10000000]], validate: function (values) { if (values.recoverypercent <= values.ratiopercent) return 'Invalid thresholds in linkspeeddegraded'; } };
