/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const values = require('../lib/value');

function settings(all) {
    var windowMinutes = 60, rebootCount = 3, recoveryMinutes = 120;
    const x = all && all.rebootloop;
    if (x && (typeof x === 'object')) {
        if ((typeof x.windowminutes === 'number') && Number.isFinite(x.windowminutes) && (x.windowminutes > 0)) windowMinutes = x.windowminutes;
        if (Number.isInteger(x.rebootcount) && (x.rebootcount >= 2)) rebootCount = x.rebootcount;
        if ((typeof x.recoveryminutes === 'number') && Number.isFinite(x.recoveryminutes) && (x.recoveryminutes > 0)) recoveryMinutes = x.recoveryminutes;
    }
    return { windowMinutes: windowMinutes, rebootCount: rebootCount, recoveryMinutes: recoveryMinutes };
}

function bootTime(data) {
    const hardware = data && data.hardware;
    if (!hardware) return null;
    if (hardware.windows && hardware.windows.osinfo) return values.parseDate(hardware.windows.osinfo.LastBootUpTime, 'windows');
    if (hardware.linux) return values.parseDate(hardware.linux.LastBootUpTime, 'linux');
    if (hardware.darwin) return values.parseDate(hardware.darwin.LastBootUpTime, 'darwin');
    return null;
}

module.exports = {
    definition: { id: 'device.health.rebootLoop', title: 'Repeated device reboots', group: 'Device health', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'sysinfo', periodic: true,
    evaluate: function (context) {
        const limits = settings(context.settings), now = Date.now(), cutoff = now - (limits.windowMinutes * 60000);
        var observation = context.getObservation('') || { bootTime: null, transitions: [] };
        observation.transitions = Array.isArray(observation.transitions) ? observation.transitions.filter(function (x) { return (typeof x === 'number') && (x >= cutoff) && (x <= now); }) : [];
        if (!context.periodic) {
            const currentBoot = bootTime(context.data);
            if ((currentBoot == null) || (currentBoot > now)) return [];
            if ((typeof observation.bootTime === 'number') && (currentBoot > (observation.bootTime + 60000))) observation.transitions.push(now);
            observation.bootTime = currentBoot;
            if (observation.transitions.length > 100) observation.transitions = observation.transitions.slice(-100);
            context.setObservation('', observation);
        } else if (observation.bootTime == null) return [];
        const last = (observation.transitions.length > 0) ? observation.transitions[observation.transitions.length - 1] : null;
        if (context.isActive('') && (last != null) && ((now - last) >= (limits.recoveryMinutes * 60000))) return [{ state: 'healthy', detail: 'No reboot detected for ' + limits.recoveryMinutes + ' minutes' }];
        if (observation.transitions.length >= limits.rebootCount) return [{ state: 'active', detail: observation.transitions.length + ' reboots detected within ' + limits.windowMinutes + ' minutes', variables: { rebootCount: observation.transitions.length, lastReboot: last } }];
        return [{ state: 'unknown' }];
    },
    _test: { settings: settings, bootTime: bootTime }
};
