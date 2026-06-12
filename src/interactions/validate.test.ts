import { describe, it, expect } from 'vitest'
import { validateInteractions } from './validate'
import type { WidgetInteractions } from './types'

/** The canonical alert lifecycle — the realistic happy path. */
const ALERT_INTERACTIONS: WidgetInteractions = {
  version: 1,
  on: {
    component_trigger: [
      {
        op: 'set-attr',
        target: 'el-avatar',
        attr: 'src',
        from: { from: 'profilePictureUrl' },
        onlyIf: { from: 'profilePictureUrl', op: 'present' },
      },
      { op: 'set-text', target: 'el-title', from: { from: 'displayName' } },
      { op: 'set-text', target: 'el-message', from: { from: 'formattedAmount' } },
      { op: 'play-sound' },
      { op: 'show', target: 'el-alert', animation: 'slide-up' },
      { op: 'wait', ms: { fromBehavior: 'displayDuration' } },
      { op: 'hide', target: 'el-alert', animation: 'fade' },
    ],
    component_dismiss: [{ op: 'hide', target: 'el-alert', animation: 'fade' }],
  },
  queue: { component_trigger: 'queue' },
}

function expectFail(input: unknown): string[] {
  const result = validateInteractions(input)
  if (result.ok) throw new Error('expected validation failure')
  return result.errors
}

describe('validateInteractions', () => {
  it('accepts the canonical alert lifecycle', () => {
    const result = validateInteractions(ALERT_INTERACTIONS)
    if (!result.ok) throw new Error(result.errors.join('\n'))
    expect(result.interactions).toEqual(ALERT_INTERACTIONS)
  })

  it('accepts every starter-style op shape (timers, counters, clones, ratios)', () => {
    const result = validateInteractions({
      version: 1,
      on: {
        component_mount: [
          { op: 'start-timer', timerId: 'rot', intervalMs: 6000, mode: 'interval' },
          { op: 'show-nth', container: 'el-banner', index: { fromCounter: 'idx' }, wrap: true },
        ],
        timer_tick: [
          { op: 'increment-counter', counterId: 'idx', by: 1 },
          { op: 'show-nth', container: 'el-banner', index: { fromCounter: 'idx' }, wrap: true },
        ],
        chat_message: [
          {
            op: 'clone-template',
            templateRef: 'el-row',
            into: 'el-list',
            bindings: {
              'el-row-user': { set: 'text', value: { from: 'user.displayName' } },
              'el-row-text': { set: 'text', value: { from: 'message.text' } },
            },
          },
          { op: 'trim-children', target: 'el-list', max: 30, from: 'oldest' },
        ],
        variable_updated: [
          {
            op: 'set-style-ratio',
            target: 'el-fill',
            prop: 'width',
            numerator: { from: 'variable.value' },
            denominator: { from: 'goal' },
            unit: '%',
            clamp: true,
          },
        ],
      },
    })
    if (!result.ok) throw new Error(result.errors.join('\n'))
  })

  it('rejects a non-object input', () => {
    expect(validateInteractions('nope').ok).toBe(false)
    expect(validateInteractions(null).ok).toBe(false)
  })

  it('rejects a wrong version with its path', () => {
    const errors = expectFail({ version: 2, on: {} })
    expect(errors.join(' ')).toContain('version')
  })

  it('rejects an unknown op with the right JSON path', () => {
    const errors = expectFail({
      version: 1,
      on: {
        component_trigger: [
          { op: 'set-text', target: 'el-title', from: { from: 'displayName' } },
          { op: 'explode', target: 'el-alert' },
        ],
      },
    })
    expect(errors.some((e) => e.startsWith('on.component_trigger[1].op'))).toBe(true)
  })

  it('rejects an unknown event key with the right path', () => {
    const errors = expectFail({
      version: 1,
      on: { component_explode: [{ op: 'show', target: 'el-alert' }] },
    })
    expect(errors.some((e) => e.startsWith('on.component_explode'))).toBe(true)
  })

  it('rejects a non-array sequence', () => {
    const errors = expectFail({ version: 1, on: { component_trigger: { op: 'show' } } })
    expect(errors.some((e) => e.includes('must be an array'))).toBe(true)
  })

  it('rejects a binding carrying two kinds, with the right path', () => {
    const errors = expectFail({
      version: 1,
      on: {
        component_trigger: [
          { op: 'set-text', target: 'el-title', from: { from: 'displayName', literal: 'x' } },
        ],
      },
    })
    const hit = errors.find((e) => e.startsWith('on.component_trigger[0].from'))
    expect(hit).toBeTruthy()
    expect(hit).toContain('exactly one')
  })

  it('rejects a binding carrying no kind', () => {
    const errors = expectFail({
      version: 1,
      on: { component_trigger: [{ op: 'set-text', target: 'el-title', from: {} }] },
    })
    expect(errors.some((e) => e.startsWith('on.component_trigger[0].from'))).toBe(true)
  })

  it('rejects a missing required param with the right path', () => {
    const errors = expectFail({
      version: 1,
      on: { component_trigger: [{ op: 'show' }] },
    })
    expect(errors.some((e) => e.startsWith('on.component_trigger[0].target'))).toBe(true)
  })

  it('rejects a bad set-attr attribute', () => {
    const errors = expectFail({
      version: 1,
      on: {
        component_trigger: [
          { op: 'set-attr', target: 'el-x', attr: 'onclick', from: { from: 'x' } },
        ],
      },
    })
    expect(errors.some((e) => e.startsWith('on.component_trigger[0].attr'))).toBe(true)
  })

  it('rejects an unknown animation preset', () => {
    const errors = expectFail({
      version: 1,
      on: { component_trigger: [{ op: 'show', target: 'el-alert', animation: 'explode' }] },
    })
    expect(errors.some((e) => e.startsWith('on.component_trigger[0].animation'))).toBe(true)
  })

  it('rejects a bad fromBehavior key', () => {
    const errors = expectFail({
      version: 1,
      on: {
        component_trigger: [
          { op: 'set-text', target: 'el-x', from: { fromBehavior: 'volumeKnob' } },
        ],
      },
    })
    expect(errors.some((e) => e.includes('fromBehavior'))).toBe(true)
  })

  it('rejects a bad guard op', () => {
    const errors = expectFail({
      version: 1,
      on: {
        component_trigger: [
          { op: 'show', target: 'el-alert', onlyIf: { from: 'x', op: 'maybe' } },
        ],
      },
    })
    expect(errors.some((e) => e.includes('onlyIf.op'))).toBe(true)
  })

  it('rejects a bad queue policy with the right path', () => {
    const errors = expectFail({
      version: 1,
      on: { component_trigger: [{ op: 'show', target: 'el-alert' }] },
      queue: { component_trigger: 'pile-up' },
    })
    expect(errors.some((e) => e.startsWith('queue.component_trigger'))).toBe(true)
  })

  it('rejects a queue key for an unknown event', () => {
    const errors = expectFail({
      version: 1,
      on: { component_trigger: [{ op: 'show', target: 'el-alert' }] },
      queue: { component_explode: 'queue' },
    })
    expect(errors.some((e) => e.startsWith('queue.component_explode'))).toBe(true)
  })

  it('rejects a bad wait ms shape', () => {
    const errors = expectFail({
      version: 1,
      on: { component_trigger: [{ op: 'wait', ms: { fromBehavior: 'soundUrl' } }] },
    })
    expect(errors.some((e) => e.startsWith('on.component_trigger[0].ms'))).toBe(true)
  })

  it('rejects NaN and Infinity in optional numeric params', () => {
    const errors = expectFail({
      version: 1,
      on: {
        component_trigger: [
          { op: 'show', target: 'el-alert', durationMs: Infinity },
          {
            op: 'set-style-numeric',
            target: 'el-meter',
            prop: 'opacity',
            from: { from: 'intensity' },
            max: NaN,
          },
          { op: 'increment-counter', counterId: 'n', by: -Infinity },
        ],
      },
    })
    expect(errors).toContain('on.component_trigger[0].durationMs: must be a finite number when present')
    expect(errors).toContain('on.component_trigger[1].max: must be a finite number when present')
    expect(errors).toContain('on.component_trigger[2].by: must be a finite number when present')
  })

  it('rejects a non-finite wait ms but accepts a finite one', () => {
    const errors = expectFail({
      version: 1,
      on: { component_trigger: [{ op: 'wait', ms: NaN }] },
    })
    expect(errors.some((e) => e.startsWith('on.component_trigger[0].ms'))).toBe(true)
    expect(
      validateInteractions({ version: 1, on: { component_trigger: [{ op: 'wait', ms: 5000 }] } }).ok
    ).toBe(true)
  })

  it('rejects a non-finite literal binding', () => {
    const errors = expectFail({
      version: 1,
      on: { component_trigger: [{ op: 'set-text', target: 'el-x', from: { literal: NaN } }] },
    })
    expect(errors).toContain('on.component_trigger[0].from.literal: must be a string or finite number')
  })

  it('rejects a non-finite or non-scalar guard value', () => {
    const errors = expectFail({
      version: 1,
      on: {
        component_trigger: [
          { op: 'show', target: 'el-alert', onlyIf: { from: 'amount', op: 'gt', value: Infinity } },
          { op: 'hide', target: 'el-alert', onlyIf: { from: 'tier', op: 'eq', value: {} } },
        ],
      },
    })
    expect(errors).toContain('on.component_trigger[0].onlyIf.value: must be a string or finite number when present')
    expect(errors).toContain('on.component_trigger[1].onlyIf.value: must be a string or finite number when present')
  })

  it('rejects a bad set-style-numeric unit but accepts px / % / empty', () => {
    const numeric = (unit: unknown) => ({
      version: 1,
      on: {
        component_trigger: [
          { op: 'set-style-numeric', target: 'el-bar', prop: 'width', from: { from: 'n' }, unit },
        ],
      },
    })
    const errors = expectFail(numeric('vw'))
    expect(errors.some((e) => e.startsWith('on.component_trigger[0].unit'))).toBe(true)
    for (const unit of ['px', '%', '']) {
      expect(validateInteractions(numeric(unit)).ok).toBe(true)
    }
  })

  it('rejects a bad set-style-ratio unit and a non-boolean clamp', () => {
    const errors = expectFail({
      version: 1,
      on: {
        variable_updated: [
          {
            op: 'set-style-ratio',
            target: 'el-fill',
            prop: 'width',
            numerator: { from: 'variable.value' },
            denominator: { from: 'goal' },
            unit: 'px',
            clamp: 'yes',
          },
        ],
      },
    })
    expect(errors).toContain('on.variable_updated[0].unit: must be "%" when present')
    expect(errors).toContain('on.variable_updated[0].clamp: must be a boolean when present')
  })

  it('rejects a non-boolean clone-template prepend', () => {
    const errors = expectFail({
      version: 1,
      on: {
        chat_message: [
          {
            op: 'clone-template',
            templateRef: 'el-row',
            into: 'el-list',
            prepend: 1,
            bindings: { 'el-row-text': { set: 'text', value: { from: 'message.text' } } },
          },
        ],
      },
    })
    expect(errors).toContain('on.chat_message[0].prepend: must be a boolean when present')
  })

  it('rejects a non-boolean show-nth wrap', () => {
    const errors = expectFail({
      version: 1,
      on: {
        timer_tick: [{ op: 'show-nth', container: 'el-banner', index: { fromCounter: 'idx' }, wrap: 1 }],
      },
    })
    expect(errors).toContain('on.timer_tick[0].wrap: must be a boolean when present')
  })

  it('reports every problem at once, not just the first', () => {
    const errors = expectFail({
      version: 7,
      on: {
        component_trigger: [{ op: 'explode' }],
        component_explode: [],
      },
      queue: { component_trigger: 'pile-up' },
    })
    expect(errors.length).toBeGreaterThanOrEqual(4)
  })
})
