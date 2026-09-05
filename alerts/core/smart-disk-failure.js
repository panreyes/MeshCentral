/*jshint node: true */
/*jshint esversion: 6 */
'use strict';
const values = require('../lib/value');
module.exports = {
    definition: { id: 'device.health.smartDiskFailure', title: 'SMART disk failure', group: 'Device health', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'critical', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 }, source: 'telemetry',
    evaluate: function (context) {
        if (!(context.settings && context.settings.smartdiskfailure && (context.settings.smartdiskfailure.enabled === true))) return context.getObservations().map(function (item) { context.removeObservation(item.instanceKey); return { instanceKey: item.instanceKey, state: 'healthy', detail: 'SMART monitoring is disabled' }; });
        const disks = context.data && context.data.storageHealth, output = [];
        if (!Array.isArray(disks)) return output;
        disks.forEach(function (disk, index) {
            if ((disk == null) || (typeof disk !== 'object') || (typeof disk.healthy !== 'boolean')) return;
            const name = (typeof disk.name === 'string') ? disk.name : String(index), key = values.instanceKey('smart', name);
            context.setObservation(key, { name: name }); output.push({ instanceKey: key, state: disk.healthy ? 'healthy' : 'active', detail: name + ': ' + (disk.healthy ? 'storage health is healthy' : ('storage health is ' + (disk.status || 'unhealthy'))), variables: { disk: name, status: disk.status || '' } });
        });
        return output;
    }
};
