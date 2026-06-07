/**
 * @eeko/sdk — Declarative Widget Interaction Model (`widget.json` `interactions`)
 *
 * A FINITE, non-Turing-complete vocabulary that lets a widget describe its
 * behaviour as DATA instead of hand-written `script.js`: which events it
 * reacts to, and an ordered list of enumerated actions per event (show/hide
 * with animation, bind an element to a data point, clone a row per chat
 * message, fill a progress bar, run a timer, play a sound, wait).
 *
 * The interpreter that executes this model ships INSIDE the SDK runtime
 * (`INTERACTION_RUNTIME_JS`, composed into `RUNTIME_BRIDGE_JS`) so BOTH the
 * production widget-host and the local `@eeko/cli` dev harness run identical
 * behaviour behind the one `window.eekoSDK` seam — never coupled to a single
 * transport.
 *
 * Design rules (enforced by the schema + the interpreter):
 *  - No loops, no user-defined variables (only a fixed flat counter scope),
 *    no inline expressions. Repetition only via a kit-managed timer that emits
 *    the internal `timer_tick` event. The model is a finite reaction table,
 *    not a programming language.
 *  - Element targets are the SAME stable `data-eeko-el` ids the visual editor
 *    stamps, so the editor authors interactions by selection and round-trips
 *    them losslessly.
 *  - Every value an action writes is an enumerated, sanitised kind — the
 *    interpreter is a `switch`, never `eval`. Mirrored by a Zod schema in
 *    nexus-api (the authoritative commit-time validator) and the editor
 *    allowlist.
 *
 * Browser-safe: a type-only import of `EventType`; zero runtime deps.
 */
import type { EventType } from '../types'

/** A target element, addressed by its stable `data-eeko-el` id (e.g. "el-3"). */
export type ElTarget = string

/**
 * Resolves to a value at runtime.
 *  - `from` — a dotted path resolved against the merged data
 *    `payload → variantConfig → globalConfig` (own-property walk only, no
 *    bracket/prototype access), e.g. `username`, `user.displayName`.
 *  - `fromVariable` — the latest value of a named user variable the kit tracks
 *    from `variable_updated` events (goal bars / counters).
 *  - `fromCounter` — a value in the kit's fixed flat counter scope.
 *  - `literal` — a constant.
 *  - `fromBehavior` — a reserved read of the manifest `behavior` block.
 */
export type Binding =
  | { from: string }
  | { fromVariable: string }
  | { fromCounter: string }
  | { literal: string | number }
  | { fromBehavior: 'displayDuration' | 'soundUrl' | 'soundVolume' }

/**
 * Optional single-action guard. Skips ONLY the action it is attached to when
 * the test is false. Deliberately cannot express an else-branch or a chain —
 * it is structurally incapable of control flow.
 */
export interface Guard {
  from: string
  op: 'present' | 'truthy' | 'eq' | 'gt'
  value?: string | number
}

/** Numeric style properties an action may write (enumerated). */
export type NumericStyleProp = 'width' | 'height' | 'opacity' | '--eeko-progress'
/** Style properties a ratio (numerator/denominator) may fill. */
export type RatioStyleProp = 'width' | 'height' | '--eeko-progress'
/** Attributes `set-attr` may write (enumerated; never `style`/`on*`/`srcdoc`). */
export type BindableAttr = 'src' | 'alt' | 'title'

/** A map applied to a freshly cloned row's descendants (chat / poll rows). */
export type BindingMap = Record<ElTarget, { set: 'text' | BindableAttr; value: Binding }>

/**
 * Entrance/exit animation preset names. These map to the `eeko-*` keyframes the
 * widget-host shell already ships, so editor preview and live overlay agree.
 */
export type AnimationPreset = 'none' | 'fade' | 'slide-up' | 'slide-down' | 'zoom' | 'pulse'

/**
 * The enumerated action vocabulary. Discriminated on `op`; targets are
 * `data-eeko-el` ids. ~18 ops, deliberately minimal-but-sufficient for the six
 * widget archetypes (alert, chat, goal/progress, countdown, poll, banner).
 */
export type Action =
  | { op: 'show'; target: ElTarget; animation?: AnimationPreset; durationMs?: number; onlyIf?: Guard }
  | { op: 'hide'; target: ElTarget; animation?: AnimationPreset; durationMs?: number; onlyIf?: Guard }
  | { op: 'add-class' | 'remove-class' | 'toggle-class'; target: ElTarget; class: string; onlyIf?: Guard }
  | { op: 'set-text'; target: ElTarget; from: Binding; onlyIf?: Guard }
  | { op: 'set-attr'; target: ElTarget; attr: BindableAttr; from: Binding; onlyIf?: Guard }
  | {
      op: 'set-style-numeric'
      target: ElTarget
      prop: NumericStyleProp
      from: Binding
      unit?: 'px' | '%' | ''
      min?: number
      max?: number
      multiplyBy?: number
      onlyIf?: Guard
    }
  | {
      op: 'set-style-ratio'
      target: ElTarget
      prop: RatioStyleProp
      numerator: Binding
      denominator: Binding
      unit?: '%'
      clamp?: boolean
      onlyIf?: Guard
    }
  | { op: 'clone-template'; templateRef: ElTarget; into: ElTarget; bindings: BindingMap; prepend?: boolean; onlyIf?: Guard }
  | { op: 'trim-children'; target: ElTarget; max: number; from?: 'oldest' | 'newest' }
  | { op: 'show-nth'; container: ElTarget; index: Binding; wrap?: boolean }
  | { op: 'start-timer'; timerId: string; intervalMs: number; durationMs?: number; mode: 'interval' | 'countdown' }
  | { op: 'stop-timer'; timerId: string }
  | { op: 'increment-counter'; counterId: string; by?: number; from?: Binding }
  | { op: 'set-counter'; counterId: string; from: Binding }
  | { op: 'play-sound'; from?: Binding; url?: string; volume?: number; onlyIf?: Guard }
  | { op: 'wait'; ms: number | { fromBehavior: 'displayDuration' } }

/** The `op` discriminator values (runtime list for validation / tests). */
export const ACTION_OPS = [
  'show',
  'hide',
  'add-class',
  'remove-class',
  'toggle-class',
  'set-text',
  'set-attr',
  'set-style-numeric',
  'set-style-ratio',
  'clone-template',
  'trim-children',
  'show-nth',
  'start-timer',
  'stop-timer',
  'increment-counter',
  'set-counter',
  'play-sound',
  'wait',
] as const
export type ActionOp = (typeof ACTION_OPS)[number]

/** An ordered, flat list of actions run when an event fires. */
export type Sequence = Action[]

/**
 * The internal, kit-managed event a timer emits. NOT a public SDK event (kept
 * out of `EVENT_TYPES`) and never sent over any transport — dispatched only
 * within the interpreter. Its payload carries a kit-formatted `remaining`
 * string ("04:59") alongside the raw millis for countdown displays.
 */
export const TIMER_TICK = 'timer_tick'
export interface TimerTickPayload {
  timerId: string
  elapsedMs: number
  remainingMs: number
  /** Kit-formatted mm:ss (or h:mm:ss) string for direct display. */
  remaining: string
}

/** Events an interaction sequence may bind to: SDK events + the internal tick. */
export type InteractionEvent = EventType | typeof TIMER_TICK

/** Queue policy for rapid repeat events (default `queue`, or `behavior.queueBehavior`). */
export type QueuePolicy = 'queue' | 'replace' | 'skip'

/**
 * The `interactions` block on `widget.json`. Optional and additive — a widget
 * with no `interactions` runs exactly as before (the interpreter no-ops).
 */
export interface WidgetInteractions {
  /** Vocabulary version, for forward-compatible evolution. */
  version: 1
  /** Event → ordered action sequence. */
  on: Partial<Record<InteractionEvent, Sequence>>
  /** Optional per-event queue policy. */
  queue?: Partial<Record<InteractionEvent, QueuePolicy>>
}
