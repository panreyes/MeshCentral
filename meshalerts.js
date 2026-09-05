/**
* @description MeshCentral extensible alert and notification engine
* @license Apache-2.0
*/

/*jshint node: true */
/*jshint strict: false */
/*jshint esversion: 6 */
"use strict";

const crypto = require('crypto');
const coreAlertModules = require('./alerts');

const POLICY_VERSION = 1;
const TYPE_ID_RE = /^[a-z0-9][A-Za-z0-9._-]{0,127}$/;
const PLUGIN_NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const CHANNELS = ['web', 'email', 'messaging'];

function clone(value) { return (value === undefined) ? undefined : JSON.parse(JSON.stringify(value)); }

function stateId(nodeid, alertType, instanceKey) {
    const hash = crypto.createHash('sha384').update(nodeid + '\0' + alertType + '\0' + (instanceKey || '')).digest('base64url');
    return 'alertState/' + hash;
}

function observationId(nodeid, alertType, instanceKey) {
    const hash = crypto.createHash('sha384').update(nodeid + '\0' + alertType + '\0' + (instanceKey || '')).digest('base64url');
    return 'alertObservation/' + hash;
}

function policyId(userid) {
    return 'notificationPolicy/' + crypto.createHash('sha384').update(userid).digest('base64url');
}

function findRule(policy, scope, scopeId, alertType) {
    if ((policy == null) || !Array.isArray(policy.rules)) return null;
    for (var i = 0; i < policy.rules.length; i++) {
        const rule = policy.rules[i];
        if ((rule == null) || (typeof rule !== 'object') || (rule.channels == null) || (typeof rule.channels !== 'object')) continue;
        if ((rule.scope === scope) && (rule.alertType === alertType) && (((scope === 'account') && (rule.scopeId == null)) || (rule.scopeId === scopeId))) return rule;
    }
    return null;
}

function resolveChannel(policy, meshid, nodeid, alertType, channel) {
    var rule = findRule(policy, 'node', nodeid, alertType);
    if ((rule != null) && (typeof rule.channels[channel] == 'boolean')) return rule.channels[channel];
    rule = findRule(policy, 'mesh', meshid, alertType);
    if ((rule != null) && (typeof rule.channels[channel] == 'boolean')) return rule.channels[channel];
    rule = findRule(policy, 'account', null, alertType);
    if ((rule != null) && (typeof rule.channels[channel] == 'boolean')) return rule.channels[channel];
    return false;
}

function isIgnored(policy, nodeid, alertType) {
    if ((policy == null) || !Array.isArray(policy.ignored)) return false;
    for (var i = 0; i < policy.ignored.length; i++) {
        if ((policy.ignored[i] != null) && (policy.ignored[i].nodeid === nodeid) && (policy.ignored[i].alertType === alertType)) return true;
    }
    return false;
}

function legacyRule(scope, scopeId, alertType, channels) {
    const rule = { scope: scope, alertType: alertType, channels: channels };
    if (scope !== 'account') { rule.scopeId = scopeId; }
    return rule;
}

function migrateLegacyPolicy(user, accountMask) {
    const policy = { version: POLICY_VERSION, rules: [], ignored: [] };
    const addMask = function (scope, scopeId, mask) {
        if (typeof mask !== 'number') return;
        const rules = (scope === 'account') ? [
            ['device.connection.connected', { web: ((mask & 2) !== 0) }],
            ['device.connection.disconnected', { web: ((mask & 4) !== 0) }],
            ['device.amt.session', { web: ((mask & 8) !== 0) }]
        ] : [
            ['device.connection.connected', { web: ((mask & 2) !== 0), email: ((mask & 16) !== 0), messaging: ((mask & 128) !== 0) }],
            ['device.connection.disconnected', { web: ((mask & 4) !== 0), email: ((mask & 32) !== 0), messaging: ((mask & 256) !== 0) }],
            ['device.help.requested', { email: ((mask & 64) !== 0), messaging: ((mask & 512) !== 0) }],
            ['device.amt.session', { web: ((mask & 8) !== 0) }]
        ];
        for (var i = 0; i < rules.length; i++) {
            const enabled = {};
            for (var channel in rules[i][1]) { if (rules[i][1][channel] === true) { enabled[channel] = true; } }
            if (Object.keys(enabled).length > 0) { policy.rules.push(legacyRule(scope, scopeId, rules[i][0], enabled)); }
        }
    };

    addMask('account', null, accountMask);
    const meshMasks = {};
    if ((user != null) && (user.links != null)) {
        for (var id in user.links) {
            if (id.startsWith('mesh/') && (user.links[id] != null) && (typeof user.links[id].notify == 'number')) { meshMasks[id] = user.links[id].notify; }
        }
    }
    if ((user != null) && (user.notify != null)) {
        for (var notifyId in user.notify) {
            if (notifyId.startsWith('mesh/')) { meshMasks[notifyId] = (meshMasks[notifyId] || 0) | user.notify[notifyId]; }
        }
    }
    for (var meshid in meshMasks) { addMask('mesh', meshid, meshMasks[meshid]); }
    if ((user != null) && (user.notify != null)) {
        for (var nodeid in user.notify) { if (nodeid.startsWith('node/')) { addMask('node', nodeid, user.notify[nodeid]); } }
    }
    return policy;
}

function evaluateHealth(device) {
    const result = {};
    const modules = coreAlertModules.getBySource('coreinfo');
    for (var i = 0; i < modules.length; i++) {
        const values = modules[i].evaluate({ data: device, settings: {}, isActive: function () { return false; }, getObservation: function () { return null; }, getObservations: function () { return []; }, setObservation: function () { return true; }, removeObservation: function () {} });
        result[modules[i].definition.id] = (Array.isArray(values) && (values.length > 0)) ? values[0] : { state: 'unknown' };
    }
    return result;
}

module.exports.CreateMeshAlerts = function (parent) {
    const obj = {};
    obj.parent = parent;
    obj.catalog = {};
    obj.policies = {};
    obj.policyWaiters = {};
    obj.states = {};
    obj.statesReady = false;
    obj.pendingStateOperations = [];
    obj.observations = {};
    obj.observationsReady = false;
    obj.pendingReconciliations = [];
    obj.checkResults = {};
    obj.networkInfo = {};
    obj.sysInfo = {};
    obj.externalQueues = { email: {}, messaging: {} };
    obj.connectivityHistory = {};
    obj.legacyAccountDefaults = {};
    obj.legacyAccountMasks = {};
    obj.remindersEnabled = true;
    obj.reminderHour = 10;
    obj.reminderMinute = 0;
    if (parent.config.settings.alerts != null) {
        // Keep accepting reminderIntervalHours: 0 as the compatibility switch for
        // disabling reminders. Positive interval values no longer alter the daily
        // schedule.
        if ((typeof parent.config.settings.alerts.reminderintervalhours == 'number') && (parent.config.settings.alerts.reminderintervalhours <= 0)) obj.remindersEnabled = false;
        if (typeof parent.config.settings.alerts.remindertime == 'string') {
            const reminderTimeMatch = /^([01][0-9]|2[0-3]):([0-5][0-9])$/.exec(parent.config.settings.alerts.remindertime);
            if (reminderTimeMatch != null) {
                obj.reminderHour = parseInt(reminderTimeMatch[1]);
                obj.reminderMinute = parseInt(reminderTimeMatch[2]);
            }
        }
    }
    obj.reminderTime = (obj.reminderHour < 10 ? '0' : '') + obj.reminderHour + ':' + (obj.reminderMinute < 10 ? '0' : '') + obj.reminderMinute;
    // Web bits 2, 4 and 8 move into notificationPolicy. Keep only the visual
    // preferences (sound bit 1 and group-name bit 16) in configured web state.
    for (var domainid in parent.config.domains) {
        const domain = parent.config.domains[domainid], legacyDefaults = {};
        if ((domain.defaultuserwebstate != null) && (typeof domain.defaultuserwebstate.notifications === 'number')) {
            legacyDefaults.defaultValue = domain.defaultuserwebstate.notifications;
            domain.defaultuserwebstate.notifications &= 17;
        }
        if ((domain.forceduserwebstate != null) && (typeof domain.forceduserwebstate.notifications === 'number')) {
            legacyDefaults.forcedValue = domain.forceduserwebstate.notifications;
            domain.forceduserwebstate.notifications &= 17;
        }
        obj.legacyAccountDefaults[domainid] = legacyDefaults;
    }

    obj.registerAlertType = function (owner, definition) {
        if ((typeof owner !== 'string') || (typeof definition !== 'object') || (definition == null) || (typeof definition.id !== 'string') || !TYPE_ID_RE.test(definition.id)) return false;
        if ((owner !== 'core') && (!PLUGIN_NAME_RE.test(owner) || !definition.id.startsWith('plugin.' + owner + '.') || (definition.id.length <= (owner.length + 7)))) return false;
        if ((definition.kind !== 'event') && (definition.kind !== 'state')) return false;
        if (!Array.isArray(definition.channels) || (definition.channels.length === 0)) return false;
        for (var i = 0; i < definition.channels.length; i++) { if ((CHANNELS.indexOf(definition.channels[i]) < 0) || (definition.channels.indexOf(definition.channels[i]) !== i)) return false; }
        if ((definition.title != null) && ((typeof definition.title !== 'string') || (definition.title.length > 128))) return false;
        if ((definition.group != null) && ((typeof definition.group !== 'string') || (definition.group.length > 64))) return false;
        if ((definition.severity != null) && (['info', 'warning', 'critical'].indexOf(definition.severity) < 0)) return false;
        if ((definition.requiredRight != null) && (!Number.isInteger(definition.requiredRight) || (definition.requiredRight < 0) || (definition.requiredRight > 0xFFFFFFFF))) return false;
        for (var capability of ['reminders', 'resolutions', 'ignorable']) { if ((definition[capability] != null) && (typeof definition[capability] !== 'boolean')) return false; }
        if ((obj.catalog[definition.id] != null) && (obj.catalog[definition.id].owner !== owner)) return false;
        const d = clone(definition);
        d.owner = owner;
        if (typeof d.title !== 'string') d.title = d.id;
        if (typeof d.group !== 'string') d.group = 'Other';
        if (typeof d.severity !== 'string') d.severity = 'info';
        if (typeof d.requiredRight !== 'number') d.requiredRight = 0;
        if (typeof d.reminders !== 'boolean') d.reminders = false;
        if (typeof d.resolutions !== 'boolean') d.resolutions = false;
        if (typeof d.ignorable !== 'boolean') d.ignorable = false;
        obj.catalog[d.id] = d;
        if ((owner !== 'core') && (parent.webserver != null) && (parent.DispatchEvent != null)) { parent.DispatchEvent(['*'], obj, { action: 'alertCatalogChange', nolog: 1 }); }
        return true;
    };

    obj.unregisterAlertTypes = function (owner) {
        if ((typeof owner !== 'string') || (owner === 'core')) return false;
        var changed = false;
        for (var id in obj.catalog) { if (obj.catalog[id].owner === owner) { delete obj.catalog[id]; changed = true; } }
        if (changed && (parent.webserver != null) && (parent.DispatchEvent != null)) { parent.DispatchEvent(['*'], obj, { action: 'alertCatalogChange', nolog: 1 }); }
        return true;
    };

    obj.coreAlertModules = coreAlertModules.getModules();
    for (var coreModuleIndex = 0; coreModuleIndex < obj.coreAlertModules.length; coreModuleIndex++) {
        if (!obj.registerAlertType('core', obj.coreAlertModules[coreModuleIndex].definition)) throw new Error('Unable to register core alert type ' + obj.coreAlertModules[coreModuleIndex].definition.id + '.');
    }

    obj.getCatalog = function () {
        const result = [];
        for (var id in obj.catalog) { result.push(clone(obj.catalog[id])); }
        result.sort(function (a, b) { return (a.group + '\0' + a.title).localeCompare(b.group + '\0' + b.title); });
        return result;
    };

    obj.getPolicy = function (userid) {
        return obj.policies[userid] || null;
    };

    function checkResultValue(value) {
        const result = { state: value.state, instanceKey: value.instanceKey || '', updated: Date.now() };
        if (typeof value.detail === 'string') result.detail = value.detail;
        if (value.variables != null) result.variables = clone(value.variables);
        return result;
    }

    function setCheckResult(nodeid, alertType, value) {
        if ((typeof nodeid !== 'string') || (value == null) || (['active', 'healthy', 'unknown'].indexOf(value.state) < 0)) return;
        if (obj.checkResults[nodeid] == null) obj.checkResults[nodeid] = {};
        if (obj.checkResults[nodeid][alertType] == null) obj.checkResults[nodeid][alertType] = {};
        obj.checkResults[nodeid][alertType]['$' + (value.instanceKey || '')] = checkResultValue(value);
    }

    function replaceCheckResults(nodeid, alertType, values) {
        if (typeof nodeid !== 'string') return;
        if (obj.checkResults[nodeid] == null) obj.checkResults[nodeid] = {};
        const results = {};
        for (var i = 0; i < values.length; i++) {
            const value = values[i];
            if ((value == null) || (typeof value !== 'object') || (['active', 'healthy', 'unknown'].indexOf(value.state) < 0)) continue;
            results['$' + (value.instanceKey || '')] = checkResultValue(value);
        }
        if (Object.keys(results).length === 0) results.$ = checkResultValue({ state: 'unknown' });
        obj.checkResults[nodeid][alertType] = results;
    }

    obj.getDeviceChecks = function (nodeid, rights) {
        if (typeof nodeid !== 'string') return [];
        const result = [], nodeResults = obj.checkResults[nodeid] || {};
        for (var alertType in obj.catalog) {
            const definition = obj.catalog[alertType];
            if ((definition.kind !== 'state') || ((definition.requiredRight !== 0) && (rights !== 0xFFFFFFFF) && ((rights & definition.requiredRight) === 0))) continue;
            const values = {}, recorded = nodeResults[alertType] || {};
            for (var recordedKey in recorded) values[recordedKey] = clone(recorded[recordedKey]);
            for (var stateKey in obj.states) {
                const active = obj.states[stateKey];
                if ((active.nodeid === nodeid) && (active.alertType === alertType)) values['$' + (active.instanceKey || '')] = checkResultValue({ state: 'active', instanceKey: active.instanceKey, detail: active.detail, variables: active.variables });
            }
            const instances = Object.keys(values).map(function (key) { return values[key]; });
            if (instances.length === 0) instances.push(checkResultValue({ state: 'unknown' }));
            instances.sort(function (a, b) { return a.instanceKey.localeCompare(b.instanceKey); });
            var state = 'healthy';
            for (var instanceIndex = 0; instanceIndex < instances.length; instanceIndex++) {
                if (instances[instanceIndex].state === 'active') { state = 'active'; break; }
                if (instances[instanceIndex].state === 'unknown') state = 'unknown';
            }
            result.push({ alertType: alertType, title: definition.title, group: definition.group, severity: definition.severity, state: state, instances: instances });
        }
        result.sort(function (a, b) { return (a.group + '\0' + a.title).localeCompare(b.group + '\0' + b.title); });
        return result;
    };

    obj.importPolicy = function (policy) {
        if ((policy == null) || (policy.version !== POLICY_VERSION) || (typeof policy.userid !== 'string') || !Array.isArray(policy.rules) || !Array.isArray(policy.ignored)) return false;
        const imported = clone(policy), domain = imported.userid.split('/')[1], rules = [], ignored = [];
        if ((imported.userid.split('/').length !== 3) || (imported.userid.split('/')[0] !== 'user')) return false;
        for (var i = 0; i < imported.rules.length; i++) {
            const rule = imported.rules[i];
            if ((rule == null) || (typeof rule !== 'object') || (typeof rule.alertType !== 'string') || !TYPE_ID_RE.test(rule.alertType) || (['account', 'mesh', 'node'].indexOf(rule.scope) < 0) || (rule.channels == null) || (typeof rule.channels !== 'object')) continue;
            if ((rule.scope === 'mesh') && ((typeof rule.scopeId !== 'string') || !rule.scopeId.startsWith('mesh/' + domain + '/'))) continue;
            if ((rule.scope === 'node') && ((typeof rule.scopeId !== 'string') || !rule.scopeId.startsWith('node/' + domain + '/'))) continue;
            const channels = {};
            for (var channel in rule.channels) { if ((CHANNELS.indexOf(channel) >= 0) && (typeof rule.channels[channel] === 'boolean')) channels[channel] = rule.channels[channel]; }
            if (Object.keys(channels).length === 0) continue;
            const cleanRule = { scope: rule.scope, alertType: rule.alertType, channels: channels };
            if (rule.scope !== 'account') cleanRule.scopeId = rule.scopeId;
            rules.push(cleanRule);
        }
        for (var j = 0; j < imported.ignored.length; j++) {
            const item = imported.ignored[j];
            if ((item == null) || (typeof item !== 'object') || (typeof item.nodeid !== 'string') || !item.nodeid.startsWith('node/' + domain + '/') || (typeof item.alertType !== 'string') || !TYPE_ID_RE.test(item.alertType)) continue;
            ignored.push(item);
        }
        imported.domain = domain;
        imported.rules = rules;
        imported.ignored = ignored;
        obj.policies[imported.userid] = imported;
        return true;
    };

    obj.reloadPolicy = function (userid) {
        if (typeof userid !== 'string') return;
        parent.db.Get(policyId(userid), function (err, docs) {
            if ((err == null) && Array.isArray(docs) && (docs.length === 1)) obj.importPolicy(docs[0]);
        });
    };

    obj.importState = function (state) {
        if ((state == null) || (typeof state !== 'object') || (typeof state.nodeid !== 'string') || (typeof state.meshid !== 'string') || (typeof state.alertType !== 'string') || !TYPE_ID_RE.test(state.alertType)) return false;
        const nodeParts = state.nodeid.split('/'), meshParts = state.meshid.split('/'), instanceKey = state.instanceKey || '';
        if ((nodeParts.length !== 3) || (nodeParts[0] !== 'node') || (meshParts.length !== 3) || (meshParts[0] !== 'mesh') || (nodeParts[1] !== meshParts[1]) || (typeof instanceKey !== 'string') || (state._id !== stateId(state.nodeid, state.alertType, instanceKey))) return false;
        obj.states[state._id] = clone(state);
        setCheckResult(state.nodeid, state.alertType, { state: 'active', instanceKey: instanceKey, detail: state.detail, variables: state.variables });
        return true;
    };

    obj.importStateEvent = function (event) {
        if ((event == null) || (event.alertState == null) || (typeof event.alertState._id !== 'string')) return false;
        if ((event.action === 'alertStateChange') && (event.statePhase === 'resolved')) { delete obj.states[event.alertState._id]; setCheckResult(event.alertState.nodeid, event.alertState.alertType, { state: 'healthy', instanceKey: event.alertState.instanceKey, detail: event.alertState.detail, variables: event.alertState.variables }); return true; }
        if ((event.action === 'alertStateChange') && ((event.statePhase === 'active') || (event.statePhase === 'update'))) return obj.importState(event.alertState);
        return false;
    };

    obj.importObservation = function (observation) {
        if ((observation == null) || (typeof observation !== 'object') || (typeof observation.nodeid !== 'string') || (typeof observation.meshid !== 'string') || (typeof observation.alertType !== 'string')) return false;
        const instanceKey = observation.instanceKey || '';
        if ((typeof instanceKey !== 'string') || (instanceKey.length > 128) || (observation._id !== observationId(observation.nodeid, observation.alertType, instanceKey))) return false;
        try { if ((observation.data == null) || (typeof JSON.stringify(observation.data) !== 'string') || (JSON.stringify(observation.data).length > 4096)) return false; } catch (ex) { return false; }
        obj.observations[observation._id] = clone(observation);
        return true;
    };

    obj.resolveChannel = function (userid, meshid, nodeid, alertType, channel) {
        const policy = obj.policies[userid];
        if (policy != null) return resolveChannel(policy, meshid, nodeid, alertType, channel);
        const user = parent.webserver && parent.webserver.users[userid];
        if (user == null) return false;
        var mask = 0;
        if (user.links && user.links[meshid] && (typeof user.links[meshid].notify == 'number')) mask |= user.links[meshid].notify;
        if (user.notify && (typeof user.notify[meshid] == 'number')) mask |= user.notify[meshid];
        if (user.notify && (typeof user.notify[nodeid] == 'number')) mask |= user.notify[nodeid];
        const legacy = {
            'device.connection.connected': { web: 2, email: 16, messaging: 128 },
            'device.connection.disconnected': { web: 4, email: 32, messaging: 256 },
            'device.amt.session': { web: 8 },
            'device.help.requested': { email: 64, messaging: 512 }
        };
        if (channel === 'web') mask |= (obj.legacyAccountMasks[userid] || 0);
        return !!(legacy[alertType] && legacy[alertType][channel] && (mask & legacy[alertType][channel]));
    };

    obj.isIgnored = function (userid, nodeid, alertType) { return isIgnored(obj.policies[userid], nodeid, alertType); };

    function readAccountMask(userid, callback) {
        parent.db.Get('ws' + userid, function (err, docs) {
            var state = {}, mask = 0;
            if ((err == null) && Array.isArray(docs) && (docs.length === 1) && (typeof docs[0].state === 'string')) { try { state = JSON.parse(docs[0].state); } catch (ex) { } }
            const domainid = userid.split('/')[1];
            const defaults = obj.legacyAccountDefaults[domainid] || {};
            if ((state.notifications == null) && (typeof defaults.defaultValue === 'number')) state.notifications = defaults.defaultValue;
            if (typeof defaults.forcedValue === 'number') state.notifications = defaults.forcedValue;
            if (typeof state.notifications === 'number') mask = state.notifications;
            obj.legacyAccountMasks[userid] = mask;
            callback(mask);
        });
    }

    obj.ensurePolicy = function (user, callback) {
        if ((user == null) || (typeof user._id !== 'string')) { if (callback) callback(null); return; }
        if (obj.policies[user._id] != null) { if (callback) callback(obj.policies[user._id]); return; }
        if (obj.policyWaiters[user._id] != null) { if (callback) obj.policyWaiters[user._id].push(callback); return; }
        obj.policyWaiters[user._id] = callback ? [callback] : [];
        const finish = function (policy) {
            const waiters = obj.policyWaiters[user._id] || [];
            delete obj.policyWaiters[user._id];
            for (var i = 0; i < waiters.length; i++) waiters[i](policy);
        };
        parent.db.Get(policyId(user._id), function (policyErr, docs) {
            if ((policyErr == null) && Array.isArray(docs) && (docs.length === 1) && obj.importPolicy(docs[0])) { finish(obj.policies[user._id]); return; }
            readAccountMask(user._id, function (accountMask) {
                if (obj.policies[user._id] != null) { finish(obj.policies[user._id]); return; }
                const policy = migrateLegacyPolicy(user, accountMask);
                policy._id = policyId(user._id);
                policy.type = 'notificationPolicy';
                policy.domain = user._id.split('/')[1];
                policy.userid = user._id;
                policy.migrated = Date.now();
                obj.policies[user._id] = policy;
                parent.db.Set(policy, function () { finish(policy); });
            });
        });
    };

    function savePolicy(policy, callback) {
        policy.updated = Date.now();
        obj.policies[policy.userid] = policy;
        parent.db.Set(policy, function (err) {
            if ((err == null) && parent.DispatchEvent) { parent.DispatchEvent([policy.userid], obj, { action: 'notificationPolicyChange', domain: policy.domain, nolog: 1, userid: policy.userid }); }
            if (callback) callback(err);
        });
    }

    obj.setRule = function (user, change, callback) {
        obj.ensurePolicy(user, function (policy) {
            if ((policy == null) || (change == null) || (obj.catalog[change.alertType] == null)) { callback('Invalid alert type'); return; }
            if (['account', 'mesh', 'node'].indexOf(change.scope) < 0) { callback('Invalid scope'); return; }
            if ((change.scope !== 'account') && (typeof change.scopeId !== 'string')) { callback('Invalid scope identifier'); return; }
            if ((change.scope === 'mesh') && !change.scopeId.startsWith('mesh/' + policy.domain + '/')) { callback('Invalid group identifier'); return; }
            if ((change.scope === 'node') && !change.scopeId.startsWith('node/' + policy.domain + '/')) { callback('Invalid device identifier'); return; }
            if ((change.channels == null) || (typeof change.channels !== 'object')) { callback('Invalid channels'); return; }
            const supported = obj.catalog[change.alertType].channels;
            for (var channel in change.channels) {
                if ((CHANNELS.indexOf(channel) < 0) || (supported.indexOf(channel) < 0) || ((change.channels[channel] !== null) && (typeof change.channels[channel] !== 'boolean'))) { callback('Invalid channel'); return; }
            }

            const oldPolicy = clone(policy);
            var rule = findRule(policy, change.scope, change.scopeId, change.alertType);
            if (rule == null) {
                rule = { scope: change.scope, alertType: change.alertType, channels: {} };
                if (change.scope !== 'account') rule.scopeId = change.scopeId;
                policy.rules.push(rule);
            }
            for (var c in change.channels) { if (change.channels[c] == null) { delete rule.channels[c]; } else { rule.channels[c] = change.channels[c]; } }
            if (Object.keys(rule.channels).length === 0) policy.rules.splice(policy.rules.indexOf(rule), 1);
            const activations = [];
            for (var stateKey in obj.states) {
                const state = obj.states[stateKey];
                if (state.alertType !== change.alertType) continue;
                if ((change.scope === 'mesh') && (state.meshid !== change.scopeId)) continue;
                if ((change.scope === 'node') && (state.nodeid !== change.scopeId)) continue;
                const enabledChannels = [];
                for (var changedChannel in change.channels) {
                    if (!resolveChannel(oldPolicy, state.meshid, state.nodeid, state.alertType, changedChannel) && resolveChannel(policy, state.meshid, state.nodeid, state.alertType, changedChannel)) enabledChannels.push(changedChannel);
                }
                if (enabledChannels.length > 0) activations.push({ state: state, channels: enabledChannels });
            }
            savePolicy(policy, function (err) {
                if (err == null) {
                    const definition = obj.catalog[change.alertType];
                    for (var i = 0; i < activations.length; i++) deliverToUser(user, definition, 'active', activations[i].state, activations[i].channels);
                }
                callback(err, policy);
            });
        });
    };

    obj.setIgnored = function (user, nodeid, meshid, alertType, ignored, callback) {
        obj.ensurePolicy(user, function (policy) {
            const definition = obj.catalog[alertType];
            if ((policy == null) || (definition == null) || (definition.kind !== 'state') || (definition.ignorable !== true) || (typeof nodeid !== 'string') || !nodeid.startsWith('node/' + policy.domain + '/') || (typeof meshid !== 'string') || !meshid.startsWith('mesh/' + policy.domain + '/')) { callback('Invalid alert'); return; }
            var index = -1;
            for (var i = 0; i < policy.ignored.length; i++) { if ((policy.ignored[i] != null) && (policy.ignored[i].nodeid === nodeid) && (policy.ignored[i].alertType === alertType)) index = i; }
            const reactivated = (ignored === false) && (index >= 0);
            if ((ignored === true) && (index < 0)) policy.ignored.push({ nodeid: nodeid, meshid: meshid, alertType: alertType, created: Date.now() });
            if ((ignored === true) && (index >= 0)) policy.ignored[index].meshid = meshid;
            if ((ignored === false) && (index >= 0)) policy.ignored.splice(index, 1);
            savePolicy(policy, function (err) {
                if ((err == null) && reactivated) { obj.notifyActiveToUser(user, nodeid, alertType); }
                callback(err, policy);
            });
        });
    };

    function usersForNode(meshid, nodeid) {
        const result = [];
        if ((parent.webserver == null) || (parent.webserver.users == null)) return result;
        for (var userid in parent.webserver.users) {
            if (parent.webserver.GetNodeRights(parent.webserver.users[userid], meshid, nodeid) !== 0) result.push(userid);
        }
        return result;
    }

    function hasRights(user, definition, meshid, nodeid) {
        if ((user == null) || (parent.webserver == null)) return false;
        const rights = parent.webserver.GetNodeRights(user, meshid, nodeid);
        if (rights === 0) return false;
        return (definition.requiredRight === 0) || (rights === 0xFFFFFFFF) || ((rights & definition.requiredRight) !== 0);
    }

    function notificationText(definition, phase, data) {
        const device = data.deviceName || data.nodeid;
        var variables = '';
        if (data.variables != null) { try { variables = JSON.stringify(data.variables); } catch (ex) { } }
        if ((phase === 'event') && (typeof data.detail === 'string') && (data.detail.length > 0)) return data.detail + ((variables.length > 0) ? (': ' + variables) : '');
        var verb = 'reported';
        if (phase === 'active') verb = 'requires attention';
        if (phase === 'resolved') verb = 'resolved';
        if (phase === 'reminder') verb = 'still requires attention';
        var text = definition.title + ' ' + verb + ' on ' + device;
        if (typeof data.detail === 'string' && data.detail.length > 0) text += ': ' + data.detail;
        if (variables.length > 0) text += ': ' + variables;
        return text;
    }

    function digestItemText(definition, phase, data) {
        var variables = '';
        if (data.variables != null) { try { variables = JSON.stringify(data.variables); } catch (ex) { } }
        if (phase === 'event') {
            var eventText = definition.title;
            if ((typeof data.detail === 'string') && (data.detail.length > 0)) eventText += ': ' + data.detail;
            if (variables.length > 0) eventText += ': ' + variables;
            return eventText;
        }
        var verb = 'reported';
        if (phase === 'active') verb = 'requires attention';
        if (phase === 'resolved') verb = 'resolved';
        if (phase === 'reminder') verb = 'still requires attention';
        var text = definition.title + ' ' + verb;
        if ((typeof data.detail === 'string') && (data.detail.length > 0)) text += ': ' + data.detail;
        if (variables.length > 0) text += ': ' + variables;
        return text;
    }

    function escapeHtml(value) { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

    function digestLine(value) { return String(value).replace(/[\r\n]+/g, ' ').trim(); }

    function digestStatusEmoji(definition, phase) {
        if (phase === 'resolved') return '\ud83d\udfe2';
        if (definition.severity === 'critical') return '\ud83d\udd34';
        if (definition.severity === 'warning') return '\ud83d\udfe0';
        return '\ud83d\udfe2';
    }

    function buildExternalDigest(items) {
        const groups = [], byNode = Object.create(null);
        for (var i = 0; i < items.length; i++) {
            const item = items[i], nodeid = item.data.nodeid, key = '$' + nodeid;
            var group = byNode[key];
            if (group == null) {
                group = byNode[key] = { nodeid: nodeid, name: digestLine(item.data.deviceName || nodeid), items: [] };
                groups.push(group);
            } else if ((!group.name || (group.name === group.nodeid)) && item.data.deviceName) {
                group.name = digestLine(item.data.deviceName);
            }
            group.items.push({ emoji: digestStatusEmoji(item.definition, item.phase), text: digestLine(digestItemText(item.definition, item.phase, item.data)) });
        }
        const text = ['MeshCentral device alerts'], html = ['<p><strong>MeshCentral device alerts</strong></p>'];
        for (var groupIndex = 0; groupIndex < groups.length; groupIndex++) {
            const current = groups[groupIndex];
            text.push('', '\ud83d\udcbb ' + current.name);
            html.push('<p><strong>\ud83d\udcbb ' + escapeHtml(current.name) + '</strong></p><ul>');
            for (var itemIndex = 0; itemIndex < current.items.length; itemIndex++) {
                const digestItem = current.items[itemIndex];
                text.push('\u2022 ' + digestItem.emoji + ' ' + digestItem.text);
                html.push('<li>' + digestItem.emoji + ' ' + escapeHtml(digestItem.text) + '</li>');
            }
            html.push('</ul>');
        }
        return { text: text.join('\r\n'), html: html.join(''), itemCount: items.length, deviceCount: groups.length };
    }

    function truncateExternalMessage(text, maximum) {
        if (text.length <= maximum) return text;
        const suffix = '\r\n\u2026';
        var end = text.lastIndexOf('\n', maximum - suffix.length);
        if (end < 0) end = maximum - suffix.length;
        return text.substring(0, end).replace(/[\r\n]+$/, '') + suffix;
    }

    function sendWeb(user, definition, phase, data) {
        const notification = { id: (typeof data.id === 'number') ? data.id : Math.random(), title: (typeof data.title === 'string') ? data.title : definition.title, text: notificationText(definition, phase, data), nodeid: data.nodeid, alertType: definition.id, alertPhase: phase, severity: definition.severity, tag: (typeof data.tag === 'string') ? data.tag : ('alert/' + definition.id + '/' + data.nodeid) };
        if (typeof data.icon === 'number') notification.icon = data.icon;
        if (typeof data.titleid === 'number') notification.titleid = data.titleid;
        if (typeof data.msgid === 'number') notification.msgid = data.msgid;
        if (Array.isArray(data.args)) notification.args = clone(data.args);
        if ((definition.kind === 'state') && (definition.ignorable === true) && (phase !== 'resolved')) notification.ignorable = true;
        parent.DispatchEvent([user._id], obj, { action: 'alertnotify', domain: user._id.split('/')[1], nolog: 1, notification: notification });
    }

    function flushExternal(channel, userid) {
        const entry = obj.externalQueues[channel][userid];
        if (entry == null) return;
        delete obj.externalQueues[channel][userid];
        const user = parent.webserver.users[userid];
        if (user == null) return;
        const items = [];
        for (var i = 0; i < entry.items.length; i++) {
            const item = entry.items[i], currentDefinition = obj.catalog[item.definition.id];
            if ((currentDefinition == null) || !hasRights(user, currentDefinition, item.data.meshid, item.data.nodeid)) continue;
            if ((currentDefinition.kind === 'state') && obj.isIgnored(userid, item.data.nodeid, currentDefinition.id)) continue;
            if (!obj.resolveChannel(userid, item.data.meshid, item.data.nodeid, currentDefinition.id, channel)) continue;
            items.push({ definition: currentDefinition, phase: item.phase, data: item.data });
        }
        if (items.length === 0) return;
        const digest = buildExternalDigest(items);
        const domain = parent.config.domains[user._id.split('/')[1]];
        if ((channel === 'email') && domain && domain.mailserver && user.email && (user.emailVerified === true)) {
            domain.mailserver.sendMail(user.email, 'MeshCentral device alerts (' + digest.itemCount + ')', digest.text, digest.html);
        } else if ((channel === 'messaging') && parent.msgserver && user.msghandle) {
            parent.msgserver.sendMessage(user.msghandle, truncateExternalMessage(digest.text, 1000), domain, null);
        }
    }

    function queueExternal(channel, user, definition, phase, data) {
        var entry = obj.externalQueues[channel][user._id];
        if (entry == null) {
            entry = obj.externalQueues[channel][user._id] = { items: [] };
            var delay = 60000;
            const domain = parent.config.domains[user._id.split('/')[1]];
            if ((channel === 'email') && domain && domain.mailserver && (typeof domain.mailserver.emailDelay === 'number')) delay = domain.mailserver.emailDelay;
            entry.timer = setTimeout(function () { flushExternal(channel, user._id); }, delay);
        }
        entry.items.push({ definition: definition, phase: phase, data: clone(data) });
    }

    function deliverToUser(user, definition, phase, data, onlyChannels) {
        if (!hasRights(user, definition, data.meshid, data.nodeid)) return;
        if ((definition.kind === 'state') && obj.isIgnored(user._id, data.nodeid, definition.id)) return;
        for (var i = 0; i < definition.channels.length; i++) {
            const channel = definition.channels[i];
            if (onlyChannels && (onlyChannels.indexOf(channel) < 0)) continue;
            if (!obj.resolveChannel(user._id, data.meshid, data.nodeid, definition.id, channel)) continue;
            if (channel === 'web') sendWeb(user, definition, phase, data); else queueExternal(channel, user, definition, phase, data);
        }
    }

    obj.deliverEventToUser = function (user, alertType, data, onlyChannels) {
        const definition = obj.catalog[alertType];
        if ((definition == null) || (definition.kind !== 'event') || (user == null)) return false;
        deliverToUser(user, definition, 'event', data, onlyChannels);
        return true;
    };

    function deliver(definition, phase, data) {
        const users = usersForNode(data.meshid, data.nodeid);
        for (var i = 0; i < users.length; i++) {
            const user = parent.webserver.users[users[i]];
            if (user != null) deliverToUser(user, definition, phase, data);
        }
    }

    obj.emitAlertEvent = function (owner, data) {
        if ((data == null) || (typeof data.alertType !== 'string')) return false;
        const definition = obj.catalog[data.alertType];
        if ((definition == null) || (definition.owner !== owner) || (definition.kind !== 'event') || (typeof data.nodeid !== 'string') || (typeof data.meshid !== 'string')) return false;
        if (!validateData(data)) return false;
        deliver(definition, 'event', data);
        return true;
    };

    obj.emitEvaluatedEvent = function (alertModule, device, value) {
        if ((alertModule == null) || (alertModule.definition == null) || (alertModule.definition.kind !== 'event') || (value == null) || (typeof value !== 'object')) return false;
        const definition = alertModule.definition;
        const data = { alertType: definition.id, nodeid: device._id, meshid: device.meshid, deviceName: device.name, detail: value.detail, variables: value.variables };
        if (!validateData(data)) return false;
        const msg = notificationText(definition, 'event', data);
        parent.DispatchEvent(parent.webserver.CreateNodeDispatchTargets(device.meshid, device._id), obj, { etype: 'node', action: 'devicealertevent', meshid: device.meshid, nodeid: device._id, alertType: definition.id, severity: definition.severity, requiredRight: definition.requiredRight, msg: msg, domain: device._id.split('/')[1] });
        return obj.emitAlertEvent('core', data);
    };

    function validateData(data) {
        if ((typeof data.nodeid !== 'string') || (typeof data.meshid !== 'string')) return false;
        const nodeParts = data.nodeid.split('/'), meshParts = data.meshid.split('/');
        if ((nodeParts.length !== 3) || (nodeParts[0] !== 'node') || (meshParts.length !== 3) || (meshParts[0] !== 'mesh') || (nodeParts[1] !== meshParts[1])) return false;
        if ((data.deviceName != null) && ((typeof data.deviceName !== 'string') || (data.deviceName.length > 256))) return false;
        if ((data.detail != null) && ((typeof data.detail !== 'string') || (data.detail.length > 2048))) return false;
        if ((data.title != null) && ((typeof data.title !== 'string') || (data.title.length > 256))) return false;
        if ((data.tag != null) && ((typeof data.tag !== 'string') || (data.tag.length > 256))) return false;
        if ((data.instanceKey != null) && ((typeof data.instanceKey !== 'string') || (data.instanceKey.length > 128))) return false;
        if (data.variables != null) { try { if (typeof JSON.stringify(data.variables) !== 'string') return false; } catch (ex) { return false; } }
        try { if (JSON.stringify(data).length > 4096) return false; } catch (ex) { return false; }
        return true;
    }

    function dispatchLifecycle(definition, phase, state) {
        const action = (phase === 'active') ? 'devicealertactive' : 'devicealertresolved';
        const msg = notificationText(definition, phase, state);
        parent.DispatchEvent(['server-alerts'], obj, { action: 'alertStateChange', statePhase: phase, domain: state.domain, nolog: 1, alertState: clone(state) });
        parent.DispatchEvent(parent.webserver.CreateNodeDispatchTargets(state.meshid, state.nodeid), obj, { etype: 'node', action: action, meshid: state.meshid, nodeid: state.nodeid, alertType: definition.id, instanceKey: state.instanceKey, severity: definition.severity, requiredRight: definition.requiredRight, msg: msg, domain: state.domain });
        deliver(definition, phase, state);
    }

    obj.setAlertState = function (owner, data) {
        if ((data == null) || (['active', 'healthy', 'unknown'].indexOf(data.state) < 0)) return false;
        const definition = obj.catalog[data.alertType];
        if ((definition == null) || (definition.owner !== owner) || (definition.kind !== 'state') || (typeof data.nodeid !== 'string') || (typeof data.meshid !== 'string') || !validateData(data)) return false;
        setCheckResult(data.nodeid, data.alertType, data);
        if (data.state === 'unknown') return true;
        if (obj.statesReady !== true) { obj.pendingStateOperations.push({ owner: owner, data: clone(data) }); return true; }
        const id = stateId(data.nodeid, data.alertType, data.instanceKey);
        const old = obj.states[id];
        if (data.state === 'active') {
            const now = Date.now();
            if (old == null) {
                const state = { _id: id, type: 'alertState', domain: data.nodeid.split('/')[1], meshid: data.meshid, nodeid: data.nodeid, alertType: data.alertType, instanceKey: data.instanceKey || '', deviceName: data.deviceName, detail: data.detail, variables: (data.variables == null) ? undefined : clone(data.variables), firstSeen: now, lastSeen: now, lastReminder: now };
                obj.states[id] = state;
                parent.db.Set(state, function (err) { if (err == null) dispatchLifecycle(definition, 'active', state); });
            } else {
                const changed = ((typeof data.deviceName === 'string') && (old.deviceName !== data.deviceName)) || ((typeof data.detail === 'string') && (old.detail !== data.detail)) || ((data.variables != null) && (JSON.stringify(old.variables) !== JSON.stringify(data.variables)));
                old.lastSeen = now;
                if (typeof data.deviceName === 'string') old.deviceName = data.deviceName;
                if (typeof data.detail === 'string') old.detail = data.detail;
                if (data.variables != null) old.variables = clone(data.variables);
                parent.db.Set(old, function (err) {
                    if ((err == null) && changed) parent.DispatchEvent(['server-alerts'], obj, { action: 'alertStateChange', statePhase: 'update', domain: old.domain, nolog: 1, alertState: clone(old) });
                });
            }
        } else if (old != null) {
            delete obj.states[id];
            parent.db.Remove(id, function (err) { if (err == null) dispatchLifecycle(definition, 'resolved', old); });
        }
        return true;
    };

    function observationFor(device, alertType, instanceKey) { return obj.observations[observationId(device._id, alertType, instanceKey)] || null; }

    function saveObservation(device, alertType, instanceKey, data) {
        if ((typeof instanceKey !== 'string') || (instanceKey.length > 128) || (data == null) || (typeof data !== 'object')) return false;
        var encoded;
        try { encoded = JSON.stringify(data); } catch (ex) { return false; }
        if ((typeof encoded !== 'string') || (encoded.length > 4096)) return false;
        const id = observationId(device._id, alertType, instanceKey), old = obj.observations[id];
        if ((old != null) && (JSON.stringify(old.data) === encoded) && (old.meshid === device.meshid) && (old.deviceName === device.name)) return true;
        const observation = { _id: id, type: 'alertObservation', domain: device._id.split('/')[1], meshid: device.meshid, nodeid: device._id, alertType: alertType, instanceKey: instanceKey, deviceName: device.name, data: clone(data), updated: Date.now() };
        obj.observations[id] = observation;
        parent.db.Set(observation);
        return true;
    }

    function removeObservation(device, alertType, instanceKey) {
        const id = observationId(device._id, alertType, instanceKey);
        if (obj.observations[id] == null) return;
        delete obj.observations[id];
        parent.db.Remove(id);
    }

    function networkDuplicates(device, identities) {
        const result = [];
        if (!Array.isArray(identities)) return result;
        for (var nodeid in obj.networkInfo) {
            if (nodeid === device._id) continue;
            const peer = obj.networkInfo[nodeid];
            if ((peer == null) || (peer.device == null) || (peer.device._id.split('/')[1] !== device._id.split('/')[1])) continue;
            const peerIdentities = coreAlertModules.networkIdentities(peer.data);
            for (var i = 0; i < identities.length; i++) {
                if (peerIdentities.indexOf(identities[i]) >= 0) {
                    result.push({ identity: identities[i], nodeid: nodeid, name: peer.device.name });
                    break;
                }
            }
        }
        return result;
    }

    function hardwareIdentityDuplicates(device, identities) {
        const result = [];
        if (!Array.isArray(identities)) return result;
        for (var nodeid in obj.sysInfo) {
            if (nodeid === device._id) continue;
            const peer = obj.sysInfo[nodeid];
            if ((peer == null) || (peer.device == null) || (peer.device._id.split('/')[1] !== device._id.split('/')[1])) continue;
            const peerIdentities = coreAlertModules.hardwareIdentities(peer.data);
            for (var i = 0; i < identities.length; i++) {
                if (peerIdentities.indexOf(identities[i]) >= 0) {
                    result.push({ identity: identities[i].split(':')[0], nodeid: nodeid, name: peer.device.name });
                    break;
                }
            }
        }
        return result;
    }

    function reconcileModule(alertModule, data, device, previousData, periodic) {
        const alertType = alertModule.definition.id;
        var values;
        try {
            values = alertModule.evaluate({
                node: device,
                data: data,
                previousData: previousData,
                periodic: periodic === true,
                settings: parent.config.settings.alerts || {},
                isActive: function (instanceKey) { return obj.states[stateId(device._id, alertType, instanceKey)] != null; },
                getState: function (instanceKey) { return obj.states[stateId(device._id, alertType, instanceKey)] || null; },
                getObservation: function (instanceKey) { const x = observationFor(device, alertType, instanceKey || ''); return (x == null) ? null : clone(x.data); },
                getObservations: function () {
                    const result = [];
                    for (var id in obj.observations) { const x = obj.observations[id]; if ((x.nodeid === device._id) && (x.alertType === alertType)) result.push({ instanceKey: x.instanceKey, data: clone(x.data) }); }
                    return result;
                },
                setObservation: function (instanceKey, observationData) { return saveObservation(device, alertType, instanceKey || '', observationData); },
                removeObservation: function (instanceKey) { removeObservation(device, alertType, instanceKey || ''); },
                findDuplicateNetworkIdentities: function (identities) { return networkDuplicates(device, identities); },
                findDuplicateHardwareIdentities: function (identities) { return hardwareIdentityDuplicates(device, identities); },
                connected: !!(parent.connectivityByNode[device._id] && ((parent.connectivityByNode[device._id].connectivity & 1) !== 0))
            });
        } catch (ex) {
            if (typeof parent.debug === 'function') parent.debug('alerts', 'Alert evaluator failed for ' + alertType + ': ' + ex.message);
            return;
        }
        if (!Array.isArray(values)) return;
        if (alertModule.definition.kind === 'state') replaceCheckResults(device._id, alertType, values);
        if (alertModule.definition.kind === 'event') {
            for (var eventIndex = 0; eventIndex < values.length; eventIndex++) obj.emitEvaluatedEvent(alertModule, device, values[eventIndex]);
            return;
        }
        for (var valueIndex = 0; valueIndex < values.length; valueIndex++) {
            const value = values[valueIndex];
            if ((value == null) || (typeof value !== 'object') || (['active', 'healthy', 'unknown'].indexOf(value.state) < 0)) continue;
            obj.setAlertState('core', { alertType: alertType, state: value.state, nodeid: device._id, meshid: device.meshid, deviceName: device.name, instanceKey: value.instanceKey, detail: value.detail, variables: value.variables });
        }
    }

    obj.reconcileSource = function (source, data, device, previousData) {
        if ((device == null) || (typeof device._id !== 'string') || (typeof device.meshid !== 'string')) return;
        if (obj.observationsReady !== true) { obj.pendingReconciliations.push({ source: source, data: clone(data), device: clone(device), previousData: clone(previousData) }); return; }
        const modules = coreAlertModules.getBySource(source);
        for (var moduleIndex = 0; moduleIndex < modules.length; moduleIndex++) reconcileModule(modules[moduleIndex], data, device, previousData, false);
    };

    obj.reconcileNodeHealth = function (device) { obj.reconcileSource('coreinfo', device, device); };
    obj.reconcileSysInfo = function (sysinfo, device, previousSysinfo) {
        if ((device != null) && (typeof device._id === 'string')) obj.sysInfo[device._id] = { data: clone(sysinfo), device: clone(device) };
        obj.reconcileSource('sysinfo', sysinfo, device, previousSysinfo);
        obj.recordInventoryCheck(device, (sysinfo && sysinfo.time) || Date.now());
    };
    obj.reconcileNode = function (device, previousDevice) { obj.reconcileSource('node', device, device, previousDevice); };
    obj.reconcileNetInfo = function (netinfo, device, previousNetinfo) {
        if ((device != null) && (typeof device._id === 'string')) obj.networkInfo[device._id] = { data: clone(netinfo), device: clone(device) };
        obj.reconcileSource('netinfo', netinfo, device, previousNetinfo);
    };
    obj.recordInventoryCheck = function (device, time) {
        if ((device == null) || (typeof device._id !== 'string') || (typeof device.meshid !== 'string')) return;
        obj.reconcileSource('inventory', { time: (typeof time === 'number') ? time : Date.now() }, device);
    };

    obj.getAgentAlertConfig = function () {
        const settings = parent.config.settings.alerts || {}, result = {};
        function strings(value, maximum) { return Array.isArray(value) ? value.filter(function (x) { return (typeof x === 'string') && (x.length > 0) && (x.length <= 128); }).slice(0, maximum) : []; }
        const services = strings(settings.criticalservicestopped && settings.criticalservicestopped.services, 64);
        const softwareRequired = strings(settings.softwarepolicy && settings.softwarepolicy.required, 64), softwareProhibited = strings(settings.softwarepolicy && settings.softwarepolicy.prohibited, 64);
        result.domainTrust = !!(settings.domaintrustfailure && (settings.domaintrustfailure.enabled === true));
        result.services = services;
        result.securityUpdates = !!(settings.missingsecurityupdates && (settings.missingsecurityupdates.enabled === true));
        result.software = { required: softwareRequired, prohibited: softwareProhibited };
        result.storageHealth = !!(settings.smartdiskfailure && (settings.smartdiskfailure.enabled === true));
        result.diskIo = !!(settings.diskiolatency && (settings.diskiolatency.enabled === true));
        result.network = { targets: strings(settings.networkpacketloss && settings.networkpacketloss.targets, 8), gateway: !!(settings.gatewayunreachable && (settings.gatewayunreachable.enabled === true)) };
        result.localSecurity = !!(
            (settings.unexpectedlocaladministrator && Array.isArray(settings.unexpectedlocaladministrator.allowed) && (settings.unexpectedlocaladministrator.allowed.length > 0)) ||
            (settings.insecureprotocolenabled && Array.isArray(settings.insecureprotocolenabled.check) && (settings.insecureprotocolenabled.check.length > 0)) ||
            (settings.unexpectedlisteningport && (settings.unexpectedlisteningport.enabled === true)) ||
            (settings.remotedesktopexposed && (settings.remotedesktopexposed.enabled === true)) ||
            (settings.passwordpolicy && (settings.passwordpolicy.enabled === true)) ||
            (settings.localaccountchanged && (settings.localaccountchanged.enabled === true)));
        return result;
    };

    function normalizeTelemetry(data) {
        if ((data == null) || (typeof data !== 'object') || Array.isArray(data)) return null;
        const result = { receivedTime: Date.now() }, agentTime = Number(data.time);
        if (Number.isFinite(agentTime) && (agentTime > 0)) result.agentTime = agentTime;
        const cpu = Number(data.cpu && data.cpu.total);
        if (Number.isFinite(cpu) && (cpu >= 0) && (cpu <= 100)) result.cpu = { total: cpu };
        const memory = Number(data.memory && data.memory.percentConsumed);
        if (Number.isFinite(memory) && (memory >= 0) && (memory <= 100)) result.memory = { percentConsumed: memory };
        if (Array.isArray(data.thermals)) {
            result.thermals = [];
            for (var thermalIndex = 0; (thermalIndex < data.thermals.length) && (result.thermals.length < 64); thermalIndex++) {
                const thermal = data.thermals[thermalIndex], temperature = Number(thermal && (thermal.temperature != null ? thermal.temperature : thermal.CurrentTemperature)), name = thermal && (thermal.name || thermal.InstanceName);
                if ((typeof name === 'string') && (name.length > 0) && (name.length <= 128) && Number.isFinite(temperature) && (temperature >= -50) && (temperature <= 200)) result.thermals.push({ name: name, temperature: temperature });
            }
        }
        if ((data.domainTrust != null) && (typeof data.domainTrust === 'object') && (typeof data.domainTrust.healthy === 'boolean')) result.domainTrust = { healthy: data.domainTrust.healthy, domain: (typeof data.domainTrust.domain === 'string') ? data.domainTrust.domain.substring(0, 128) : '' };
        if (Array.isArray(data.services)) {
            result.services = [];
            for (var serviceIndex = 0; (serviceIndex < data.services.length) && (result.services.length < 64); serviceIndex++) {
                const service = data.services[serviceIndex];
                if (service && (typeof service.name === 'string') && (service.name.length > 0) && (service.name.length <= 128) && (typeof service.running === 'boolean')) result.services.push({ name: service.name, running: service.running });
            }
        }
        if ((data.securityUpdates != null) && (typeof data.securityUpdates === 'object') && Number.isInteger(data.securityUpdates.pending) && (data.securityUpdates.pending >= 0) && (data.securityUpdates.pending <= 100000)) {
            result.securityUpdates = { pending: data.securityUpdates.pending, titles: Array.isArray(data.securityUpdates.titles) ? data.securityUpdates.titles.filter(function (x) { return (typeof x === 'string') && (x.length <= 256); }).slice(0, 10) : [] };
        }
        if ((data.software != null) && (typeof data.software === 'object') && Array.isArray(data.software.installed)) result.software = { installed: data.software.installed.filter(function (x) { return (typeof x === 'string') && (x.length > 0) && (x.length <= 256); }).slice(0, 128) };
        function cleanMetricList(list, fields) {
            if (!Array.isArray(list)) return null;
            const clean = [];
            for (var metricIndex = 0; (metricIndex < list.length) && (clean.length < 64); metricIndex++) {
                const item = list[metricIndex]; if ((item == null) || (typeof item !== 'object')) continue;
                const value = {};
                for (var fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
                    const field = fields[fieldIndex], fieldValue = item[field];
                    if ((typeof fieldValue === 'string') && (fieldValue.length <= 256)) value[field] = fieldValue;
                    else if ((typeof fieldValue === 'boolean') || (typeof fieldValue === 'number')) value[field] = fieldValue;
                }
                clean.push(value);
            }
            return clean;
        }
        const storageHealth = cleanMetricList(data.storageHealth, ['name', 'healthy', 'status']); if (storageHealth != null) result.storageHealth = storageHealth;
        const diskIo = cleanMetricList(data.diskIo, ['name', 'readMs', 'writeMs']); if (diskIo != null) result.diskIo = diskIo;
        const networkProbes = cleanMetricList(data.networkProbes, ['target', 'gateway', 'reachable', 'lossPercent', 'latencyMs']); if (networkProbes != null) result.networkProbes = networkProbes;
        if ((data.localSecurity != null) && (typeof data.localSecurity === 'object')) {
            const local = data.localSecurity, cleanLocal = {};
            if (Array.isArray(local.administrators)) cleanLocal.administrators = local.administrators.filter(function (x) { return (typeof x === 'string') && (x.length <= 128); }).slice(0, 64);
            if (Array.isArray(local.listeningPorts)) cleanLocal.listeningPorts = local.listeningPorts.filter(function (x) { return Number.isInteger(x) && (x > 0) && (x <= 65535); }).slice(0, 1024);
            if (Array.isArray(local.accounts)) cleanLocal.accounts = local.accounts.filter(function (x) { return x && (typeof x.name === 'string') && (x.name.length <= 128) && (typeof x.enabled === 'boolean'); }).slice(0, 256).map(function (x) { return { name: x.name, enabled: x.enabled }; });
            if ((local.protocols != null) && (typeof local.protocols === 'object')) { cleanLocal.protocols = {}; for (var protocol of ['smb1', 'tls10', 'tls11', 'ntlmv1']) { if (typeof local.protocols[protocol] === 'boolean') cleanLocal.protocols[protocol] = local.protocols[protocol]; } }
            if ((local.remoteAccess != null) && (typeof local.remoteAccess === 'object')) cleanLocal.remoteAccess = { rdp: local.remoteAccess.rdp === true, ssh: local.remoteAccess.ssh === true };
            if ((local.passwordPolicy != null) && (typeof local.passwordPolicy === 'object')) {
                const minimumLength = Number(local.passwordPolicy.minimumLength), maximumAgeDays = Number(local.passwordPolicy.maximumAgeDays), lockoutThreshold = Number(local.passwordPolicy.lockoutThreshold);
                if (Number.isFinite(minimumLength) && Number.isFinite(maximumAgeDays) && Number.isFinite(lockoutThreshold)) cleanLocal.passwordPolicy = { minimumLength: minimumLength, maximumAgeDays: maximumAgeDays, lockoutThreshold: lockoutThreshold };
            }
            result.localSecurity = cleanLocal;
        }
        return result;
    }

    obj.reconcileTelemetry = function (data, device) {
        const normalized = normalizeTelemetry(data);
        if (normalized != null) obj.reconcileSource('telemetry', normalized, device);
    };

    obj.recordConnectivityChange = function (meshid, nodeid, connected, connectType, time, deviceName) {
        if ((connectType !== 1) || (typeof meshid !== 'string') || (typeof nodeid !== 'string')) return;
        var transitionTime = (typeof time === 'number') ? time : Date.now();
        if (!Number.isFinite(transitionTime) || (transitionTime > (Date.now() + 60000))) transitionTime = Date.now();
        var history = obj.connectivityHistory[nodeid];
        if (history == null) history = obj.connectivityHistory[nodeid] = [];
        history.push(transitionTime);
        const cutoff = transitionTime - 86400000;
        obj.connectivityHistory[nodeid] = history = history.filter(function (entry) { return entry >= cutoff; });
        obj.reconcileSource('connectivity', { history: history, transition: true, connected: connected }, { _id: nodeid, meshid: meshid, name: deviceName });
    };

    obj.notifyActiveToUser = function (user, nodeid, alertType, onlyChannels) {
        for (var id in obj.states) {
            const state = obj.states[id];
            if ((state.nodeid === nodeid) && (state.alertType === alertType)) {
                const definition = obj.catalog[alertType];
                if (definition != null) deliverToUser(user, definition, 'active', state, onlyChannels);
            }
        }
    };

    obj.getClientPolicy = function (user, callback) {
        obj.ensurePolicy(user, function (policy) {
            const domain = parent.config.domains[policy.domain];
            const effectiveAccount = {};
            for (var typeId in obj.catalog) {
                effectiveAccount[typeId] = {};
                for (var channelIndex = 0; channelIndex < obj.catalog[typeId].channels.length; channelIndex++) {
                    const channelName = obj.catalog[typeId].channels[channelIndex];
                    effectiveAccount[typeId][channelName] = resolveChannel(policy, null, null, typeId, channelName);
                }
            }
            const response = {
                action: 'notificationpolicy', version: POLICY_VERSION, catalog: obj.getCatalog(), rules: clone(policy.rules), ignored: [],
                channelsAvailable: { web: true, email: !!(domain && domain.mailserver && user.email && (user.emailVerified === true)), messaging: !!(parent.msgserver && user.msghandle) },
                effective: { account: effectiveAccount }, reminderIntervalHours: obj.remindersEnabled ? 24 : 0, reminderTime: obj.reminderTime, remindersEnabled: obj.remindersEnabled
            };
            var pending = 0, completed = false, ignoredNodeIds = {};
            const finish = function () { if (!completed && (--pending <= 0)) { completed = true; callback(response); } };
            for (var i = 0; i < policy.ignored.length; i++) {
                const item = policy.ignored[i];
                if ((item == null) || (typeof item !== 'object')) continue;
                const definition = obj.catalog[item.alertType];
                if ((definition != null) && (ignoredNodeIds[item.nodeid] == null)) ignoredNodeIds[item.nodeid] = true;
            }
            const ignoredNodeKeys = Object.keys(ignoredNodeIds);
            pending = ignoredNodeKeys.length;
            for (var nodeIndex = 0; nodeIndex < ignoredNodeKeys.length; nodeIndex++) {
                parent.db.Get(ignoredNodeKeys[nodeIndex], function (err, nodes) {
                    if ((err == null) && Array.isArray(nodes) && (nodes.length === 1)) {
                        const node = nodes[0];
                        for (var ignoredIndex = 0; ignoredIndex < policy.ignored.length; ignoredIndex++) {
                            const ignoredItem = policy.ignored[ignoredIndex];
                            if ((ignoredItem == null) || (typeof ignoredItem !== 'object')) continue;
                            const ignoredDefinition = obj.catalog[ignoredItem.alertType];
                            if ((ignoredItem.nodeid === node._id) && (ignoredDefinition != null) && hasRights(user, ignoredDefinition, node.meshid, node._id)) {
                                const visibleItem = clone(ignoredItem);
                                visibleItem.meshid = node.meshid;
                                visibleItem.deviceName = node.name;
                                response.ignored.push(visibleItem);
                            }
                        }
                    }
                    finish();
                });
            }
            if (pending === 0) callback(response);
        });
    };

    function runReminders() {
        if (obj.remindersEnabled !== true) return;
        const now = Date.now();
        for (var id in obj.states) {
            const state = obj.states[id], definition = obj.catalog[state.alertType];
            if ((definition == null) || (definition.reminders !== true)) continue;
            const connectivity = parent.connectivityByNode[state.nodeid];
            if ((connectivity == null) || ((connectivity.connectivity & 1) === 0)) continue;
            state.lastReminder = now;
            parent.db.Set(state);
            deliver(definition, 'reminder', state);
        }
    }

    function runConnectivityChecks() {
        const checked = {};
        for (var id in obj.states) {
            const state = obj.states[id];
            if ((state.alertType !== 'device.health.connectionFlapping') || (checked[state.nodeid] === true)) continue;
            checked[state.nodeid] = true;
            obj.reconcileSource('connectivity', { history: obj.connectivityHistory[state.nodeid] || [], transition: false }, { _id: state.nodeid, meshid: state.meshid, name: state.deviceName });
        }
        const cutoff = Date.now() - 86400000;
        for (var nodeid in obj.connectivityHistory) {
            obj.connectivityHistory[nodeid] = obj.connectivityHistory[nodeid].filter(function (entry) { return entry >= cutoff; });
            if (obj.connectivityHistory[nodeid].length === 0) delete obj.connectivityHistory[nodeid];
        }
    }

    function runModulePeriodicChecks() {
        const modules = obj.coreAlertModules.filter(function (alertModule) { return alertModule.periodic === true; });
        for (var moduleIndex = 0; moduleIndex < modules.length; moduleIndex++) {
            const alertModule = modules[moduleIndex], devices = {};
            if (alertModule.source === 'netinfo') {
                for (var networkNodeId in obj.networkInfo) devices[networkNodeId] = obj.networkInfo[networkNodeId].device;
            }
            if ((alertModule.source === 'sysinfo') && (alertModule.periodicAll === true)) {
                for (var sysInfoNodeId in obj.sysInfo) devices[sysInfoNodeId] = obj.sysInfo[sysInfoNodeId].device;
            }
            for (var observationKey in obj.observations) {
                const observation = obj.observations[observationKey];
                if (observation.alertType === alertModule.definition.id) devices[observation.nodeid] = { _id: observation.nodeid, meshid: observation.meshid, name: observation.deviceName };
            }
            for (var stateKey in obj.states) {
                const state = obj.states[stateKey];
                if (state.alertType === alertModule.definition.id) devices[state.nodeid] = { _id: state.nodeid, meshid: state.meshid, name: state.deviceName };
            }
            for (var nodeid in devices) {
                var data = { periodic: true };
                if ((alertModule.source === 'netinfo') && (obj.networkInfo[nodeid] != null)) data = obj.networkInfo[nodeid].data;
                else if ((alertModule.source === 'sysinfo') && (alertModule.periodicAll === true) && (obj.sysInfo[nodeid] != null)) data = obj.sysInfo[nodeid].data;
                else if (alertModule.source === 'connectivity') data.connected = !!(parent.connectivityByNode[nodeid] && ((parent.connectivityByNode[nodeid].connectivity & 1) !== 0));
                reconcileModule(alertModule, data, devices[nodeid], null, true);
            }
        }
    }

    function runPeriodicChecks() {
        runConnectivityChecks();
        runModulePeriodicChecks();
    }

    function scheduleNextReminder() {
        if (obj.remindersEnabled !== true) return;
        const now = Date.now(), next = new Date(now);
        next.setHours(obj.reminderHour, obj.reminderMinute, 0, 0);
        if (next.getTime() <= now) next.setDate(next.getDate() + 1);
        obj.reminderTimer = setTimeout(function () {
            obj.reminderTimer = null;
            runReminders();
            scheduleNextReminder();
        }, next.getTime() - now);
    }

    obj.init = function () {
        if (obj.initialized === true) return;
        obj.initialized = true;
        parent.db.GetAllType('notificationPolicy', function (err, docs) {
            if ((err == null) && Array.isArray(docs)) { for (var i = 0; i < docs.length; i++) obj.importPolicy(docs[i]); }
            if (parent.webserver && parent.webserver.users) {
                const userids = Object.keys(parent.webserver.users), migrateBatch = function (start) {
                    const end = Math.min(start + 100, userids.length);
                    for (var i = start; i < end; i++) obj.ensurePolicy(parent.webserver.users[userids[i]]);
                    if (end < userids.length) setTimeout(function () { migrateBatch(end); }, 10);
                };
                migrateBatch(0);
            }
        });
        parent.db.GetAllType('alertObservation', function (observationErr, observationDocs) {
            if ((observationErr == null) && Array.isArray(observationDocs)) { for (var observationIndex = 0; observationIndex < observationDocs.length; observationIndex++) obj.importObservation(observationDocs[observationIndex]); }
            obj.observationsReady = true;
            parent.db.GetAllType('alertState', function (err, docs) {
                if ((err == null) && Array.isArray(docs)) { for (var i = 0; i < docs.length; i++) obj.importState(docs[i]); }
                obj.statesReady = true;
                const pendingStateOperations = obj.pendingStateOperations;
                obj.pendingStateOperations = [];
                for (var pendingIndex = 0; pendingIndex < pendingStateOperations.length; pendingIndex++) obj.setAlertState(pendingStateOperations[pendingIndex].owner, pendingStateOperations[pendingIndex].data);
                const pendingReconciliations = obj.pendingReconciliations;
                obj.pendingReconciliations = [];
                for (var reconciliationIndex = 0; reconciliationIndex < pendingReconciliations.length; reconciliationIndex++) {
                    const pending = pendingReconciliations[reconciliationIndex];
                    obj.reconcileSource(pending.source, pending.data, pending.device, pending.previousData);
                }
            // Only one peer reconciles persisted inventory on startup. Live coreinfo is
            // still evaluated by the peer that owns each connected agent.
                if ((parent.multiServer != null) && (Object.keys(parent.config.peers.servers).sort()[0] !== parent.serverId)) return;
                parent.db.GetAllType('node', function (nodeErr, nodes) {
                    if ((nodeErr != null) || !Array.isArray(nodes)) return;
                    parent.db.GetAllType('sysinfo', function (sysinfoErr, sysinfos) {
                    const sysinfoByNode = {};
                    if ((sysinfoErr == null) && Array.isArray(sysinfos)) {
                        for (var sysinfoIndex = 0; sysinfoIndex < sysinfos.length; sysinfoIndex++) {
                            if ((typeof sysinfos[sysinfoIndex]._id === 'string') && sysinfos[sysinfoIndex]._id.startsWith('sinode/')) sysinfoByNode[sysinfos[sysinfoIndex]._id.substring(2)] = sysinfos[sysinfoIndex];
                        }
                    }
                    for (var sysInfoPreloadIndex = 0; sysInfoPreloadIndex < nodes.length; sysInfoPreloadIndex++) {
                        if (sysinfoByNode[nodes[sysInfoPreloadIndex]._id] != null) obj.sysInfo[nodes[sysInfoPreloadIndex]._id] = { data: clone(sysinfoByNode[nodes[sysInfoPreloadIndex]._id]), device: clone(nodes[sysInfoPreloadIndex]) };
                    }
                        parent.db.GetAllType('ifinfo', function (ifinfoErr, ifinfos) {
                            const ifinfoByNode = {};
                            if ((ifinfoErr == null) && Array.isArray(ifinfos)) {
                                for (var ifinfoIndex = 0; ifinfoIndex < ifinfos.length; ifinfoIndex++) {
                                    if ((typeof ifinfos[ifinfoIndex]._id === 'string') && ifinfos[ifinfoIndex]._id.startsWith('ifnode/')) ifinfoByNode[ifinfos[ifinfoIndex]._id.substring(2)] = ifinfos[ifinfoIndex];
                                }
                            }
                            for (var preloadIndex = 0; preloadIndex < nodes.length; preloadIndex++) {
                                if (ifinfoByNode[nodes[preloadIndex]._id] != null) obj.networkInfo[nodes[preloadIndex]._id] = { data: clone(ifinfoByNode[nodes[preloadIndex]._id]), device: clone(nodes[preloadIndex]) };
                            }
                            var index = 0;
                            const nextBatch = function () {
                        const end = Math.min(index + 100, nodes.length);
                        for (; index < end; index++) {
                            obj.reconcileNodeHealth(nodes[index]);
                            obj.reconcileNode(nodes[index]);
                            if (sysinfoByNode[nodes[index]._id] != null) obj.reconcileSysInfo(sysinfoByNode[nodes[index]._id], nodes[index]);
                            if (ifinfoByNode[nodes[index]._id] != null) obj.reconcileSource('netinfo', ifinfoByNode[nodes[index]._id], nodes[index]);
                        }
                        if (index < nodes.length) setTimeout(nextBatch, 10);
                    };
                    nextBatch();
                        });
                    });
                });
            });
        });
        obj.periodicTimer = setInterval(runPeriodicChecks, 60000);
        scheduleNextReminder();
    };

    obj.close = function () {
        if (obj.periodicTimer != null) clearInterval(obj.periodicTimer);
        if (obj.reminderTimer != null) clearTimeout(obj.reminderTimer);
        for (var channel of ['email', 'messaging']) { for (var userid in obj.externalQueues[channel]) clearTimeout(obj.externalQueues[channel][userid].timer); }
    };

    return obj;
};

module.exports._test = { resolveChannel: resolveChannel, migrateLegacyPolicy: migrateLegacyPolicy, evaluateHealth: evaluateHealth, stateId: stateId, observationId: observationId };
