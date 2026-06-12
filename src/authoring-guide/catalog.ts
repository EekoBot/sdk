/**
 * @eeko/sdk — authoring-guide catalogs.
 *
 * Typed documentation catalogs the markdown guide (`./guide`) is assembled
 * from. Every catalog is keyed by an SDK union (`Record<EventType, …>`,
 * `Record<ActionOp, …>`) so adding an event or op WITHOUT documenting it is a
 * compile error — the guide cannot silently drift from the runtime.
 *
 * Accuracy notes (verified against the SDK source, which is the SSOT):
 *  - Handler shapes follow `runtime-bridge.ts`'s `unwrap()`: the bridge
 *    unwraps the `{type, context, payload}` wire envelope for EVERY event and
 *    passes `payload` to handlers — one rule, no per-event branching
 *    (`EekoEventMap` in `types.ts` types each handler argument as
 *    `Envelope['payload']`). Handlers never see `.context` or a nested
 *    `.payload`.
 *  - `component_mount` / `component_unmount` are SDK-local iframe lifecycle
 *    events (never on the wire); their flat payloads are emitted directly.
 */
import type { EventType } from '../types'
import type { ActionOp } from '../interactions/types'

// ── Event catalog ────────────────────────────────────────────────────────────

export interface EventDoc {
  /** One-line description of when the event fires. */
  summary: string
  /** What the handler argument is (see module note above). */
  handlerShape: 'unwrapped-payload' | 'wire-envelope' | string
  /** The handler argument's shape, field by field. */
  payloadDoc: string
  /** A correct, minimal handler. */
  example: string
}

export const EVENT_CATALOG: Record<EventType, EventDoc> = {
  component_trigger: {
    summary:
      'An automation fired this widget (the alert path). Fires once per qualifying stream event.',
    handlerShape: 'unwrapped-payload',
    payloadDoc: `A FLAT record of canonical, normalised data points merged with the streamer's per-variant field values. There is no nested \`.data\` and no \`.context\` — read fields directly off the argument. Common fields (presence varies by trigger; a follow has no \`amount\`):
- \`type?: string\` — event category (donation, follow, subscription, bits, raid, custom)
- \`username?: string\`, \`displayName?: string\`, \`profilePictureUrl?: string\`
- \`message?: string\` — the supporter's message, where the platform carries one
- \`amount?: number\`, \`currency?: string\`, \`formattedAmount?: string\` — prefer \`formattedAmount\` for display (already currency-formatted, e.g. "$5.00", "100 bits")
- \`platform?: 'twitch' | 'kick' | 'youtube' | 'tiktok' | 'rumble'\`
- \`tier?: number\`, \`months?: number\`, \`giftCount?: number\`, \`isAnonymous?: boolean\`
- plus any extra keys the specific trigger extracts. Field names are canonical — never raw platform keys (it is \`displayName\`, NOT \`chatter_user_name\`).`,
    example: `sdk.on('component_trigger', function (data) {
  titleEl.textContent = data.displayName || data.username || 'Someone'
  messageEl.textContent = data.formattedAmount || ''
})`,
  },
  component_update: {
    summary:
      'The widget’s live data or config changed (interactive widgets: polls, counters); re-render from the new values.',
    handlerShape: 'unwrapped-payload',
    payloadDoc: `A flat record of the updated values. Carries:
- \`data: Record<string, unknown>\` — update data for stateful widgets
- \`component_id?: string\`
- \`state_update?: Record<string, unknown>\` — state changes
- \`timestamp?: number\`
Phase-2 token substitution re-runs on this event automatically.`,
    example: `sdk.on('component_update', function (data) {
  render(data)
})`,
  },
  component_dismiss: {
    summary:
      'The current trigger instance is over — hide the alert and tear down its DOM/timers early.',
    handlerShape: 'unwrapped-payload',
    payloadDoc: `A flat record; may carry \`component_id?: string\` and \`timestamp?: number\`. Each sandboxed iframe hosts exactly one widget instance, so a dismiss always applies to the currently showing alert.`,
    example: `sdk.on('component_dismiss', function () {
  alertEl.style.visibility = 'hidden'
})`,
  },
  component_sync: {
    summary:
      'Full state replacement (initial state for always-on widgets like polls, or a forced resync) — re-render everything.',
    handlerShape: 'unwrapped-payload',
    payloadDoc: `A flat record of the complete current state for this widget. Treat it as authoritative: rebuild the whole view from it rather than patching. Phase-2 token substitution re-runs on this event automatically.`,
    example: `sdk.on('component_sync', function (state) {
  renderAll(state)
})`,
  },
  component_mount: {
    summary:
      'The iframe just attached and the SDK initialised (SDK-local; not a wire event). Start timers / initial paint here.',
    handlerShape: 'local-lifecycle',
    payloadDoc: `\`{ componentId: string, type: 'alert' | 'widget' | 'overlay', timestamp?: number }\``,
    example: `sdk.on('component_mount', function (info) {
  startClock()
})`,
  },
  component_unmount: {
    summary:
      'The iframe is detaching (SDK-local; not a wire event). Clear intervals/timeouts and release resources.',
    handlerShape: 'local-lifecycle',
    payloadDoc: `\`{ componentId: string, type: 'alert' | 'widget' | 'overlay', timestamp?: number }\``,
    example: `sdk.on('component_unmount', function () {
  clearInterval(clockHandle)
})`,
  },
  chat_message: {
    summary:
      'A unified chat/engagement/subscription/monetary event from any connected platform. Discriminate on `msg.type` FIRST.',
    handlerShape: 'unwrapped-payload',
    payloadDoc: `The handler receives the UnifiedMessage directly (the wire envelope is unwrapped). It is a discriminated union on \`msg.type\`:

\`msg.type === 'chat_message'\` — a chat line:
- \`msg.user: { id, username, displayName?, profilePictureUrl?, color? }\`
- \`msg.message: { text, fragments? }\` — \`fragments\` is rich content (emotes/mentions/links); \`msg.message\` is an OBJECT, never render it directly
- \`msg.context: { platform, channelId, channelName?, messageId, timestamp }\`
- \`msg.userStatus?: { badges?, isModerator?, isSubscriber?, isVip?, isBroadcaster?, isAnonymous?, isVerified? }\`
- \`msg.replyTo?\` — reply/thread info when the message is a reply

\`msg.type === 'engagement_event'\` — follow/like/raid/host/share/viewer_join:
- \`msg.subType: 'follow' | 'like' | 'raid' | 'host' | 'share' | 'viewer_join'\`
- \`msg.user: { id, username, displayName? }\`
- \`msg.engagement?: { likeCount?, viewerCount?, shareCount? }\`

\`msg.type === 'subscription_event'\` — subs/memberships:
- \`msg.subType: 'new' | 'renewal' | 'gift' | 'milestone' | 'upgrade'\`
- \`msg.subscriber: { id, username, displayName?, profilePictureUrl? }\`
- \`msg.subscription: { tier, tierName?, months?, isGift?, giftCount?, message? }\`

\`msg.type === 'monetary_event'\` — bits/superchats/tips:
- \`msg.subType: 'superchat' | 'supersticker' | 'bits' | 'gift' | 'tip' | 'donation'\`
- \`msg.user?: { id, username, displayName? }\` — optional; donations can be anonymous
- \`msg.monetary: { amount, currency, currencyType, formattedAmount?, tier?, message? }\``,
    example: `sdk.on('chat_message', function (msg) {
  if (msg.type === 'chat_message') {
    addRow(msg.user.displayName || msg.user.username, msg.message.text, msg.context.platform)
  } else if (msg.type === 'monetary_event') {
    celebrate(msg.monetary.formattedAmount)
  }
})`,
  },
  variable_updated: {
    summary:
      'A persistent user variable changed (goal bars, counters). The new value arrives already parsed.',
    handlerShape: 'unwrapped-payload',
    payloadDoc: `\`{ variable: { name: string, type: 'string' | 'number' | 'boolean' | 'date' | 'json', value: unknown, ...bookkeeping } }\`
\`variable.value\` is the NEW value, ALREADY parsed to its JS type. Use it directly — never \`JSON.parse\` it (that throws for string variables).`,
    example: `sdk.on('variable_updated', function (payload) {
  fillEl.style.width = Math.min(100, (Number(payload.variable.value) / goal) * 100) + '%'
})`,
  },
}

// ── Op catalog ───────────────────────────────────────────────────────────────

export interface OpDoc {
  /** One-line description of what the op does. */
  summary: string
  /** Parameter contract: required first, then optional. */
  params: string
  /** A correct, minimal JSON action. */
  example: string
}

export const OP_CATALOG: Record<ActionOp, OpDoc> = {
  show: {
    summary:
      'Reveal an element with an entrance animation preset (default `fade` when omitted; use `"none"` for no animation). Yields until the animation settles (sequence-ordering point).',
    params:
      '`target` (data-eeko-el id, required); `animation?` (preset name, default "fade"); `durationMs?` (number, default 400); `onlyIf?` (guard)',
    example: `{ "op": "show", "target": "el-alert", "animation": "slide-up" }`,
  },
  hide: {
    summary:
      'Hide an element with an exit animation (the preset keyframe reversed; default `fade` when omitted). Sets visibility:hidden after the animation settles.',
    params:
      '`target` (data-eeko-el id, required); `animation?` (preset name, default "fade"); `durationMs?` (number, default 400); `onlyIf?` (guard)',
    example: `{ "op": "hide", "target": "el-alert", "animation": "fade" }`,
  },
  'add-class': {
    summary: 'Add a CSS class to an element. Class names must match `^[A-Za-z0-9 _-]+$`.',
    params: '`target` (required); `class` (string, required); `onlyIf?`',
    example: `{ "op": "add-class", "target": "el-alert", "class": "is-hype" }`,
  },
  'remove-class': {
    summary: 'Remove a CSS class from an element.',
    params: '`target` (required); `class` (string, required); `onlyIf?`',
    example: `{ "op": "remove-class", "target": "el-alert", "class": "is-hype" }`,
  },
  'toggle-class': {
    summary: 'Toggle a CSS class on an element.',
    params: '`target` (required); `class` (string, required); `onlyIf?`',
    example: `{ "op": "toggle-class", "target": "el-alert", "class": "is-flipped" }`,
  },
  'set-text': {
    summary:
      'Write a bound value into an element’s text content (via textContent — markup-safe). Missing values write an empty string.',
    params: '`target` (required); `from` (binding, required); `onlyIf?`',
    example: `{ "op": "set-text", "target": "el-title", "from": { "from": "displayName" } }`,
  },
  'set-attr': {
    summary:
      'Set an allowed attribute from a binding. Only `src`/`alt`/`title`; `src` values must be `eeko-asset://` or `https://` (anything else is rejected at runtime).',
    params: '`target` (required); `attr` ("src" | "alt" | "title", required); `from` (binding, required); `onlyIf?`',
    example: `{ "op": "set-attr", "target": "el-avatar", "attr": "src", "from": { "from": "profilePictureUrl" }, "onlyIf": { "from": "profilePictureUrl", "op": "present" } }`,
  },
  'set-style-numeric': {
    summary: 'Set a numeric style property straight from a bound value, with optional scaling and clamping.',
    params:
      '`target` (required); `prop` ("width" | "height" | "opacity" | "--eeko-progress", required); `from` (binding, required); `unit?` ("px" | "%" | ""); `min?`/`max?`/`multiplyBy?` (numbers); `onlyIf?`',
    example: `{ "op": "set-style-numeric", "target": "el-meter", "prop": "opacity", "from": { "from": "intensity" }, "max": 1 }`,
  },
  'set-style-ratio': {
    summary:
      'Set a style property to numerator/denominator as a percentage (goal/poll bars). Clamped to 0–100% unless `clamp: false`.',
    params:
      '`target` (required); `prop` ("width" | "height" | "--eeko-progress", required); `numerator` (binding, required); `denominator` (binding, required); `unit?` ("%"); `clamp?` (boolean, default true); `onlyIf?`',
    example: `{ "op": "set-style-ratio", "target": "el-fill", "prop": "width", "numerator": { "from": "variable.value" }, "denominator": { "from": "goal" }, "unit": "%", "clamp": true }`,
  },
  'clone-template': {
    summary:
      'Clone a hidden row prototype into a visible list and bind the clone’s descendants (chat feeds, poll rows). The clone drops the prototype’s own data-eeko-el id.',
    params:
      '`templateRef` (prototype id, required); `into` (list id, required); `bindings` (map of descendant id → { set: "text" | "src" | "alt" | "title", value: binding }, required); `prepend?` (boolean); `onlyIf?`',
    example: `{ "op": "clone-template", "templateRef": "el-row", "into": "el-list", "bindings": { "el-row-user": { "set": "text", "value": { "from": "user.displayName" } }, "el-row-text": { "set": "text", "value": { "from": "message.text" } } } }`,
  },
  'trim-children': {
    summary: 'Cap a list’s child count, removing from the oldest or newest end.',
    params: '`target` (required); `max` (number, required); `from?` ("oldest" | "newest", default "oldest")',
    example: `{ "op": "trim-children", "target": "el-list", "max": 30, "from": "oldest" }`,
  },
  'show-nth': {
    summary:
      'Show only the Nth direct child of a container (rotating banners). `index` is usually a `{ fromCounter }` binding; `wrap` loops past the end.',
    params: '`container` (required); `index` (binding, required); `wrap?` (boolean)',
    example: `{ "op": "show-nth", "container": "el-banner", "index": { "fromCounter": "idx" }, "wrap": true }`,
  },
  'start-timer': {
    summary:
      'Start (or restart) a named kit timer that emits the internal `timer_tick` event every `intervalMs`. `countdown` mode stops itself at `durationMs` and each tick carries a preformatted `remaining` mm:ss string.',
    params:
      '`timerId` (string, required); `intervalMs` (number, required); `mode` ("interval" | "countdown", required); `durationMs?` (number — required in practice for countdown)',
    example: `{ "op": "start-timer", "timerId": "cd", "intervalMs": 1000, "durationMs": 300000, "mode": "countdown" }`,
  },
  'stop-timer': {
    summary: 'Stop a named kit timer.',
    params: '`timerId` (string, required)',
    example: `{ "op": "stop-timer", "timerId": "cd" }`,
  },
  'increment-counter': {
    summary: 'Add to a named kit counter (read it back with `{ fromCounter }`). Defaults to +1.',
    params: '`counterId` (string, required); `by?` (number, default 1) OR `from?` (binding)',
    example: `{ "op": "increment-counter", "counterId": "idx", "by": 1 }`,
  },
  'set-counter': {
    summary: 'Set a named kit counter from a bound value.',
    params: '`counterId` (string, required); `from` (binding, required)',
    example: `{ "op": "set-counter", "counterId": "total", "from": { "from": "variable.value" } }`,
  },
  'play-sound': {
    summary:
      'Play a sound. Resolution order: `from` binding → `url` → `behavior.soundUrl`. URLs must be `eeko-asset://` or `https://`. Volume falls back to `behavior.soundVolume`, clamped 0–1.',
    params: '`from?` (binding); `url?` (string); `volume?` (number 0–1); `onlyIf?` — all optional',
    example: `{ "op": "play-sound" }`,
  },
  wait: {
    summary:
      'Pause the sequence. Use `{ "fromBehavior": "displayDuration" }` so the streamer-configured display time drives the alert lifecycle.',
    params: '`ms` (number, or `{ "fromBehavior": "displayDuration" }`, required)',
    example: `{ "op": "wait", "ms": { "fromBehavior": "displayDuration" } }`,
  },
}

// ── Binding kinds ────────────────────────────────────────────────────────────

export interface BindingKindDoc {
  kind: 'from' | 'fromVariable' | 'fromCounter' | 'literal' | 'fromBehavior'
  syntax: string
  semantics: string
}

export const BINDING_KINDS: readonly BindingKindDoc[] = [
  {
    kind: 'from',
    syntax: `{ "from": "dotted.path" }`,
    semantics:
      'Reads a dotted path from the merged data: event payload over variantConfig over globalConfig (the payload wins on collisions; own-property walk only — no bracket or prototype access). Flat alert paths: `displayName`, `formattedAmount`, `profilePictureUrl`. Nested chat paths: `user.displayName`, `message.text`. Variable path: `variable.value`. Config keys (e.g. `goal`) resolve from globalConfig when the payload doesn’t carry them.',
  },
  {
    kind: 'fromVariable',
    syntax: `{ "fromVariable": "name" }`,
    semantics:
      'The latest value of a named user variable, tracked by the kit from every `variable_updated` event (even ones no sequence binds).',
  },
  {
    kind: 'fromCounter',
    syntax: `{ "fromCounter": "id" }`,
    semantics:
      'The current value of a named kit counter (the fixed flat counter scope mutated by `increment-counter` / `set-counter`). Unset counters read as undefined.',
  },
  {
    kind: 'literal',
    syntax: `{ "literal": "constant" }`,
    semantics: 'A constant string or number.',
  },
  {
    kind: 'fromBehavior',
    syntax: `{ "fromBehavior": "displayDuration" }`,
    semantics:
      'A reserved read of the manifest `behavior` block. Allowed keys: `displayDuration`, `soundUrl`, `soundVolume`.',
  },
]

// ── Forbidden patterns ───────────────────────────────────────────────────────

export interface ForbiddenPattern {
  /** The literal pattern to never write. */
  pattern: string
  /** Why it breaks. */
  why: string
  /** What to write instead. */
  instead: string
}

export const FORBIDDEN_PATTERNS: readonly ForbiddenPattern[] = [
  {
    pattern: 'window.widget',
    why: 'This API has never existed. Code referencing it throws at load and the widget stays inert — it never subscribes to anything.',
    instead: 'window.eekoSDK.on(eventType, handler) is the only way events reach script.js.',
  },
  {
    pattern: '.onShow( / .onHide(',
    why: 'Hallucinated lifecycle methods — no object in the runtime has them. The widget never shows or hides.',
    instead:
      "sdk.on('component_trigger', handler) to react to a trigger; sdk.on('component_dismiss', handler) to tear down — or better, the declarative show/wait/hide interaction sequence.",
  },
  {
    pattern: 'msg.sender / msg.text / payload.sender || payload.username',
    why: 'The legacy flat chat shape (pre-v0.4.0) and the `event.payload || event` defensive fallback both read fields that do not exist on a UnifiedMessage. Live widgets render "Anonymous" / "[object Object]" (msg.message is an object, not a string).',
    instead:
      'Discriminate on msg.type first, then read the structured paths: msg.user.username, msg.user.displayName, msg.message.text, msg.context.platform, msg.context.timestamp.',
  },
  {
    pattern: 'eval( / new Function(',
    why: 'Blocked by the sandboxed iframe’s CSP — throws at runtime.',
    instead: 'Write the logic directly; the runtime substitutes config server-side before the iframe loads.',
  },
  {
    pattern: 'el.innerHTML = eventData',
    why: 'Interpolating event-derived strings into innerHTML lets chat text inject markup into your widget.',
    instead: 'el.textContent = value, or the declarative set-text / clone-template ops (which only write text and allow-listed attributes).',
  },
  {
    pattern: "fetch('https://...') / XHR / WebSocket / external CDN URLs",
    why: 'The iframe CSP blocks arbitrary network calls, and third-party CDN assets (Imgur/Giphy/Tenor) are a privacy leak that can disappear.',
    instead: 'Assume only window.eekoSDK + DOM APIs. Reference media via eeko-asset://<id> tokens from the user’s asset library.',
  },
  {
    pattern: '<!DOCTYPE html> / <html> / <head> / <body> / <link rel="stylesheet"> / <script src=...>',
    why: 'index.html is body-only markup. Eeko renders its own page shell and inlines styles.css + script.js into it; a full document nests html/body, and link/script file references 404.',
    instead: 'Write only the body markup. styles.css and script.js are inlined automatically.',
  },
  {
    pattern: '@keyframes eeko-fade-in (or any eeko-* / animation-preset keyframe)',
    why: 'The entrance/exit preset keyframes ship in the Eeko host page. Redefining them in widget CSS desyncs editor preview and live overlay.',
    instead: 'Name the preset in the show/hide op (fade, slide-up, slide-down, zoom, pulse); keep widget CSS to static look + hidden/visible starting states.',
  },
  {
    pattern: 'JSON.parse(payload.variable.value)',
    why: 'variable_updated delivers value ALREADY parsed to its JS type; JSON.parse throws on plain string variables.',
    instead: 'Use payload.variable.value directly.',
  },
]
