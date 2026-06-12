/**
 * @eeko/sdk — the widget authoring guide (markdown, assembled from the SDK's
 * own typed constants).
 *
 * SSOT discipline: every event name, op name, manifest field type/scope,
 * animation preset, queue policy, and forbidden pattern in the rendered
 * markdown is INTERPOLATED from the same runtime constants the interpreter
 * and validators execute against (`EVENT_TYPES`, `ACTION_OPS`,
 * `MANIFEST_FIELD_TYPES`, …) — the guide cannot name an API the SDK doesn't
 * ship. `guide.test.ts` pins the inverse direction (every constant appears in
 * the output).
 *
 * Consumers: `@eeko/cli` scaffolds this as AGENTS.md into widget projects so
 * authoring agents read it in-repo; the docsite renders it; `eeko build` runs
 * the companion validators (`validateManifest`, `validateInteractions`,
 * `lintWidget`).
 */
import { EVENT_TYPES } from '../events'
import { VERSION } from '../index'
import {
  ACTION_OPS,
  ANIMATION_PRESETS,
  BEHAVIOR_BINDING_KEYS,
  QUEUE_POLICIES,
  TIMER_TICK,
} from '../interactions/types'
import { MANIFEST_FIELD_SCOPES, MANIFEST_FIELD_TYPES } from '../template/manifest'
import { BINDING_KINDS, EVENT_CATALOG, FORBIDDEN_PATTERNS, OP_CATALOG } from './catalog'

/** Guide version — always equal to the SDK VERSION it documents. */
export const AUTHORING_GUIDE_VERSION: string = VERSION

const fence = '```'

// ── Rendering helpers ────────────────────────────────────────────────────────

const eventList = EVENT_TYPES.map((e) => `\`${e}\``).join(', ')
// NOTE: joined with ', ' (not ' | ') because these render inside markdown
// table cells, where an unescaped pipe terminates the cell.
const fieldTypeList = MANIFEST_FIELD_TYPES.map((t) => `\`${t}\``).join(', ')
const fieldScopeList = MANIFEST_FIELD_SCOPES.map((s) => `\`${s}\``).join(', ')
const presetList = ANIMATION_PRESETS.map((p) => `\`${p}\``).join(', ')
const queuePolicyList = QUEUE_POLICIES.map((q) => `\`${q}\``).join(' / ')
const behaviorKeyList = BEHAVIOR_BINDING_KEYS.map((k) => `\`${k}\``).join(' / ')

const opsDoc = ACTION_OPS.map((op) => {
  const doc = OP_CATALOG[op]
  return `#### \`${op}\`

${doc.summary}

Params: ${doc.params}

${fence}json
${doc.example}
${fence}`
}).join('\n\n')

const bindingsDoc = BINDING_KINDS.map(
  (b) => `- \`${b.syntax}\` — ${b.semantics}`
).join('\n')

const eventsDoc = EVENT_TYPES.map((event) => {
  const doc = EVENT_CATALOG[event]
  return `#### \`${event}\`

${doc.summary}

Handler shape: \`${doc.handlerShape}\`.

${doc.payloadDoc}

${fence}js
${doc.example}
${fence}`
}).join('\n\n')

const forbiddenDoc = FORBIDDEN_PATTERNS.map(
  (p, i) => `### ${i + 1}. \`${p.pattern}\`

**Why it breaks:** ${p.why}

**Instead:** ${p.instead}`
).join('\n\n')

// ── Sections ─────────────────────────────────────────────────────────────────

const THE_WIDGET_CONTRACT = `## The widget contract {#the-widget-contract}

A widget is a git repository whose root contains exactly four files:

| File | Role |
| --- | --- |
| \`widget.json\` | The manifest: name, componentType, configurable \`fields\`, \`behavior\`, \`globalConfig\`, \`variantConfig\`, and (preferred) the declarative \`interactions\` block. |
| \`index.html\` | The widget markup. **Body-only** — no \`<!DOCTYPE>\`, \`<html>\`, \`<head>\`, \`<body>\`, no \`<link rel="stylesheet">\`, no \`<script src>\`. The host renders its own shell page and inlines your CSS and JS into it; full documents nest html/body and file references 404. |
| \`styles.css\` | Styles, scoped to the iframe. Inlined into the shell automatically. |
| \`script.js\` | Widget logic (the escape hatch — declarative widgets ship it untouched). Embedded inside a \`<script>\` tag. |

All three code files may use \`{fieldKey}\` placeholders, substituted with context-aware escaping (HTML-escaped in HTML, CSS-escaped in CSS, JS-string-escaped in JS) — see the two-phase token model.

The repository is the deployable unit. Every commit is a complete, renderable snapshot of the widget:

- the **draft** ref is the working/preview branch — the editor and preview iframe re-fetch and re-render it on every commit;
- **main** is the published ref that live overlays (OBS) render. Publishing promotes draft onto main; it is always an explicit human action, never automatic.

The widget runs inside a sandboxed cross-origin iframe (\`*.widgets.eeko.app\`) with a strict CSP. Real-time events (chat messages, component triggers, variable updates) reach it exclusively through the SDK bridge at \`window.eekoSDK\` — or, preferably, through the declarative \`interactions\` block the SDK runtime interprets for you.`

const THE_MANIFEST = `## The manifest (widget.json) {#the-manifest}

Required keys: \`name\` (non-empty string) and \`componentType\` (non-empty string — e.g. \`alert\`, \`chat\`, \`overlay\`, \`countdown\`, \`poll\`, \`banner\`). \`fields\` is an **array** of field schemas (not an object); the validator defaults it to \`[]\` when omitted, but every widget with configurable values declares it.

${fence}json
{
  "name": "Follower Alert",
  "componentType": "alert",
  "fields": [
    { "key": "backgroundColor", "label": "Background", "type": "color", "scope": "global", "defaultValue": "#1e1e2e" },
    { "key": "accentColor", "label": "Accent colour", "type": "color", "scope": "global", "defaultValue": "#a78bfa" }
  ],
  "behavior": { "displayDuration": 5000 },
  "globalConfig": { "backgroundColor": "#1e1e2e", "accentColor": "#a78bfa" },
  "variantConfig": {},
  "interactions": { "version": 1, "on": {} }
}
${fence}

### Field schema

Each entry in \`fields\`:

| Property | Type | Notes |
| --- | --- | --- |
| \`key\` | string (required) | The config key; referenced as \`{key}\` in HTML/CSS/JS. |
| \`label\` | string (required) | Human label shown in the editor. |
| \`type\` | required | One of: ${fieldTypeList}. \`image\` / \`audio\` / \`video\` values are \`eeko-asset://<id>\` references (the editor renders an asset picker). |
| \`scope\` | required | One of: ${fieldScopeList}. \`global\` bakes at serve time; \`variant\` is substituted per trigger; \`both\` participates in either. Use \`global\` unless you specifically need per-trigger config (rare). |
| \`defaultValue\` | any | The field's default. |
| \`required\` | boolean | |
| \`min\` / \`max\` / \`step\` | number | Bounds for \`number\` fields. |
| \`options\` | \`{ label, value }[]\` | Choices for \`select\` fields. |
| \`placeholder\` / \`helpText\` / \`category\` | string | Editor presentation. |
| \`mimeFilter\` | string[] | For asset fields: MIME prefixes the picker restricts to (e.g. \`["image/"]\`). |
| \`assetDisplay\` | \`"inline"\` \\| \`"compact"\` | UI hint for asset fields. |

### Rules

- **\`globalConfig\` must mirror every global-scope field's \`defaultValue\`, keyed by \`key\`.** Phase-1 substitution reads \`globalConfig\`; an unmirrored key leaves \`{token}\` as a literal on screen and the widget looks broken.
- \`variantConfig\` carries author-time defaults for per-trigger \`{tokens}\` (Phase 2 fills the live values from the trigger payload).
- \`behavior\` is a plain object the runtime reads reserved keys from:
  - \`displayDuration\` (number, ms) — how long an alert stays up; the interactions \`wait\` op reads it via \`{ "fromBehavior": "displayDuration" }\`;
  - \`soundUrl\` / \`soundVolume\` (0–1) — fallbacks for the \`play-sound\` op;
  - \`queueBehavior\` — the default queue policy (${queuePolicyList}) when \`interactions.queue\` doesn't set one for an event.
  The keys readable through a \`{ fromBehavior }\` binding are exactly: ${behaviorKeyList}.
  The widget's owner edits \`behavior\` values in Studio's config surface (they are not \`fields\` and need no field schema entry) — "configured display duration" means \`behavior.displayDuration\`, not a new field.
- \`interactions\` is optional only for a genuinely static widget; for anything that reacts to an event it is where the behaviour goes (next sections).
- Keep the manifest in sync with the code: if any file references \`{myColor}\`, declare a field with \`key: "myColor"\` and mirror its default.`

const TWO_PHASE_TOKENS = `## Two-phase token substitution {#two-phase-tokens}

\`{fieldKey}\` placeholders are filled in two passes:

**Phase 1 — serve time, on the server.** The host runs context-aware substitution over your files before the iframe loads:

- \`index.html\` substitutes against **globalConfig only** — variant-scope tokens stay literal so Phase 2 can fill them in the live DOM.
- \`styles.css\` and \`script.js\` substitute against **globalConfig + variantConfig** — neither is re-substituted at runtime (parsed JS can't be re-walked; the Phase-2 DOM walker skips \`<style>\` content). A CSS value therefore CANNOT change per trigger via tokens; drive it with a \`set-style-*\` interaction op instead.
- Values are escaped per context (HTML / CSS / JS-string). You never need to escape config values yourself.
- A token with no matching config key stays a literal \`{token}\` — this is the "empty globalConfig breaks the widget" failure.

**Phase 2 — per event, in the iframe.** On every \`component_trigger\` / \`component_update\` / \`component_sync\` the SDK walks the DOM (skipping \`<script>\` / \`<style>\` / \`<template>\`) and replaces remaining \`{tokens}\` in text nodes and attribute values with the event payload merged over \`variantConfig\` (payload wins on key collisions). Fully automatic — you call nothing.

**Which to use when:**

- Values the streamer configures once and that never change per event (colours, fonts, fixed labels, a goal target): a **global-scope field + Phase-1 token**.
- Values that change per event (\`{username}\`, \`{formattedAmount}\`): **prefer an interactions \`set-text\` / \`set-attr\` binding** — it is explicit, ordered, and guardable. Reach for a bare Phase-2 token only for a trivial always-on label; put its author-time default in \`variantConfig\`.
- **Never mix both mechanisms for the same value.**`

const DECLARATIVE_INTERACTIONS = `## Declarative interactions — the preferred way {#declarative-interactions}

**Behaviour is data, not code.** What a widget DOES — fill the avatar, show with an animation, wait, hide; clone a chat row; fill a goal bar; tick a countdown — lives as an ordered list of enumerated actions in \`widget.json\`'s \`interactions\` block, interpreted by the SDK runtime. A declarative widget ships the canonical seed \`script.js\` untouched; you normally do NOT write JS at all.

${fence}json
"interactions": {
  "version": 1,
  "on": {
    "<eventName>": [ { "op": "...", "...": "..." } ]
  },
  "queue": { "component_trigger": "queue" }
}
${fence}

- \`version\` must be \`1\`.
- \`on\` maps an event to an ordered **sequence of actions** run top-to-bottom each time the event fires. Bindable events: ${eventList}, plus the internal \`${TIMER_TICK}\` (emitted only by \`start-timer\`, never on the wire).
- \`queue\` (optional) sets a per-event policy for rapid repeats: \`"queue"\` (FIFO, one at a time — use for alerts), \`"replace"\` (cancel the in-flight run, start fresh), \`"skip"\` (drop new events while busy). Default \`queue\`; \`behavior.queueBehavior\` is the fallback.
- Sequencing: actions run in order. \`show\`, \`hide\`, and \`wait\` yield (the sequence resumes when they settle); every other op is synchronous.

### Targeting

Every element an action targets must carry a **stable \`data-eeko-el\` id** in \`index.html\` (e.g. \`data-eeko-el="el-title"\`). Actions reference elements by that id, never by CSS selector. An id the markup doesn't contain makes the action a silent no-op.

### Animation presets

\`show\` / \`hide\` take an \`animation\` preset name: ${presetList}. The matching keyframes ship in the widget-host shell (\`eeko-*\`) — **never define \`@keyframes\` for them in your CSS**; just name the preset.

- **\`hide\` plays the same preset keyframe in reverse.** \`hide\` + \`slide-up\` exits downward (the entrance undone); there is no separate exit-preset vocabulary.
- **Presets animate \`opacity\` and \`transform\`.** Never author your own \`transform\` on an element a preset targets — it gets clobbered for the animation's duration. Center panels with auto margins or \`left\`/\`right\`, not \`translateX(-50%)\`.

### The op vocabulary

${opsDoc}

### Bindings — where a value comes from

The \`from\` / \`value\` / \`index\` / \`numerator\` / \`denominator\` of an op is a binding with **exactly one** of these keys:

${bindingsDoc}

### Guards

Most ops accept an \`onlyIf\` guard — \`{ "from": "path", "op": "present" | "truthy" | "eq" | "gt", "value": ... }\` — which skips JUST that action when false (no else-branches, no control flow). Example: only set the avatar \`src\` when the payload carries one.

**The fallback idiom** (declarative \`a || b\`): write the fallback first, then overwrite with the preferred value guarded \`onlyIf present\`:

\`\`\`json
{ "op": "set-text", "target": "el-name", "from": { "from": "username" } },
{ "op": "set-text", "target": "el-name", "from": { "from": "displayName" }, "onlyIf": { "from": "displayName", "op": "present" } }
\`\`\`

### Counters

- Counters live **in memory for the current page load**: an iframe reload (OBS scene switch, browser-source refresh) resets every counter to 0. For a count that must survive reloads, track it as a user variable and render it from \`variable_updated\` instead.
- Give the on-screen counter its initial render value in the markup (e.g. \`<span data-eeko-el="el-count">0</span>\`) — nothing runs before the first event, so the markup is what shows until then.
- Queued runs execute one at a time against shared live state: a later queued run sees every counter mutation earlier runs made (three queued triggers display 1, 2, 3).

### \`component_dismiss\` and in-flight sequences

A \`component_dismiss\` sequence runs immediately, in parallel with any in-flight \`component_trigger\` run — it does not cancel a pending \`wait\`. The usual \`dismiss → hide\` pattern is safe: the trigger sequence's later \`hide\` simply re-hides an already-hidden element.

### The canonical alert lifecycle

Every alert is a variant of this — bind the fields, show with an entrance animation, wait the configured display time, hide with an exit animation, queued so rapid events play one at a time:

${fence}json
{
  "version": 1,
  "on": {
    "component_trigger": [
      { "op": "set-attr", "target": "el-avatar", "attr": "src", "from": { "from": "profilePictureUrl" }, "onlyIf": { "from": "profilePictureUrl", "op": "present" } },
      { "op": "set-text", "target": "el-title", "from": { "from": "displayName" } },
      { "op": "set-text", "target": "el-message", "from": { "from": "formattedAmount" } },
      { "op": "play-sound" },
      { "op": "show", "target": "el-alert", "animation": "slide-up" },
      { "op": "wait", "ms": { "fromBehavior": "displayDuration" } },
      { "op": "hide", "target": "el-alert", "animation": "fade" }
    ],
    "component_dismiss": [
      { "op": "hide", "target": "el-alert", "animation": "fade" }
    ]
  },
  "queue": { "component_trigger": "queue" }
}
${fence}

The alert panel starts hidden in CSS (\`visibility: hidden\`); the \`show\` op reveals it. \`component_dismiss\` hides it early.

### Trigger payload field names

\`from\` paths in a \`component_trigger\` sequence read **canonical, normalised data points** — never raw platform keys (it is \`displayName\`, NOT \`chatter_user_name\`). The payload is a flat record of the wired trigger's extracted data points merged with the owner's configured field values; **no key is guaranteed across all triggers.** Common data points are \`username\`, \`displayName\`, \`profilePictureUrl\`, \`message\`, \`amount\`, \`currency\`, \`formattedAmount\`, \`tier\`, \`months\`, \`giftCount\` — but presence varies by trigger (a follow has no \`amount\`), so bind only fields the wired trigger actually extracts, and guard optional ones with \`onlyIf present\`. Prefer \`formattedAmount\` (already currency-formatted) over re-formatting \`amount\`.

### Opting out

Hand-written \`script.js\` can disable the interpreter with \`window.eekoSDK.interactions.disable()\` at the very top (or \`disableEvent(name)\` per event). One caveat: the interpreter boots before \`script.js\` runs, so a \`component_mount\` sequence may already have fired by the time \`disable()\` executes — a fully hand-written widget should ship no \`interactions\` sequences at all rather than rely on disabling them. Mixing interpreted sequences and custom handlers on the same event is allowed but rarely what you want.`

const ARCHETYPE_RECIPES = `## Archetype recipes {#archetype-recipes}

Six pre-wired archetypes cover the standard widgets. Match them shape-for-shape; refine, don't rebuild.

### Alert (\`componentType: "alert"\`)
On \`component_trigger\` (flat payload): \`set-attr\` the avatar \`src\` (guarded \`onlyIf present\`) → \`set-text\` title from \`displayName\` → \`set-text\` message from \`formattedAmount\` → \`play-sound\` → \`show\` (entrance animation) → \`wait\` \`{ "fromBehavior": "displayDuration" }\` → \`hide\` (exit animation). \`component_dismiss\` → \`hide\`. \`queue: { "component_trigger": "queue" }\`. \`behavior: { "displayDuration": 5000, "queueBehavior": "queue" }\`. Panel has \`visibility: hidden\` in CSS.

### Chat overlay (\`componentType: "chat"\`)
On \`chat_message\` (nested payload): \`clone-template\` a hidden row prototype into the visible list — bindings \`el-row-user\` ← \`user.displayName\`, \`el-row-text\` ← \`message.text\` — then \`trim-children\` the list (\`max: 30\`, \`from: "oldest"\`). Keep the row prototype inside a hidden \`display:none\` wrapper and clone into a SEPARATE visible container (the clone must not inherit \`display:none\`; the prototype stays selectable in the editor). Always visible — no show/hide lifecycle.

### Goal / progress bar (\`componentType: "overlay"\`)
On \`variable_updated\`: \`set-style-ratio\` the fill's \`width\` to \`variable.value\` / \`goal\` (\`unit: "%"\`, \`clamp: true\`; \`goal\` is a global config token) → \`set-text\` the label from \`variable.value\`. Always visible. Give the fill a CSS \`transition: width 0.4s ease\` for smooth movement.

### Countdown (\`componentType: "countdown"\`)
On \`component_mount\`: \`start-timer\` (\`mode: "countdown"\`, \`intervalMs: 1000\`, \`durationMs\` from config) → \`show\` the panel. On \`${TIMER_TICK}\`: \`set-text\` the time element from \`{ "from": "remaining" }\` (the kit-formatted mm:ss string; \`elapsedMs\` / \`remainingMs\` carry raw millis). Panel has \`visibility: hidden\` in CSS — the mount \`show\` reveals it.

### Poll (\`componentType: "poll"\`)
The SAME sequence runs on BOTH \`component_sync\` (initial state) and \`component_update\` (live changes): per option, \`set-text\` the label → \`set-style-ratio\` the bar \`width\` to votes/total (clamped) → \`set-text\` the percent. Optional option rows (C/D) are \`visibility:hidden\` in the markup and revealed with \`show\` \`onlyIf\` their text is \`present\` in the payload. Always visible.

### Banner (rotating) (\`componentType: "banner"\`)
On \`component_mount\`: \`start-timer\` (\`mode: "interval"\`, e.g. \`intervalMs: 6000\`) → \`set-counter\` \`idx\` from \`{ "literal": 0 }\` → \`show-nth\` the container's first child by \`{ "fromCounter": "idx" }\` (\`wrap: true\`). The \`set-counter\` init is required: an unset counter reads as undefined and makes \`show-nth\` a silent no-op. On \`${TIMER_TICK}\`: \`increment-counter\` \`idx\` → \`show-nth\` again. Messages are static Phase-1 config tokens (\`{message1}\`, \`{message2}\`, …). Always visible.`

const THE_SDK_ESCAPE_HATCH = `## The SDK escape hatch — hand-written script.js {#the-sdk-escape-hatch}

Reach for custom \`script.js\` ONLY when the declarative interactions model genuinely can't express the behaviour (bespoke canvas/WebGL, complex stateful game logic, math the ops don't cover). **Custom handler bodies make the widget "custom": the visual builder degrades to style-only editing for it.** Prefer extending the \`interactions\` block first.

### The window.eekoSDK surface

${fence}ts
window.eekoSDK = {
  on(event, handler): void      // subscribe; handler receives the event payload
  off(event, handler): void     // unsubscribe
  getState(): { componentId, userId, globalConfig, variantConfig }
  isReady(): boolean
  interactions: { disable(), disableEvent(name), isManaged() }  // interpreter opt-out (see "Opting out")
}
${fence}

That is the entire public surface. There is no \`window.widget\`, no \`.onShow\`, no \`.onHide\` — events reach \`script.js\` ONLY through \`window.eekoSDK.on(...)\`.

### The canonical starting point

Every new widget's \`script.js\` starts as this seed — keep the structure (IIFE wrapper, SDK guard, real \`sdk.on(...)\` subscriptions) and fill in the handler bodies:

${fence}js
// Widget script — runs inside the sandboxed iframe.
// You receive events through window.eekoSDK. Fill in the handler bodies below;
// keep these window.eekoSDK.on(...) subscriptions — they are the only way in.
// Full surface: window.eekoSDK.on(type, handler), .off(type, handler),
// .getState(), .isReady(). There is no window.widget and no .onShow/.onHide.
;(function () {
  var sdk = window.eekoSDK
  if (!sdk) return

  // Fired when an automation triggers this widget (alerts). \`data\` is the flat
  // payload of canonical data points: data.username, data.displayName,
  // data.message, data.amount, data.formattedAmount, data.tier, data.giftCount,
  // data.months, data.type, ... (the exact set depends on the wired trigger).
  sdk.on('component_trigger', function (data) {
    // TODO: render the alert from \`data\`.
  })

  // Fired when the alert should dismiss / animate out.
  sdk.on('component_dismiss', function () {
    // TODO: hide and clean up.
  })

  // Other available events — uncomment the ones this widget needs:
  // sdk.on('chat_message', function (msg) {})        // chat overlays
  // sdk.on('variable_updated', function (v) {})      // goal bars / counters
  // sdk.on('component_update', function (data) {})   // live config/data change
})()
${fence}

Read config from the SAME keys you declared in \`widget.json\`: \`var config = sdk.getState().globalConfig || {}\`.

### Handler payload rule

**One rule for every event: the handler receives the event's payload, already unwrapped.** The \`{ type, context, payload }\` wire envelope never reaches your handler — do not write \`event.payload\`, \`event.context\`, or \`event.payload.data\` lookups; read fields directly off the argument.

### Events

${eventsDoc}`

const STYLING_RULES = `## Styling rules {#styling-rules}

- \`body { background: transparent }\` — always. Widgets render over the live stream in OBS; an opaque body covers it.
- The CSS is iframe-scoped — no resets needed beyond your own \`* { margin: 0; padding: 0; box-sizing: border-box; }\`, no namespacing, no leakage in or out.
- **Widgets are compact overlays, not full-screen scenery.** A small visible panel (typically 20–40% of canvas width), centered or corner-anchored. Never fill \`body\` with decorative backgrounds (skies, gradients, particle layers).
- **Alerts (and mount-revealed countdowns) start hidden:** \`visibility: hidden\` on the panel in CSS; the \`show\` op reveals it (and \`hide\` re-hides it). Without this the alert is permanently visible and the entrance animation has nothing to play. Always-on widgets — chat, goals, polls, banners — are visible by default.
- Do NOT define \`@keyframes\` for the animation presets (${presetList}) — the \`eeko-*\` keyframes live in the widget-host shell. Your CSS carries only the static look and the hidden/visible starting states.
- Static styling values use Phase-1 \`{tokens}\` — \`{backgroundColor}\`, \`{accentColor}\`, \`{fontFamily}\` — each declared as a global field with its default mirrored in \`globalConfig\`.`

const ASSETS = `## Assets {#assets}

User media (images, audio, video) lives in the user's Eeko asset library and is referenced by a literal token:

${fence}
eeko-asset://<assetId>
${fence}

- The host resolves the token to a short-lived signed URL at serve time, after re-verifying ownership.
- Tokens must be **whole-string literals** — runtime concatenation like \`'eeko-asset://' + id\` is not supported.
- Where they go: \`<img src="eeko-asset://...">\` / \`<audio src="...">\` in HTML; \`background-image: url("eeko-asset://...")\` in CSS; a \`globalConfig\` value referenced via \`{token}\`; the default of a manifest field with \`type: "image"\` / \`"audio"\` / \`"video"\` (the editor renders an asset picker for those).
- The \`set-attr\` op and \`play-sound\` op accept only \`eeko-asset://\` or \`https://\` URLs and reject everything else at runtime.
- **No external CDNs, no fetches.** The iframe CSP blocks arbitrary network calls; hotlinked third-party assets (Imgur, Giphy, Tenor) are a privacy leak and can vanish. If the right asset doesn't exist in the library, say so — never fabricate a URL.`

const FORBIDDEN_PATTERNS_SECTION = `## Forbidden patterns {#forbidden-patterns}

Each of these ships a broken (or rejected) widget. \`lintWidget\` / \`eeko build\` flags the statically detectable ones — full-document HTML, external file refs, \`window.widget\` / \`.onShow\` / \`.onHide\`, and \`eval\` / \`new Function\` as **errors**; \`innerHTML\` and \`eeko-*\` keyframes as **warnings**. The data-shape mistakes (legacy chat fields, \`JSON.parse\` of variable values) and network calls are not lintable — they surface only at runtime, so never write them in the first place.

${forbiddenDoc}

### Wrong vs right, side by side

${fence}js
// ❌ WRONG — hallucinated API; the widget never subscribes to anything.
window.widget.onShow(function (data) { render(data) })

// ✅ RIGHT — the only way in.
window.eekoSDK.on('component_trigger', function (data) { render(data) })
${fence}

${fence}js
// ❌ WRONG — legacy flat chat shape + envelope fallback. Renders
// "Anonymous" / "[object Object]" against a live UnifiedMessage.
var payload = event.payload || event
var sender = payload.sender || payload.username || payload.author
var text = payload.text || payload.message // .message is an OBJECT

// ✅ RIGHT — discriminate on msg.type, read the structured paths.
window.eekoSDK.on('chat_message', function (msg) {
  if (msg.type !== 'chat_message') return
  addRow(msg.user.displayName || msg.user.username, msg.message.text)
})
${fence}

${fence}html
<!-- ❌ WRONG — full document + file references; the shell inlines your CSS/JS, these 404. -->
<!DOCTYPE html>
<html><head><link rel="stylesheet" href="styles.css"></head>
<body><div class="alert"></div><script src="script.js"></script></body></html>

<!-- ✅ RIGHT — body-only markup with stable interaction ids. -->
<div data-eeko-el="el-alert" class="alert">
  <div data-eeko-el="el-title" class="alert__title"></div>
</div>
${fence}`

const LOCAL_TESTING = `## Local testing {#local-testing}

\`eeko dev\` serves the widget locally with the REAL SDK runtime (the same bridge + interaction interpreter production ships), connected over a local WebSocket. It writes \`.eeko-dev.json\` next to the widget so \`eeko test\` can find the running server, and emits \`component_mount\` on connect — mount-bound timers and sequences fire just like production.

\`eeko test <subcommand>\` injects events into the running dev server:

| Command | Event delivered | Payload shape |
| --- | --- | --- |
| \`eeko test trigger [--data '{"displayName":"Ada","formattedAmount":"$5.00"}']\` | \`component_trigger\` | Flat record of common trigger dataPoints (\`username\`, \`displayName\`, \`userId\`, \`channelName\`, \`amount\`, \`formattedAmount\`, \`message\`) — \`--data\` overrides or extends. |
| \`eeko test chat [--platform twitch\\|youtube\\|kick]\` | \`chat_message\` | UnifiedMessage with \`type: "chat_message"\`. |
| \`eeko test sub [--platform ...] [--tier 1\\|2\\|3] [--gift] [--resub --months N]\` | \`chat_message\` | UnifiedMessage with \`type: "subscription_event"\`. |
| \`eeko test bits [--amount 100]\` | \`chat_message\` | UnifiedMessage with \`type: "monetary_event"\`. |
| \`eeko test follow\` | \`chat_message\` | UnifiedMessage with \`type: "engagement_event"\`, \`subType: "follow"\`. |
| \`eeko test all-chat [--delay 500]\` | 6 × \`chat_message\` | Three chat lines + bits + sub + follow, spaced by \`--delay\` ms (mirrors the dashboard "Test Chat" button). |
| \`eeko test mount\` / \`eeko test unmount\` | \`component_mount\` / \`component_unmount\` | \`{ componentId, type, timestamp }\`. |
| \`eeko test update [--data '{}']\` | \`component_update\` | \`{ component_id, data, timestamp }\`. |

There is currently no dedicated subcommand for \`component_dismiss\`, \`component_sync\`, or \`variable_updated\`.

Dev/prod parity notes:

- Event payloads, Phase-2 token substitution, and interaction bindings behave identically in dev and production — the dev server normalises every test event to the same wire envelope production publishes.
- Serving differs cosmetically: \`eeko dev\` serves \`styles.css\` / \`script.js\` as separate Vite-loaded files (for hot reload) where production inlines them into the shell. Substitution and runtime behaviour are the same; don't let the page source confuse you.

### Validators

Run before every commit (\`eeko build\` runs the same checks):

- \`validateManifest(manifest)\` (\`@eeko/sdk/template\`) — structural \`widget.json\` check.
- \`validateInteractions(manifest.interactions)\` (\`@eeko/sdk/interactions\`) — version gate, event names, op vocabulary, per-op required params, binding shape, queue policies. Errors carry JSON paths.
- \`lintWidget({ manifest, html, css, javascript })\` (\`@eeko/sdk/template\`) — full-document HTML, external refs, forbidden JS APIs, interaction targets missing from the markup, unresolvable \`{tokens}\`, plus warnings (innerHTML, missing transparent body, unmirrored global defaults, preset keyframe redefinition).

These are pre-flights: the server's commit-time validation remains authoritative.`

// ── Assembly ─────────────────────────────────────────────────────────────────

const ORDERED_SECTIONS: ReadonlyArray<readonly [id: string, body: string]> = [
  ['the-widget-contract', THE_WIDGET_CONTRACT],
  ['the-manifest', THE_MANIFEST],
  ['two-phase-tokens', TWO_PHASE_TOKENS],
  ['declarative-interactions', DECLARATIVE_INTERACTIONS],
  ['archetype-recipes', ARCHETYPE_RECIPES],
  ['the-sdk-escape-hatch', THE_SDK_ESCAPE_HATCH],
  ['styling-rules', STYLING_RULES],
  ['assets', ASSETS],
  ['forbidden-patterns', FORBIDDEN_PATTERNS_SECTION],
  ['local-testing', LOCAL_TESTING],
]

/**
 * Each guide section separately, keyed by its stable section id (the same id
 * used as the heading anchor in the full guide). Stable ids let the docsite
 * deep-link and let the CLI scaffold subsets.
 */
export const AUTHORING_GUIDE_SECTIONS: Record<string, string> = Object.fromEntries(
  ORDERED_SECTIONS
)

const HEADER = `# Eeko widget authoring guide

Generated from \`@eeko/sdk\` v${VERSION}. Every event name, op, field type, animation preset, and queue policy below is interpolated from the SDK's own runtime constants — this document cannot drift from the runtime it describes.

Audience: authoring agents and developers. It is complete: a valid widget can be authored from this guide alone, without reading any platform source.

Events: ${eventList}.

Sections: ${ORDERED_SECTIONS.map(([id]) => `[${id}](#${id})`).join(' · ')}`

/**
 * The complete authoring guide as a single markdown document.
 */
export const AUTHORING_GUIDE: string = [HEADER, ...ORDERED_SECTIONS.map(([, body]) => body)].join(
  '\n\n---\n\n'
)
