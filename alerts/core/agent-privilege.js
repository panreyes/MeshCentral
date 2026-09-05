/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

module.exports = {
    definition: { id: 'device.security.agentPrivilegeLost', title: 'MeshAgent lacks administrative privileges', group: 'Device security', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0 },
    source: 'node',
    evaluate: function (context) {
        const configured = context.settings && context.settings.agentprivilege, required = configured && (configured.required === true);
        if (!required) return context.isActive('') ? [{ state: 'healthy', detail: 'Administrative MeshAgent privileges are not required by policy' }] : [];
        const root = context.data && context.data.agent && context.data.agent.root;
        if (typeof root !== 'boolean') return [];
        return [{ state: root ? 'healthy' : 'active', detail: root ? 'MeshAgent is running with administrative privileges' : 'MeshAgent is running with reduced privileges', variables: { administrative: root } }];
    }
};
module.exports.settings = { key: 'agentprivilege', fields: [["required","boolean",false]] };
