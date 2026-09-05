# Built-in alert modules

MeshCentral loads every JavaScript file in `alerts/core` when the server starts.
Each file exports one trusted built-in alert module. External plugins must use
the plugin alert API instead of writing files into this directory.

Event modules that are emitted by existing server code export only a catalog definition:

```js
module.exports = {
    definition: {
        id: 'device.example.event',
        title: 'Example event',
        group: 'Examples',
        kind: 'event',
        channels: ['web']
    }
};
```

An event detected from inventory can also declare `source` and `evaluate`, like
a state module. Its evaluator returns an empty array or event objects containing
`detail` and optional limited JSON `variables`.

State modules also declare their input source and an evaluator:

```js
module.exports = {
    definition: {
        id: 'device.health.example',
        title: 'Example health state',
        group: 'Device health',
        kind: 'state',
        channels: ['web', 'email', 'messaging'],
        severity: 'warning',
        reminders: true,
        resolutions: true,
        ignorable: true,
        requiredRight: 0x00100000
    },
    source: 'sysinfo',
    evaluate: function (context) {
        return [{ instanceKey: '', state: 'unknown' }];
    }
};
```

Supported sources are `coreinfo`, `sysinfo`, `netinfo`, the persisted `node`
record, inventory-check heartbeats, and server-generated `connectivity`
transitions. The evaluator receives `node`,
`data`, the normalized alert `settings`, `isActive(instanceKey)`, and
`getState(instanceKey)`. It also receives `previousData` when a previous
inventory document exists. Modules that need a small amount of durable timing
history may use `getObservation`, `getObservations`, `setObservation`, and
`removeObservation`; these records are limited in size and never represent an
alert by themselves. Modules marked `periodic: true` are re-evaluated once per
minute while they have an observation or active state. A trusted global
comparison module may additionally use the duplicate-identity helpers supplied
by the engine; their results must not expose peers the current user cannot see.
State evaluators must
return an array of `active`, `healthy`, or `unknown` results. Results may also
contain `instanceKey`, `detail`, and limited JSON `variables`.

Evaluators must not access the database or deliver notifications. Observation
updates go through the context API so the central engine owns all persistence,
state storage, deduplication, permissions, ignored alerts, reminders, Events,
and channel delivery. Missing or malformed input should return `unknown`, never
`healthy`.
