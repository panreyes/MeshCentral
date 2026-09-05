/*jshint node: true */
'use strict';

const values = require('../lib/value');

module.exports = {
    definition: { id: 'device.compliance.osBuild', title: 'Operating system version', group: 'Device compliance', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0x00100000 },
    source: 'sysinfo',
    evaluate: function (context) {
        const configured = context.settings && context.settings.osbuild, hardware = context.data && context.data.hardware;
        if ((configured == null) || (typeof configured !== 'object') || (hardware == null)) return [];
        var current, minimum, platform;
        if (hardware.windows && hardware.windows.osinfo && (typeof configured.minimumwindowsbuild === 'string')) {
            platform = 'Windows'; minimum = configured.minimumwindowsbuild;
            const osinfo = hardware.windows.osinfo, minimumParts = minimum.match(/\d+/g);
            if ((minimumParts != null) && (minimumParts.length <= 2)) {
                current = osinfo.BuildNumber;
                if ((current == null) && (typeof osinfo.BuildRevision === 'string')) {
                    const currentParts = osinfo.BuildRevision.match(/\d+/g);
                    if ((currentParts != null) && (currentParts.length >= 3)) current = currentParts.slice(2).join('.');
                }
            } else {
                current = osinfo.BuildRevision || osinfo.Version;
            }
        } else if (hardware.linux && (typeof configured.minimumlinuxkernel === 'string')) {
            platform = 'Linux'; minimum = configured.minimumlinuxkernel; current = hardware.linux.kernel_release;
        } else { return []; }
        if (typeof current !== 'string') current = (typeof current === 'number') ? String(current) : null;
        const comparison = values.compareVersions(current, minimum);
        if (comparison == null) return [{ state: 'unknown' }];
        return [{ state: (comparison < 0) ? 'active' : 'healthy', detail: platform + ' version ' + current + ((comparison < 0) ? ' is below required version ' : ' meets required version ') + minimum }];
    }
};
