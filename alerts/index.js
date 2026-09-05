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
    if (alertModule.definition.kind === 'event') {
        if (alertModule.source == null) return (alertModule.evaluate == null);
        return ((['coreinfo', 'sysinfo', 'connectivity', 'netinfo', 'node', 'inventory', 'telemetry'].indexOf(alertModule.source) >= 0) && (typeof alertModule.evaluate === 'function'));
    }
    return ((['coreinfo', 'sysinfo', 'connectivity', 'netinfo', 'node', 'inventory', 'telemetry'].indexOf(alertModule.source) >= 0) && (typeof alertModule.evaluate === 'function'));
}

const ids = {};
for (var i = 0; i < modules.length; i++) {
    if (!validateModule(modules[i])) throw new Error('Invalid core alert module at index ' + i + '.');
    if (ids[modules[i].definition.id] === true) throw new Error('Duplicate core alert type: ' + modules[i].definition.id);
    ids[modules[i].definition.id] = true;
}

module.exports.getModules = function () { return modules.slice(); };
module.exports.getBySource = function (source) { return modules.filter(function (alertModule) { return alertModule.source === source; }); };
module.exports.networkIdentities = network.identities;
module.exports.hardwareIdentities = hardwareIdentity.identities;
module.exports._test = { validateModule: validateModule };
