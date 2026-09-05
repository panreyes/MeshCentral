/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

function devices(data) {
    const volumes = data && data.hardware && data.hardware.windows && data.hardware.windows.volumes, result = {};
    if ((volumes == null) || (typeof volumes !== 'object') || Array.isArray(volumes)) return result;
    for (var drive in volumes) {
        const volume = volumes[drive];
        if ((volume == null) || (typeof volume !== 'object') || (volume.cdrom === true) || !((volume.removable === true) || (Number(volume.dType) === 2))) continue;
        const identity = (typeof volume.identifier === 'string') ? volume.identifier : drive.toUpperCase();
        result[identity] = { drive: drive, name: (typeof volume.name === 'string') ? volume.name : '' };
    }
    return result;
}

module.exports = {
    definition: { id: 'device.security.removableStorageDetected', title: 'Removable storage detected', group: 'Device security', kind: 'event', channels: ['web', 'email', 'messaging'], severity: 'warning', requiredRight: 0x00100000 },
    source: 'sysinfo',
    evaluate: function (context) {
        const configured = context.settings && context.settings.removablestoragedetected;
        if ((configured == null) || (configured.enabled !== true) || (context.previousData == null)) return [];
        const previous = devices(context.previousData), current = devices(context.data), output = [];
        for (var identity in current) {
            if (previous[identity] != null) continue;
            output.push({ detail: 'Removable storage appeared on ' + current[identity].drive + (current[identity].name ? (': ' + current[identity].name) : ''), variables: { drive: current[identity].drive, name: current[identity].name } });
        }
        return output;
    },
    _test: { devices: devices }
};
module.exports.settings = { key: 'removablestoragedetected', fields: [["enabled","boolean",false]] };
