# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.0] - 2026-05-13

### Added
- **Two-phase template substitution.** The runtime bridge now performs a
  Phase-2 substitution pass on `component_trigger`, `component_update`, and
  `component_sync` events: it walks the iframe DOM (skipping `<script>`,
  `<style>`, `<template>` content) and replaces any remaining `{token}`
  placeholders in text nodes and attribute values with values from
  `state.variantConfig` merged with `event.payload.data`. Mirrors the
  pre-iframe pipeline where globals baked at serve time and variants
  substituted on each trigger.

  This is purely additive — widgets that already handle triggers
  imperatively keep working. To use it, leave `{variantToken}` placeholders
  in the served HTML/CSS and configure the corresponding fields in
  `widget.json`'s `variantConfig`. Trigger payloads can override on a
  per-event basis.

- **Shell-injected seed state.** When the iframe shell defines
  `window.__EEKO_INIT__ = { componentId, userId, globalConfig, variantConfig }`
  before loading `/_runtime/sdk.js`, the bridge picks it up synchronously
  at boot and runs the initial Phase-2 pass against `variantConfig`. This
  lets the first paint show configured variant values without waiting for
  the parent's postMessage init.

## [0.5.0] - 2026-05-13

### Changed
- **Breaking (chat_message only):** The runtime bridge now unwraps the
  `{type, context, payload}` wire envelope for `chat_message` events and
  emits the inner `UnifiedMessage` directly. `UnifiedMessage` is already
  the canonical developer-facing shape (discriminated by its own `type`
  field — `chat_message` / `monetary_event` / `subscription_event` /
  `engagement_event` — with `context`, `user`, `message`, etc.), and the
  outer envelope only carries `userId` as unique information (available
  via `eekoSDK.getState().userId`).

  ```ts
  // Before (v0.4.x)
  eekoSDK.on('chat_message', (event) => {
    const username = event.payload.user.username
    const text = event.payload.message.text
  })

  // After (v0.5.0)
  eekoSDK.on('chat_message', (msg) => {
    // msg is a UnifiedMessage; discriminate on msg.type
    if (msg.type === 'chat_message') {
      const username = msg.user.username
      const text = msg.message.text
    } else if (msg.type === 'engagement_event' && msg.subType === 'follow') {
      celebrate(msg.user.username)
    } else if (msg.type === 'subscription_event') {
      // msg.subscriber, msg.subscription.tier
    } else if (msg.type === 'monetary_event') {
      // msg.user, msg.monetary.amount, msg.monetary.currency
    }
  })
  ```

  Other events (`component_trigger`, `component_update`, `component_dismiss`,
  `component_sync`, `variable_updated`) keep the envelope intact — their
  outer `context` carries `instanceId` / `variableId` / etc. that the
  payload doesn't, so unwrapping there would lose information. A future
  minor will revisit those with a richer normaliser.

## [0.4.0] - 2026-05-03

### Changed
- **Breaking:** `chat_message`, `component_trigger`, `component_update`,
  `component_dismiss`, `component_sync`, and `variable_updated` payloads now
  arrive as a `{type, context, payload}` envelope (symmetric with the
  inbound `TriggerCandidate` shape used upstream). Widget code that was
  destructuring the flat payload directly should now read from
  `envelope.payload` (and `envelope.context` for routing fields):
  ```ts
  // Before
  sdk.on('component_trigger', (data) => doStuff(data.component_id, data.data))
  // After
  sdk.on('component_trigger', (envelope) => doStuff(envelope.context.componentId, envelope.payload.data))
  ```
  The canonical wire schemas live in `@eeko/event-contracts`; SDK type
  definitions are kept in lockstep.

### Added
- `'component_dismiss'` is now an accepted event type in the runtime
  bridge's `EVENT_TYPES` whitelist (was being silently dropped at the
  iframe boundary even though the overlay was forwarding it).
- New envelope type aliases exported from the package entry:
  `ComponentTriggerEnvelope`, `ComponentUpdateEnvelope`,
  `ComponentDismissEnvelope`, `ComponentSyncEnvelope`,
  `ChatMessageEnvelope`, `VariableUpdatedEnvelope`.

## [0.3.0] - 2026-04-17

### Added
- `@eeko/sdk/runtime-bridge` subpath export: a self-contained bridge runtime
  used by both the production widget-host worker (parent-postMessage transport)
  and `@eeko/cli` (WebSocket transport). Embedders opt into dev mode by
  setting `window.__EEKO_DEV__ = { wsUrl }` before the bridge loads.

## [0.2.0] - 2026-04-15

### Changed
- **Breaking:** `IEekoSDKInternal` is no longer exported from the package entry.
  The `_emit`, `_setState`, and `_initialize` methods are host-runtime
  concerns and must not be part of the public surface that widget authors
  type against. Adapters (overlay runtime, dev CLI) should declare the
  extended shape locally.

## [0.1.3] - 2025-11-29

### Changed
- Remove release asset upload from publish workflow

## [0.1.2] - 2025-11-29

### Fixed
- Fix release asset upload in publish workflow

## [0.1.1] - 2025-11-29

### Fixed
- Correct pnpm pack command in publish workflow

## [0.1.0] - 2025-11-29

### Added
- Core SDK types and interfaces (`IEekoSDK`, `IEekoSDKInternal`)
- Event system with type-safe handlers
- Component trigger and update payloads
- Chat message payloads with platform support
- Lifecycle event payloads (mount/unmount)
- Variable update payloads
- Error classes for SDK errors
- Event constants (`EEKO_EVENTS`)
- CI/CD workflows for testing and npm publishing

[Unreleased]: https://github.com/EekoBot/sdk/compare/0.6.0...HEAD
[0.6.0]: https://github.com/EekoBot/sdk/compare/0.5.0...0.6.0
[0.5.0]: https://github.com/EekoBot/sdk/compare/0.4.0...0.5.0
[0.4.0]: https://github.com/EekoBot/sdk/compare/0.3.0...0.4.0
[0.3.0]: https://github.com/EekoBot/sdk/compare/0.2.0...0.3.0
[0.2.0]: https://github.com/EekoBot/sdk/compare/0.1.3...0.2.0
[0.1.3]: https://github.com/EekoBot/sdk/compare/0.1.2...0.1.3
[0.1.2]: https://github.com/EekoBot/sdk/compare/0.1.1...0.1.2
[0.1.1]: https://github.com/EekoBot/sdk/compare/0.1.0...0.1.1
[0.1.0]: https://github.com/EekoBot/sdk/releases/tag/0.1.0
