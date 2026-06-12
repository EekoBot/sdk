/**
 * @eeko/sdk — structural validator for the `widget.json` `interactions` block.
 *
 * A fast, dependency-free pre-flight for authoring tools (`eeko build`, the
 * docs validators, editor save paths). It checks STRUCTURE: the version gate,
 * that every bound event is a real SDK event (or the internal `timer_tick`),
 * that every action's `op` is in the enumerated vocabulary with its required
 * parameters present and well-typed, that every `Binding` carries exactly one
 * binding kind, and that queue policies are valid.
 *
 * Per-op required/optional parameter shapes are hand-mirrored from the runtime
 * `Action` union in `./types` (the same contract the monorepo's
 * `@live-alerts/shared-types/interactions` `INTERACTION_OP_SCHEMA` projects for
 * the visual editor). NOTE: nexus-api's commit-time validation is the
 * AUTHORITATIVE check — passing here does not guarantee acceptance on commit,
 * it guarantees the SDK interpreter will not silently no-op the block.
 *
 * Error strings carry JSON paths into the input, e.g.
 * `on.component_trigger[2].target: missing required string`.
 *
 * Browser-safe: zero runtime deps, no DOM, no Node APIs.
 */
import { EVENT_TYPES } from '../events'
import {
  ACTION_OPS,
  ANIMATION_PRESETS,
  BEHAVIOR_BINDING_KEYS,
  QUEUE_POLICIES,
  TIMER_TICK,
} from './types'
import type { ActionOp, WidgetInteractions } from './types'

export type ValidateInteractionsResult =
  | { ok: true; interactions: WidgetInteractions }
  | { ok: false; errors: string[] }

const BINDABLE_EVENTS: ReadonlySet<string> = new Set([...EVENT_TYPES, TIMER_TICK])
const VALID_OPS: ReadonlySet<string> = new Set(ACTION_OPS)
const BINDING_KEYS = ['from', 'fromVariable', 'fromCounter', 'literal', 'fromBehavior'] as const
const GUARD_OPS = new Set(['present', 'truthy', 'eq', 'gt'])
const BINDABLE_ATTRS = new Set(['src', 'alt', 'title'])
const NUMERIC_STYLE_PROPS = new Set(['width', 'height', 'opacity', '--eeko-progress'])
const RATIO_STYLE_PROPS = new Set(['width', 'height', '--eeko-progress'])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

/** Validate a `Binding`: exactly ONE of the five binding kinds, well-typed. */
function checkBinding(value: unknown, path: string, errors: string[]): void {
  if (!isPlainObject(value)) {
    errors.push(`${path}: must be a binding object ({from}/{fromVariable}/{fromCounter}/{literal}/{fromBehavior})`)
    return
  }
  const present = BINDING_KEYS.filter((k) => Object.prototype.hasOwnProperty.call(value, k))
  if (present.length !== 1) {
    errors.push(
      `${path}: binding must have exactly one of ${BINDING_KEYS.join('/')} (found ${present.length === 0 ? 'none' : present.join('+')})`
    )
    return
  }
  const kind = present[0]
  const v = value[kind]
  if (kind === 'literal') {
    if (typeof v !== 'string' && typeof v !== 'number') {
      errors.push(`${path}.literal: must be a string or number`)
    }
  } else if (kind === 'fromBehavior') {
    if (typeof v !== 'string' || !(BEHAVIOR_BINDING_KEYS as readonly string[]).includes(v)) {
      errors.push(`${path}.fromBehavior: must be one of ${BEHAVIOR_BINDING_KEYS.join('/')}`)
    }
  } else if (!isNonEmptyString(v)) {
    errors.push(`${path}.${kind}: must be a non-empty string`)
  }
}

/** Validate an optional `onlyIf` guard. */
function checkGuard(value: unknown, path: string, errors: string[]): void {
  if (value === undefined) return
  if (!isPlainObject(value)) {
    errors.push(`${path}: must be an object`)
    return
  }
  if (!isNonEmptyString(value.from)) {
    errors.push(`${path}.from: must be a non-empty string`)
  }
  if (typeof value.op !== 'string' || !GUARD_OPS.has(value.op)) {
    errors.push(`${path}.op: must be one of present/truthy/eq/gt`)
  }
}

function requireString(
  action: Record<string, unknown>,
  key: string,
  path: string,
  errors: string[]
): void {
  if (!isNonEmptyString(action[key])) {
    errors.push(`${path}.${key}: missing required string`)
  }
}

function requireNumber(
  action: Record<string, unknown>,
  key: string,
  path: string,
  errors: string[]
): void {
  if (typeof action[key] !== 'number' || !Number.isFinite(action[key] as number)) {
    errors.push(`${path}.${key}: missing required number`)
  }
}

function optionalNumber(
  action: Record<string, unknown>,
  key: string,
  path: string,
  errors: string[]
): void {
  if (action[key] !== undefined && typeof action[key] !== 'number') {
    errors.push(`${path}.${key}: must be a number when present`)
  }
}

/**
 * Per-op required parameter checks. Hand-mirrors the `Action` union in
 * `./types` (and the editor's `INTERACTION_OP_SCHEMA` projection in the
 * monorepo). nexus-api's commit-time schema remains authoritative.
 */
function checkAction(action: unknown, path: string, errors: string[]): void {
  if (!isPlainObject(action)) {
    errors.push(`${path}: action must be an object`)
    return
  }
  const op = action.op
  if (typeof op !== 'string' || !VALID_OPS.has(op)) {
    errors.push(`${path}.op: unknown op "${String(op)}" (must be one of ${ACTION_OPS.join(', ')})`)
    return
  }

  checkGuard(action.onlyIf, `${path}.onlyIf`, errors)

  switch (op as ActionOp) {
    case 'show':
    case 'hide': {
      requireString(action, 'target', path, errors)
      if (
        action.animation !== undefined &&
        !(ANIMATION_PRESETS as readonly string[]).includes(action.animation as string)
      ) {
        errors.push(
          `${path}.animation: unknown preset "${String(action.animation)}" (must be one of ${ANIMATION_PRESETS.join(', ')})`
        )
      }
      optionalNumber(action, 'durationMs', path, errors)
      return
    }
    case 'add-class':
    case 'remove-class':
    case 'toggle-class': {
      requireString(action, 'target', path, errors)
      requireString(action, 'class', path, errors)
      return
    }
    case 'set-text': {
      requireString(action, 'target', path, errors)
      checkBinding(action.from, `${path}.from`, errors)
      return
    }
    case 'set-attr': {
      requireString(action, 'target', path, errors)
      if (typeof action.attr !== 'string' || !BINDABLE_ATTRS.has(action.attr)) {
        errors.push(`${path}.attr: must be one of src/alt/title`)
      }
      checkBinding(action.from, `${path}.from`, errors)
      return
    }
    case 'set-style-numeric': {
      requireString(action, 'target', path, errors)
      if (typeof action.prop !== 'string' || !NUMERIC_STYLE_PROPS.has(action.prop)) {
        errors.push(`${path}.prop: must be one of width/height/opacity/--eeko-progress`)
      }
      checkBinding(action.from, `${path}.from`, errors)
      optionalNumber(action, 'min', path, errors)
      optionalNumber(action, 'max', path, errors)
      optionalNumber(action, 'multiplyBy', path, errors)
      return
    }
    case 'set-style-ratio': {
      requireString(action, 'target', path, errors)
      if (typeof action.prop !== 'string' || !RATIO_STYLE_PROPS.has(action.prop)) {
        errors.push(`${path}.prop: must be one of width/height/--eeko-progress`)
      }
      checkBinding(action.numerator, `${path}.numerator`, errors)
      checkBinding(action.denominator, `${path}.denominator`, errors)
      return
    }
    case 'clone-template': {
      requireString(action, 'templateRef', path, errors)
      requireString(action, 'into', path, errors)
      if (!isPlainObject(action.bindings)) {
        errors.push(`${path}.bindings: missing required binding map`)
      } else {
        for (const elId of Object.keys(action.bindings)) {
          const spec = (action.bindings as Record<string, unknown>)[elId]
          const specPath = `${path}.bindings.${elId}`
          if (!isPlainObject(spec)) {
            errors.push(`${specPath}: must be an object { set, value }`)
            continue
          }
          if (spec.set !== 'text' && !(typeof spec.set === 'string' && BINDABLE_ATTRS.has(spec.set))) {
            errors.push(`${specPath}.set: must be one of text/src/alt/title`)
          }
          checkBinding(spec.value, `${specPath}.value`, errors)
        }
      }
      return
    }
    case 'trim-children': {
      requireString(action, 'target', path, errors)
      requireNumber(action, 'max', path, errors)
      if (action.from !== undefined && action.from !== 'oldest' && action.from !== 'newest') {
        errors.push(`${path}.from: must be "oldest" or "newest" when present`)
      }
      return
    }
    case 'show-nth': {
      requireString(action, 'container', path, errors)
      checkBinding(action.index, `${path}.index`, errors)
      return
    }
    case 'start-timer': {
      requireString(action, 'timerId', path, errors)
      requireNumber(action, 'intervalMs', path, errors)
      optionalNumber(action, 'durationMs', path, errors)
      if (action.mode !== 'interval' && action.mode !== 'countdown') {
        errors.push(`${path}.mode: must be "interval" or "countdown"`)
      }
      return
    }
    case 'stop-timer': {
      requireString(action, 'timerId', path, errors)
      return
    }
    case 'increment-counter': {
      requireString(action, 'counterId', path, errors)
      optionalNumber(action, 'by', path, errors)
      if (action.from !== undefined) checkBinding(action.from, `${path}.from`, errors)
      return
    }
    case 'set-counter': {
      requireString(action, 'counterId', path, errors)
      checkBinding(action.from, `${path}.from`, errors)
      return
    }
    case 'play-sound': {
      // All parameters are optional (falls back to behavior.soundUrl/soundVolume).
      if (action.from !== undefined) checkBinding(action.from, `${path}.from`, errors)
      if (action.url !== undefined && typeof action.url !== 'string') {
        errors.push(`${path}.url: must be a string when present`)
      }
      optionalNumber(action, 'volume', path, errors)
      return
    }
    case 'wait': {
      const ms = action.ms
      if (typeof ms === 'number') return
      if (isPlainObject(ms) && ms.fromBehavior === 'displayDuration') return
      errors.push(`${path}.ms: must be a number or { "fromBehavior": "displayDuration" }`)
      return
    }
  }
}

/**
 * Structurally validate a `widget.json` `interactions` block. Returns the
 * typed block on success, or every problem found (with JSON paths) on failure.
 */
export function validateInteractions(input: unknown): ValidateInteractionsResult {
  const errors: string[] = []

  if (!isPlainObject(input)) {
    return { ok: false, errors: ['interactions must be a JSON object'] }
  }

  if (input.version !== 1) {
    errors.push(`version: must be 1 (got ${JSON.stringify(input.version)})`)
  }

  const on = input.on
  if (!isPlainObject(on)) {
    errors.push('on: required object mapping events to action sequences')
  } else {
    for (const event of Object.keys(on)) {
      if (!BINDABLE_EVENTS.has(event)) {
        errors.push(
          `on.${event}: unknown event (must be one of ${[...EVENT_TYPES, TIMER_TICK].join(', ')})`
        )
        continue
      }
      const sequence = on[event]
      if (!Array.isArray(sequence)) {
        errors.push(`on.${event}: must be an array of actions`)
        continue
      }
      sequence.forEach((action, i) => {
        checkAction(action, `on.${event}[${i}]`, errors)
      })
    }
  }

  const queue = input.queue
  if (queue !== undefined) {
    if (!isPlainObject(queue)) {
      errors.push('queue: must be an object when present')
    } else {
      for (const event of Object.keys(queue)) {
        if (!BINDABLE_EVENTS.has(event)) {
          errors.push(`queue.${event}: unknown event`)
        }
        const policy = queue[event]
        if (!(QUEUE_POLICIES as readonly string[]).includes(policy as string)) {
          errors.push(
            `queue.${event}: invalid policy "${String(policy)}" (must be one of ${QUEUE_POLICIES.join('/')})`
          )
        }
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }
  return { ok: true, interactions: input as unknown as WidgetInteractions }
}
