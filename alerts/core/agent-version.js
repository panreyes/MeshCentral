/*jshint node: true */
/*jshint esversion: 6 */
'use strict';

module.exports = {
    definition: { id: 'device.compliance.agentVersion', title: 'MeshAgent version', group: 'Device compliance', kind: 'state', channels: ['web', 'email', 'messaging'], severity: 'warning', reminders: true, resolutions: true, ignorable: true, requiredRight: 0 },
    source: 'node',
    evaluate: function (context) {
        const configured = context.settings && context.settings.agentversion;
        const minimum = configured && configured.minimum;
        if (!Number.isInteger(minimum) || (minimum <= 0)) return context.isActive('') ? [{ state: 'healthy', detail: 'Minimum agent version policy is disabled' }] : [];
        const current = context.data && context.data.agent && context.data.agent.ver;
        if (!Number.isInteger(current) || (current <= 0)) return [];
        return [{ state: (current < minimum) ? 'active' : 'healthy', detail: 'Agent version is ' + current + '; minimum is ' + minimum, variables: { current: current, minimum: minimum } }];
    }
};
