/**
* @description Cross-platform storage inventory normalization for alerts
* @license Apache-2.0
*/

/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const values = require('./value');

function humanSizeToBytes(value) {
    if ((typeof value === 'number') && Number.isFinite(value) && (value >= 0)) return value;
    if (typeof value !== 'string') return null;
    const match = value.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*([KMGTPE]?)(?:I?B)?$/i);
    if (match == null) return null;
    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) return null;
    const exponent = ['', 'K', 'M', 'G', 'T', 'P', 'E'].indexOf(match[2].toUpperCase());
    return (exponent < 0) ? null : amount * Math.pow(1000, exponent);
}

function addVolume(result, platform, volume, totalBytes, freeBytes, identity) {
    if (!Number.isFinite(totalBytes) || !Number.isFinite(freeBytes) || (totalBytes <= 0) || (freeBytes < 0) || (freeBytes > totalBytes)) return;
    result.push({ instanceKey: values.instanceKey(platform, identity || volume), volume: volume, totalBytes: totalBytes, freeBytes: freeBytes, freePercent: (freeBytes * 100) / totalBytes });
}

function ignoredUnixVolume(volume) {
    if ((volume == null) || (typeof volume !== 'object') || (typeof volume.mount_point !== 'string') || (volume.mount_point.length === 0)) return true;
    const type = (typeof volume.type === 'string') ? volume.type.toLowerCase() : '';
    if (['tmpfs', 'devtmpfs', 'efivarfs', 'overlay', 'squashfs', 'proc', 'sysfs', 'cgroup', 'cgroup2', 'ramfs', 'fusectl', 'nfs', 'nfs4', 'cifs', 'smbfs', 'sshfs'].indexOf(type) >= 0) return true;
    return volume.mount_point.startsWith('/var/lib/docker/overlay2');
}

module.exports.normalizeVolumes = function (sysinfo) {
    const result = [], hardware = sysinfo && sysinfo.hardware;
    if ((hardware == null) || (typeof hardware !== 'object')) return result;

    const windowsVolumes = hardware.windows && hardware.windows.volumes;
    if ((windowsVolumes != null) && (typeof windowsVolumes === 'object') && !Array.isArray(windowsVolumes)) {
        for (var drive in windowsVolumes) {
            const volume = windowsVolumes[drive];
            if ((volume == null) || (typeof volume !== 'object') || (volume.removable === true) || (volume.cdrom === true)) continue;
            const driveType = values.finiteNumber(volume.dType);
            if ((driveType != null) && (driveType !== 3)) continue;
            const windowsDrive = /^[A-Za-z]$/.test(drive) ? drive.toUpperCase() : drive;
            addVolume(result, 'windows', /^[A-Za-z]$/.test(drive) ? (windowsDrive + ':') : drive, values.finiteNumber(volume.size), values.finiteNumber(volume.sizeremaining), windowsDrive);
        }
    }

    const linuxVolumes = hardware.linux && hardware.linux.volumes;
    if (Array.isArray(linuxVolumes)) {
        for (var linuxIndex = 0; linuxIndex < linuxVolumes.length; linuxIndex++) {
            const volume = linuxVolumes[linuxIndex];
            if (ignoredUnixVolume(volume)) continue;
            const total = values.finiteNumber(volume.size), free = values.finiteNumber(volume.available);
            addVolume(result, 'linux', volume.mount_point, (total == null) ? null : total * 1024, (free == null) ? null : free * 1024);
        }
    }

    const darwinVolumes = hardware.darwin && hardware.darwin.volumes;
    if (Array.isArray(darwinVolumes)) {
        for (var darwinIndex = 0; darwinIndex < darwinVolumes.length; darwinIndex++) {
            const volume = darwinVolumes[darwinIndex];
            if (ignoredUnixVolume(volume)) continue;
            addVolume(result, 'darwin', volume.mount_point, humanSizeToBytes(volume.size), humanSizeToBytes(volume.available));
        }
    }
    return result;
};

module.exports.formatBytes = function (bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    var value = bytes, unit = 0;
    while ((value >= 1024) && (unit < (units.length - 1))) { value /= 1024; unit++; }
    return value.toFixed((unit === 0) ? 0 : 1) + ' ' + units[unit];
};

module.exports._test = { finiteNumber: values.finiteNumber, humanSizeToBytes: humanSizeToBytes, ignoredUnixVolume: ignoredUnixVolume };
