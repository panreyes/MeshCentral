/*jshint node: true */
/*jshint esversion: 6 */
'use strict';
const values = require('../lib/value');
module.exports = {
    definition: { id: 'device.health.diskIoLatency', title: 'Disk I/O latency', group: 'Device health', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 }, source: 'telemetry',
    evaluate: function (context) {
        const x = context.settings && context.settings.diskiolatency, warning = (x && x.warningmilliseconds > 0) ? x.warningmilliseconds : 50, recovery = (x && x.recoverymilliseconds >= 0) ? x.recoverymilliseconds : 20, required = (x && Number.isInteger(x.consecutivesamples) && x.consecutivesamples > 0) ? x.consecutivesamples : 3, disks = context.data && context.data.diskIo, output = [];
        if (!(x && (x.enabled === true))) return context.getObservations().map(function (item) { context.removeObservation(item.instanceKey); return { instanceKey: item.instanceKey, state: 'healthy', detail: 'Disk latency monitoring is disabled' }; });
        if (!Array.isArray(disks)) return output;
        disks.forEach(function (disk, index) {
            const read = Number(disk && disk.readMs), write = Number(disk && disk.writeMs);
            if (!Number.isFinite(read) || !Number.isFinite(write) || (read < 0) || (write < 0)) return;
            const name = (typeof disk.name === 'string') ? disk.name : String(index), key = values.instanceKey('disk-io', name), latency = Math.max(read, write), observation = context.getObservation(key) || { highCount: 0 };
            observation.highCount = (latency >= warning) ? ((Number(observation.highCount) || 0) + 1) : 0; context.setObservation(key, observation);
            var state = 'unknown'; if (latency <= recovery) state = 'healthy'; else if (observation.highCount >= required) state = 'active'; else if (context.isActive(key)) state = 'active';
            output.push({ instanceKey: key, state: state, detail: name + ': read ' + read.toFixed(1) + ' ms, write ' + write.toFixed(1) + ' ms', variables: { disk: name, readMs: read, writeMs: write } });
        });
        return output;
    }
};
module.exports.settings = { key: 'diskiolatency', fields: [["enabled","boolean",false],["warningmilliseconds","number",50,0.01,60000],["recoverymilliseconds","number",20,0,60000],["consecutivesamples","integer",3,1,100]], validate: function (values) { if (values.warningmilliseconds <= values.recoverymilliseconds) return 'Invalid thresholds in diskiolatency'; } };
