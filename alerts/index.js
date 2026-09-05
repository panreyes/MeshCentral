/**
* @description Built-in MeshCentral alert module registry
* @license Apache-2.0
*/

/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

const fs = require('fs');
const path = require('path');
const network = require('./lib/network');
const hardwareIdentity = require('./lib/hardware-identity');
const coreDirectory = path.join(__dirname, 'core');
const moduleFiles = fs.readdirSync(coreDirectory).filter(function (filename) { return /^[a-z0-9][a-z0-9-]*\.js$/.test(filename); }).sort();
const modules = moduleFiles.map(function (filename) { return require(path.join(coreDirectory, filename)); });

function validateModule(alertModule) {
    if ((alertModule == null) || (typeof alertModule !== 'object') || (alertModule.definition == null) || (typeof alertModule.definition !== 'object')) return false;
    if ((typeof alertModule.definition.id !== 'string') || (['event', 'state'].indexOf(alertModule.definition.kind) < 0)) return false;
    if (!validateSettings(alertModule.settings)) return false;
    if (alertModule.definition.kind === 'event') {
        if (alertModule.source == null) return (alertModule.evaluate == null);
        return ((['coreinfo', 'sysinfo', 'connectivity', 'netinfo', 'node', 'inventory', 'telemetry'].indexOf(alertModule.source) >= 0) && (typeof alertModule.evaluate === 'function'));
    }
    return ((['coreinfo', 'sysinfo', 'connectivity', 'netinfo', 'node', 'inventory', 'telemetry'].indexOf(alertModule.source) >= 0) && (typeof alertModule.evaluate === 'function'));
}

function validateSettings(settings) {
    if (settings == null) return true;
    if ((typeof settings !== 'object') || (typeof settings.key !== 'string') || !/^[a-z][a-z0-9]{0,63}$/.test(settings.key) || !Array.isArray(settings.fields) || ((settings.validate != null) && (typeof settings.validate !== 'function'))) return false;
    const names = {}, types = ['boolean', 'number', 'integer', 'time', 'enum', 'string', 'strings', 'integers', 'multienum', 'rules'];
    for (var i = 0; i < settings.fields.length; i++) {
        const field = settings.fields[i];
        if (!Array.isArray(field) || (typeof field[0] !== 'string') || !/^[a-z][a-z0-9]{0,63}$/.test(field[0]) || (names[field[0]] === true) || (types.indexOf(field[1]) < 0)) return false;
        names[field[0]] = true;
    }
    return true;
}

const ids = {}, settingPaths = {};
for (var i = 0; i < modules.length; i++) {
    if (!validateModule(modules[i])) throw new Error('Invalid core alert module at index ' + i + '.');
    if (ids[modules[i].definition.id] === true) throw new Error('Duplicate core alert type: ' + modules[i].definition.id);
    ids[modules[i].definition.id] = true;
    if (modules[i].settings != null) {
        for (var settingIndex = 0; settingIndex < modules[i].settings.fields.length; settingIndex++) {
            const settingPath = modules[i].settings.key + '.' + modules[i].settings.fields[settingIndex][0];
            if (settingPaths[settingPath] === true) throw new Error('Duplicate core alert setting: ' + settingPath);
            settingPaths[settingPath] = true;
        }
    }
}

module.exports.getModules = function () { return modules.slice(); };
module.exports.getBySource = function (source) { return modules.filter(function (alertModule) { return alertModule.source === source; }); };
module.exports.networkIdentities = network.identities;
module.exports.hardwareIdentities = hardwareIdentity.identities;
module.exports._test = { validateModule: validateModule, validateSettings: validateSettings };
