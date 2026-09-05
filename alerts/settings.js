/**
* @description Global database-backed settings for the MeshCentral alert engine
* @license Apache-2.0
*/

/*jshint node: true */
/*jshint strict: false */
"use strict";

const VERSION = 1;
const DOCUMENT_ID = 'alertSettings';

// path, type, default, minimum, maximum, options, maximum items
// Settings used by the engine itself. Check-specific fields are declared by
// each module in alerts/core.
const BASE_FIELDS = [
    ['remindersenabled', 'boolean', true, null, null, null, null, 'General'],
    ['remindertime', 'time', '10:00', null, null, null, null, 'General']
];

function getFields(modules) {
    const fields = BASE_FIELDS.map(function (field) { return field.slice(); });
    if (!Array.isArray(modules)) return fields;
    for (var moduleIndex = 0; moduleIndex < modules.length; moduleIndex++) {
        const alertModule = modules[moduleIndex], proposal = alertModule && alertModule.settings;
        if ((proposal == null) || (typeof proposal !== 'object') || (typeof proposal.key !== 'string') || !Array.isArray(proposal.fields)) continue;
        for (var fieldIndex = 0; fieldIndex < proposal.fields.length; fieldIndex++) {
            const source = proposal.fields[fieldIndex];
            if (!Array.isArray(source) || (typeof source[0] !== 'string')) continue;
            const field = source.slice();
            field[0] = proposal.key + '.' + field[0];
            field[7] = alertModule.definition.title;
            fields.push(field);
        }
    }
    return fields;
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function humanize(value) {
    const words = ['configuration', 'administrator', 'architectures', 'consecutive', 'requirements', 'virtualization', 'identifiers', 'temperature', 'membership', 'removable', 'unexpected', 'listening', 'password', 'hardware', 'software', 'security', 'critical', 'sustained', 'automatic', 'installed', 'milliseconds', 'minimum', 'maximum', 'recovery', 'warning', 'baseline', 'gigabytes', 'transition', 'duration', 'reminders', 'reminder', 'seconds', 'minutes', 'cycles', 'samples', 'windows', 'darwin', 'linux', 'allowed', 'prohibited', 'services', 'targets', 'required', 'require', 'enabled', 'percent', 'version', 'domains', 'storage', 'network', 'gateway', 'desktop', 'exposed', 'account', 'changed', 'duplicate', 'identity', 'inventory', 'offline', 'reboot', 'encryption', 'forecast', 'exhaustion', 'packet', 'secure', 'privilege', 'battery', 'memory', 'disk', 'space', 'clock', 'drift', 'uptime', 'lockout', 'build', 'rules', 'days', 'hours', 'time', 'count', 'length', 'threshold', 'ports', 'check', 'expected', 'physical', 'span', 'ratio', 'speed', 'local', 'domain', 'trust', 'failure', 'celsius', 'horizon', 'window', 'allow', 'uefi', 'rdp', 'ssh', 'mbps', 'cpu', 'tpm', 'dns', 'bios', 'io', 'age'].sort(function (a, b) { return b.length - a.length; });
    const tokens = [];
    for (var position = 0; position < value.length;) {
        var match = null;
        for (var wordIndex = 0; wordIndex < words.length; wordIndex++) { if (value.startsWith(words[wordIndex], position)) { match = words[wordIndex]; break; } }
        if (match == null) { match = value.substring(position); position = value.length; } else { position += match.length; }
        tokens.push(({ cpu: 'CPU', tpm: 'TPM', dns: 'DNS', bios: 'BIOS', io: 'I/O', rdp: 'RDP', ssh: 'SSH', uefi: 'UEFI', mbps: 'Mbps' })[match] || match);
    }
    const output = tokens.join(' ');
    return output.replace(/^./, function (x) { return x.toUpperCase(); });
}
function getPath(object, path) { const parts = path.split('.'); for (var i = 0; (object != null) && (i < parts.length); i++) object = object[parts[i]]; return object; }
function setPath(object, path, value) { const parts = path.split('.'); for (var i = 0; i < (parts.length - 1); i++) { if ((object[parts[i]] == null) || (typeof object[parts[i]] !== 'object') || Array.isArray(object[parts[i]])) object[parts[i]] = {}; object = object[parts[i]]; } object[parts[parts.length - 1]] = value; }

function normalizeField(field, value) {
    const type = field[1], min = field[3], max = field[4], options = field[5], maxItems = field[6] || 128;
    if (value == null) return (field[2] == null) ? undefined : clone(field[2]);
    if (type === 'boolean') return (typeof value === 'boolean') ? value : undefined;
    if ((type === 'number') || (type === 'integer')) {
        if ((typeof value !== 'number') || !Number.isFinite(value) || ((type === 'integer') && !Number.isInteger(value)) || ((min != null) && (value < min)) || ((max != null) && (value > max))) return undefined;
        return value;
    }
    if (type === 'time') return ((typeof value === 'string') && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value)) ? value : undefined;
    if (type === 'enum') return ((typeof value === 'string') && (options.indexOf(value) >= 0)) ? value : undefined;
    if (type === 'string') return ((typeof value === 'string') && (value.length <= 128)) ? value : undefined;
    if ((type === 'strings') || (type === 'multienum')) {
        if (!Array.isArray(value) || (value.length > maxItems)) return undefined;
        const result = [];
        for (var i = 0; i < value.length; i++) { if ((typeof value[i] !== 'string') || (value[i].length < 1) || (value[i].length > 255) || ((options != null) && (options.indexOf(value[i]) < 0)) || (result.indexOf(value[i]) >= 0)) return undefined; result.push(value[i]); }
        return result;
    }
    if (type === 'integers') {
        if (!Array.isArray(value) || (value.length > maxItems)) return undefined;
        const integers = [];
        for (var j = 0; j < value.length; j++) { if (!Number.isInteger(value[j]) || (value[j] < min) || (value[j] > max) || (integers.indexOf(value[j]) >= 0)) return undefined; integers.push(value[j]); }
        return integers;
    }
    if (type === 'rules') {
        if (!Array.isArray(value) || (value.length > maxItems)) return undefined;
        const rules = [];
        for (var k = 0; k < value.length; k++) {
            const rule = value[k];
            if ((rule == null) || (typeof rule !== 'object') || Array.isArray(rule) || (['windows', 'linux', 'darwin'].indexOf(rule.platform) < 0) || (typeof rule.match !== 'string') || (rule.match.length < 1) || (rule.match.length > 128) || (typeof rule.endoflife !== 'string') || !/^\d{4}-\d{2}-\d{2}$/.test(rule.endoflife)) return undefined;
            const warningdays = (rule.warningdays == null) ? 90 : rule.warningdays;
            if ((typeof warningdays !== 'number') || !Number.isFinite(warningdays) || (warningdays < 0) || (warningdays > 36500)) return undefined;
            rules.push({ platform: rule.platform, match: rule.match, endoflife: rule.endoflife, warningdays: warningdays });
        }
        return rules;
    }
}

function normalize(input, useDefaults, modules) {
    const output = {}, errors = [];
    const fields = getFields(modules);
    if ((input == null) || (typeof input !== 'object') || Array.isArray(input)) return { settings: defaults(modules), errors: ['Invalid settings'] };
    const known = fields.map(function (field) { return field[0]; });
    const inspect = function (value, path) {
        if ((value != null) && (typeof value === 'object') && !Array.isArray(value)) {
            for (var key in value) {
                const childPath = (path.length === 0) ? key : (path + '.' + key);
                if ((known.indexOf(childPath) < 0) && !known.some(function (knownPath) { return knownPath.startsWith(childPath + '.'); })) errors.push(childPath); else inspect(value[key], childPath);
            }
        }
    };
    inspect(input, '');
    for (var i = 0; i < fields.length; i++) {
        const field = fields[i], supplied = getPath(input, field[0]);
        if ((supplied == null) && (useDefaults !== true)) continue;
        const value = normalizeField(field, supplied);
        if ((value === undefined) && (supplied != null)) errors.push(field[0]); else if (value !== undefined) setPath(output, field[0], value);
    }
    return { settings: output, errors: errors };
}

function defaults(modules) { return normalize({}, true, modules).settings; }

function definitions(modules) {
    return getFields(modules).map(function (field) {
        const parts = field[0].split('.'), result = { path: field[0], group: field[7] || humanize(parts.length > 1 ? parts[0] : 'general'), label: humanize(parts[parts.length - 1]), type: field[1], default: clone(field[2]) };
        if (field[3] != null) result.min = field[3]; if (field[4] != null) result.max = field[4]; if (field[5] != null) result.options = clone(field[5]); if (field[6] != null) result.maxItems = field[6];
        return result;
    });
}

module.exports = { VERSION: VERSION, DOCUMENT_ID: DOCUMENT_ID, defaults: defaults, definitions: definitions, normalize: normalize, clone: clone, _test: { getFields: getFields } };
