/*jshint node: true */
/*jshint esversion: 6 */
'use strict';
module.exports = {
    definition: { id: 'device.inventory.localAccountChanged', title: 'Local account changed', group: 'Device inventory', kind: 'event', channels: ['web', 'email', 'messaging'], severity: 'info', requiredRight: 0x00100000 }, source: 'telemetry',
    evaluate: function (context) {
        const enabled = context.settings && context.settings.localaccountchanged && (context.settings.localaccountchanged.enabled === true), accounts = context.data && context.data.localSecurity && context.data.localSecurity.accounts;
        if (!enabled) { context.removeObservation(''); return []; }
        if (!Array.isArray(accounts)) return [];
        const current = accounts.filter(function (x) { return x && (typeof x.name === 'string') && (typeof x.enabled === 'boolean'); }).map(function (x) { return x.name.toLowerCase() + '|' + x.enabled; }).sort(), previous = context.getObservation('');
        context.setObservation('', { accounts: current });
        if (!previous || !Array.isArray(previous.accounts) || (JSON.stringify(previous.accounts) === JSON.stringify(current))) return [];
        const added = current.filter(function (x) { return previous.accounts.indexOf(x) < 0; }), removed = previous.accounts.filter(function (x) { return current.indexOf(x) < 0; });
        return [{ detail: 'Local account inventory changed', variables: { added: added, removed: removed } }];
    }
};
