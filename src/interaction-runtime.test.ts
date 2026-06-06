// @vitest-environment happy-dom
/**
 * Interaction runtime tests.
 *
 * We eval the FULL shipped runtime (`RUNTIME_BRIDGE_JS` = bridge IIFE +
 * interpreter IIFE) into a happy-dom window with `window.__EEKO_INIT__`
 * preset, then drive events through the production postMessage path (or the
 * internal `_emit`) and assert real DOM outcomes — exercising the same seam
 * the overlay/CLI use, not a parallel harness.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RUNTIME_BRIDGE_JS } from './runtime-bridge'
import type { WidgetInteractions } from './interactions/types'

interface InitState {
  componentId?: string
  userId?: string
  globalConfig?: Record<string, unknown>
  variantConfig?: Record<string, unknown>
  behavior?: Record<string, unknown>
  interactions?: WidgetInteractions
}

declare global {
  interface Window {
    __EEKO_INIT__?: InitState
    __EEKO_DEV__?: { wsUrl: string }
  }
}

/** Load the runtime into the current happy-dom global with a given init. */
function boot(init: InitState | undefined, body: string) {
  // Reset any prior bridge install.
  delete (window as any).eekoSDK
  delete (window as any).__EEKO_DEV__
  document.body.innerHTML = body
  if (init === undefined) delete (window as any).__EEKO_INIT__
  else (window as any).__EEKO_INIT__ = init
  // Indirect eval so the IIFE runs against the test realm's window/document.
  ;(0, eval)(RUNTIME_BRIDGE_JS)
}

/** Deliver a wire event the same way the parent overlay does (postMessage). */
function emitWire(event: string, payload: unknown) {
  // The bridge's prod transport requires ev.source === window.parent. In
  // happy-dom window.parent === window for a top-level window, so a plain
  // window.postMessage satisfies the guard. We drive _emit directly to avoid
  // the async message queue in tests, mirroring how the bridge ultimately
  // calls emit(event, unwrap(...)).
  ;(window as any).eekoSDK._emit(event, payload)
}

function el(id: string): HTMLElement | null {
  return document.querySelector(`[data-eeko-el="${id}"]`)
}

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.useRealTimers()
  delete (window as any).eekoSDK
  delete (window as any).__EEKO_INIT__
})

describe('back-compat / gating', () => {
  it('no-ops with no interactions, bridge still works', () => {
    boot(
      { componentId: 'c1', userId: 'u1', globalConfig: {}, variantConfig: {} },
      `<div data-eeko-el="root">hi</div>`
    )
    // Bridge present and functional.
    expect((window as any).eekoSDK).toBeTruthy()
    expect((window as any).eekoSDK.__eekoBridge).toBe(true)
    // Escape-hatch surface still published.
    expect(typeof (window as any).eekoSDK.interactions.isManaged).toBe('function')
    expect((window as any).eekoSDK.interactions.isManaged()).toBe(false)
    // Public surface intact.
    expect(typeof (window as any).eekoSDK.on).toBe('function')
    expect(typeof (window as any).eekoSDK.getState).toBe('function')
    // A trigger does nothing to the DOM (no interactions).
    expect(() => emitWire('component_trigger', { displayName: 'Ada' })).not.toThrow()
    expect(el('root')!.textContent).toBe('hi')
  })

  it('isManaged() true once interactions are present', () => {
    const interactions: WidgetInteractions = {
      version: 1,
      on: { component_trigger: [{ op: 'set-text', target: 'name', from: { from: 'displayName' } }] },
    }
    boot(
      { componentId: 'c1', userId: 'u1', globalConfig: {}, variantConfig: {}, interactions },
      `<span data-eeko-el="name"></span>`
    )
    expect((window as any).eekoSDK.interactions.isManaged()).toBe(true)
  })
})

describe('alert: set-text + show + wait + hide', () => {
  it('binds text, shows, then hides after wait', async () => {
    vi.useFakeTimers()
    const interactions: WidgetInteractions = {
      version: 1,
      on: {
        component_trigger: [
          { op: 'set-text', target: 'name', from: { from: 'displayName' } },
          { op: 'set-text', target: 'amount', from: { from: 'formattedAmount' } },
          { op: 'show', target: 'card', animation: 'fade', durationMs: 100 },
          { op: 'wait', ms: 1000 },
          { op: 'hide', target: 'card', animation: 'fade', durationMs: 100 },
        ],
      },
    }
    boot(
      { componentId: 'c1', userId: 'u1', globalConfig: {}, variantConfig: {}, interactions },
      `<div data-eeko-el="card" style="visibility:hidden">
         <span data-eeko-el="name"></span>
         <span data-eeko-el="amount"></span>
       </div>`
    )

    emitWire('component_trigger', { displayName: 'Ada', formattedAmount: '$5.00' })
    // text bound synchronously
    expect(el('name')!.textContent).toBe('Ada')
    expect(el('amount')!.textContent).toBe('$5.00')

    // show: visibility cleared + entrance keyframe applied
    expect(el('card')!.style.visibility).toBe('')
    expect(el('card')!.style.animation).toContain('eeko-fade-in')

    // advance past show duration -> into wait
    await vi.advanceTimersByTimeAsync(100)
    // still visible during the 1000ms wait
    expect(el('card')!.style.visibility).toBe('')

    // advance through wait + hide duration
    await vi.advanceTimersByTimeAsync(1000)
    expect(el('card')!.style.animation).toContain('reverse')
    await vi.advanceTimersByTimeAsync(100)
    expect(el('card')!.style.visibility).toBe('hidden')
  })

  it('honours wait { fromBehavior: displayDuration }', async () => {
    vi.useFakeTimers()
    const interactions: WidgetInteractions = {
      version: 1,
      on: {
        component_trigger: [
          { op: 'show', target: 'card', animation: 'none' },
          { op: 'wait', ms: { fromBehavior: 'displayDuration' } },
          { op: 'hide', target: 'card', animation: 'none' },
        ],
      },
    }
    boot(
      {
        componentId: 'c1',
        userId: 'u1',
        globalConfig: {},
        variantConfig: {},
        behavior: { displayDuration: 3000 },
        interactions,
      },
      `<div data-eeko-el="card" style="visibility:hidden"></div>`
    )
    emitWire('component_trigger', {})
    expect(el('card')!.style.visibility).toBe('')
    // 'none' animation -> show settles on the default-ms fallback timer.
    await vi.advanceTimersByTimeAsync(400)
    // not yet hidden (waiting 3000ms)
    expect(el('card')!.style.visibility).toBe('')
    await vi.advanceTimersByTimeAsync(3000)
    await vi.advanceTimersByTimeAsync(400)
    expect(el('card')!.style.visibility).toBe('hidden')
  })
})

describe('chat: clone-template + trim-children', () => {
  it('appends a bound row per message and caps the list', () => {
    const interactions: WidgetInteractions = {
      version: 1,
      on: {
        chat_message: [
          {
            op: 'clone-template',
            templateRef: 'row-tpl',
            into: 'list',
            bindings: {
              user: { set: 'text', value: { from: 'user.displayName' } },
              text: { set: 'text', value: { from: 'message.text' } },
            },
          },
          { op: 'trim-children', target: 'list', max: 2, from: 'oldest' },
        ],
      },
    }
    boot(
      { componentId: 'c1', userId: 'u1', globalConfig: {}, variantConfig: {}, interactions },
      `<div data-eeko-el="list"></div>
       <template data-eeko-el="row-tpl"><div class="row"><b data-eeko-el="user"></b>: <span data-eeko-el="text"></span></div></template>`
    )

    function chat(name: string, text: string) {
      emitWire('chat_message', {
        type: 'chat_message',
        user: { id: '1', username: name.toLowerCase(), displayName: name },
        message: { text },
      })
    }

    chat('Ada', 'hi')
    chat('Bob', 'yo')
    const list = el('list')!
    expect(list.children.length).toBe(2)
    expect(list.children[0].querySelector('b')!.textContent).toBe('Ada')
    expect(list.children[1].querySelector('span')!.textContent).toBe('yo')

    chat('Cy', 'sup')
    // capped at 2, oldest (Ada) dropped
    expect(list.children.length).toBe(2)
    expect(list.children[0].querySelector('b')!.textContent).toBe('Bob')
    expect(list.children[1].querySelector('b')!.textContent).toBe('Cy')
    // clone must not carry the template's data-eeko-el
    expect(list.children[0].getAttribute('data-eeko-el')).toBe(null)
  })

  it('clone uses textContent (no HTML injection)', () => {
    const interactions: WidgetInteractions = {
      version: 1,
      on: {
        chat_message: [
          {
            op: 'clone-template',
            templateRef: 'row-tpl',
            into: 'list',
            bindings: { text: { set: 'text', value: { from: 'message.text' } } },
          },
        ],
      },
    }
    boot(
      { componentId: 'c1', userId: 'u1', globalConfig: {}, variantConfig: {}, interactions },
      `<div data-eeko-el="list"></div>
       <template data-eeko-el="row-tpl"><div><span data-eeko-el="text"></span></div></template>`
    )
    emitWire('chat_message', {
      type: 'chat_message',
      user: { id: '1', username: 'x' },
      message: { text: '<img src=x onerror=alert(1)>' },
    })
    const span = el('list')!.querySelector('span')!
    // rendered as literal text, NOT parsed into an <img>
    expect(span.querySelector('img')).toBe(null)
    expect(span.textContent).toBe('<img src=x onerror=alert(1)>')
  })
})

describe('goal: set-style-ratio', () => {
  it('fills bar width % from variable / goal', () => {
    const interactions: WidgetInteractions = {
      version: 1,
      on: {
        variable_updated: [
          {
            op: 'set-style-ratio',
            target: 'fill',
            prop: 'width',
            numerator: { fromVariable: 'subs' },
            denominator: { from: 'goal' },
            unit: '%',
            clamp: true,
          },
        ],
      },
    }
    boot(
      {
        componentId: 'c1',
        userId: 'u1',
        globalConfig: { goal: 100 },
        variantConfig: {},
        interactions,
      },
      `<div data-eeko-el="track"><div data-eeko-el="fill" style="width:0%"></div></div>`
    )
    emitWire('variable_updated', { variable: { name: 'subs', type: 'number', value: 42 } })
    expect(el('fill')!.style.width).toBe('42%')
    // clamps over 100
    emitWire('variable_updated', { variable: { name: 'subs', type: 'number', value: 250 } })
    expect(el('fill')!.style.width).toBe('100%')
  })

  it('set-style-numeric respects min/max/multiplyBy + opacity is unitless', () => {
    const interactions: WidgetInteractions = {
      version: 1,
      on: {
        component_trigger: [
          { op: 'set-style-numeric', target: 'box', prop: 'opacity', from: { from: 'o' } },
          { op: 'set-style-numeric', target: 'box', prop: 'width', from: { from: 'w' }, unit: 'px', max: 50 },
        ],
      },
    }
    boot(
      { componentId: 'c1', userId: 'u1', globalConfig: {}, variantConfig: {}, interactions },
      `<div data-eeko-el="box"></div>`
    )
    emitWire('component_trigger', { o: 0.5, w: 999 })
    expect(el('box')!.style.opacity).toBe('0.5')
    expect(el('box')!.style.width).toBe('50px') // clamped to max
  })
})

describe('timer: start-timer emits timer_tick and runs its sequence', () => {
  it('ticks drive a timer_tick sequence (interval mode)', () => {
    vi.useFakeTimers()
    const interactions: WidgetInteractions = {
      version: 1,
      on: {
        component_mount: [
          { op: 'start-timer', timerId: 't1', intervalMs: 1000, mode: 'interval' },
        ],
        timer_tick: [
          { op: 'set-text', target: 'clock', from: { from: 'remaining' } },
        ],
      },
    }
    boot(
      { componentId: 'c1', userId: 'u1', globalConfig: {}, variantConfig: {}, interactions },
      `<span data-eeko-el="clock"></span>`
    )
    // component_mount fired on init (ready). Advance one interval.
    vi.advanceTimersByTime(1000)
    // remaining for interval (no duration) is 0 -> "00:00"
    expect(el('clock')!.textContent).toBe('00:00')
  })

  it('countdown counts down and auto-stops at 0', () => {
    vi.useFakeTimers()
    const ticks: any[] = []
    const interactions: WidgetInteractions = {
      version: 1,
      on: {
        component_mount: [
          { op: 'start-timer', timerId: 'cd', intervalMs: 1000, durationMs: 3000, mode: 'countdown' },
        ],
        timer_tick: [
          { op: 'set-text', target: 'clock', from: { from: 'remaining' } },
        ],
      },
    }
    boot(
      { componentId: 'c1', userId: 'u1', globalConfig: {}, variantConfig: {}, interactions },
      `<span data-eeko-el="clock"></span>`
    )
    // capture ticks too
    ;(window as any).eekoSDK.on('chat_message', () => {}) // no-op, keep shape
    vi.advanceTimersByTime(1000)
    expect(el('clock')!.textContent).toBe('00:02')
    vi.advanceTimersByTime(1000)
    expect(el('clock')!.textContent).toBe('00:01')
    vi.advanceTimersByTime(1000)
    expect(el('clock')!.textContent).toBe('00:00')
    // auto-stopped: further advances do not change it / no errors
    vi.advanceTimersByTime(5000)
    expect(el('clock')!.textContent).toBe('00:00')
    void ticks
  })

  it('clears timers on component_unmount', () => {
    vi.useFakeTimers()
    const interactions: WidgetInteractions = {
      version: 1,
      on: {
        component_mount: [{ op: 'start-timer', timerId: 't1', intervalMs: 1000, mode: 'interval' }],
        timer_tick: [{ op: 'increment-counter', counterId: 'n', by: 1 }],
      },
    }
    boot(
      { componentId: 'c1', userId: 'u1', globalConfig: {}, variantConfig: {}, interactions },
      `<span data-eeko-el="clock"></span>`
    )
    vi.advanceTimersByTime(2000) // 2 ticks
    emitWire('component_unmount', { componentId: 'c1', type: 'widget' })
    // after unmount, advancing should produce no further ticks (no throw)
    expect(() => vi.advanceTimersByTime(5000)).not.toThrow()
  })
})

describe('escape hatch: disable()', () => {
  it('after disable(), a component_trigger runs no interaction', () => {
    const interactions: WidgetInteractions = {
      version: 1,
      on: { component_trigger: [{ op: 'set-text', target: 'name', from: { from: 'displayName' } }] },
    }
    boot(
      { componentId: 'c1', userId: 'u1', globalConfig: {}, variantConfig: {}, interactions },
      `<span data-eeko-el="name">orig</span>`
    )
    ;(window as any).eekoSDK.interactions.disable()
    emitWire('component_trigger', { displayName: 'Ada' })
    // unchanged
    expect(el('name')!.textContent).toBe('orig')
    expect((window as any).eekoSDK.interactions.isManaged()).toBe(false)
  })

  it('disableEvent() suppresses only that event', () => {
    const interactions: WidgetInteractions = {
      version: 1,
      on: {
        component_trigger: [{ op: 'set-text', target: 'name', from: { from: 'displayName' } }],
        variable_updated: [{ op: 'set-text', target: 'v', from: { fromVariable: 'x' } }],
      },
    }
    boot(
      { componentId: 'c1', userId: 'u1', globalConfig: {}, variantConfig: {}, interactions },
      `<span data-eeko-el="name">orig</span><span data-eeko-el="v">orig</span>`
    )
    ;(window as any).eekoSDK.interactions.disableEvent('component_trigger')
    emitWire('component_trigger', { displayName: 'Ada' })
    expect(el('name')!.textContent).toBe('orig') // suppressed
    emitWire('variable_updated', { variable: { name: 'x', type: 'string', value: 'live' } })
    expect(el('v')!.textContent).toBe('live') // still runs
  })
})

describe('guards, classes, attrs, security', () => {
  it('onlyIf skips just the guarded action', () => {
    const interactions: WidgetInteractions = {
      version: 1,
      on: {
        component_trigger: [
          { op: 'set-text', target: 'a', from: { literal: 'always' } },
          {
            op: 'set-text',
            target: 'b',
            from: { literal: 'only-if-amount' },
            onlyIf: { from: 'amount', op: 'gt', value: 10 },
          },
        ],
      },
    }
    boot(
      { componentId: 'c1', userId: 'u1', globalConfig: {}, variantConfig: {}, interactions },
      `<span data-eeko-el="a"></span><span data-eeko-el="b">init</span>`
    )
    emitWire('component_trigger', { amount: 5 })
    expect(el('a')!.textContent).toBe('always')
    expect(el('b')!.textContent).toBe('init') // guard failed -> skipped
    emitWire('component_trigger', { amount: 50 })
    expect(el('b')!.textContent).toBe('only-if-amount')
  })

  it('add/remove/toggle-class validates class names', () => {
    const interactions: WidgetInteractions = {
      version: 1,
      on: {
        component_trigger: [
          { op: 'add-class', target: 'x', class: 'lit up' },
          { op: 'add-class', target: 'x', class: 'bad;name' }, // invalid -> skipped
        ],
      },
    }
    boot(
      { componentId: 'c1', userId: 'u1', globalConfig: {}, variantConfig: {}, interactions },
      `<div data-eeko-el="x"></div>`
    )
    emitWire('component_trigger', {})
    const x = el('x')!
    expect(x.classList.contains('lit')).toBe(true)
    expect(x.classList.contains('up')).toBe(true)
    expect(x.className.indexOf('bad')).toBe(-1)
  })

  it('set-attr rejects unsafe src and disallowed attrs', () => {
    const interactions: WidgetInteractions = {
      version: 1,
      on: {
        component_trigger: [
          { op: 'set-attr', target: 'img', attr: 'src', from: { from: 'good' } },
          { op: 'set-attr', target: 'img', attr: 'alt', from: { literal: 'hello' } },
        ],
      },
    }
    boot(
      { componentId: 'c1', userId: 'u1', globalConfig: {}, variantConfig: {}, interactions },
      `<img data-eeko-el="img" />`
    )
    // unsafe javascript: src
    emitWire('component_trigger', { good: 'javascript:alert(1)' })
    expect(el('img')!.getAttribute('src')).toBe(null)
    expect(el('img')!.getAttribute('alt')).toBe('hello')
    // https src allowed
    emitWire('component_trigger', { good: 'https://cdn.example/x.png' })
    expect(el('img')!.getAttribute('src')).toBe('https://cdn.example/x.png')
  })

  it('missing target skips with a warn, never throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const interactions: WidgetInteractions = {
      version: 1,
      on: { component_trigger: [{ op: 'set-text', target: 'nope', from: { literal: 'x' } }] },
    }
    boot(
      { componentId: 'c1', userId: 'u1', globalConfig: {}, variantConfig: {}, interactions },
      `<div></div>`
    )
    expect(() => emitWire('component_trigger', {})).not.toThrow()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('queue policy', () => {
  it('replace cancels the in-flight run and starts fresh', async () => {
    vi.useFakeTimers()
    const interactions: WidgetInteractions = {
      version: 1,
      on: {
        component_trigger: [
          { op: 'set-text', target: 'out', from: { from: 'tag' } },
          { op: 'wait', ms: 1000 },
          { op: 'set-text', target: 'done', from: { from: 'tag' } },
        ],
      },
      queue: { component_trigger: 'replace' },
    }
    boot(
      { componentId: 'c1', userId: 'u1', globalConfig: {}, variantConfig: {}, interactions },
      `<span data-eeko-el="out"></span><span data-eeko-el="done"></span>`
    )
    emitWire('component_trigger', { tag: 'first' })
    expect(el('out')!.textContent).toBe('first')
    // before the first finishes its 1000ms wait, fire again -> replace
    await vi.advanceTimersByTimeAsync(200)
    emitWire('component_trigger', { tag: 'second' })
    expect(el('out')!.textContent).toBe('second')
    await vi.advanceTimersByTimeAsync(1000)
    // only the second run reaches 'done' (first was cancelled mid-wait)
    expect(el('done')!.textContent).toBe('second')
  })

  it('queue serializes runs in order', async () => {
    vi.useFakeTimers()
    const interactions: WidgetInteractions = {
      version: 1,
      on: {
        component_trigger: [
          { op: 'wait', ms: 100 },
          { op: 'clone-template', templateRef: 'tpl', into: 'list', bindings: { t: { set: 'text', value: { from: 'tag' } } } },
        ],
      },
      queue: { component_trigger: 'queue' },
    }
    boot(
      { componentId: 'c1', userId: 'u1', globalConfig: {}, variantConfig: {}, interactions },
      `<div data-eeko-el="list"></div><template data-eeko-el="tpl"><div><span data-eeko-el="t"></span></div></template>`
    )
    emitWire('component_trigger', { tag: 'a' })
    emitWire('component_trigger', { tag: 'b' })
    await vi.advanceTimersByTimeAsync(100)
    await vi.advanceTimersByTimeAsync(100)
    const list = el('list')!
    expect(list.children.length).toBe(2)
    expect(list.children[0].querySelector('span')!.textContent).toBe('a')
    expect(list.children[1].querySelector('span')!.textContent).toBe('b')
  })

  it('skip drops events while a run is active', async () => {
    vi.useFakeTimers()
    const interactions: WidgetInteractions = {
      version: 1,
      on: {
        component_trigger: [
          { op: 'wait', ms: 100 },
          { op: 'clone-template', templateRef: 'tpl', into: 'list', bindings: { t: { set: 'text', value: { from: 'tag' } } } },
        ],
      },
      queue: { component_trigger: 'skip' },
    }
    boot(
      { componentId: 'c1', userId: 'u1', globalConfig: {}, variantConfig: {}, interactions },
      `<div data-eeko-el="list"></div><template data-eeko-el="tpl"><div><span data-eeko-el="t"></span></div></template>`
    )
    emitWire('component_trigger', { tag: 'a' })
    emitWire('component_trigger', { tag: 'b' }) // dropped (a active)
    await vi.advanceTimersByTimeAsync(100)
    const list = el('list')!
    expect(list.children.length).toBe(1)
    expect(list.children[0].querySelector('span')!.textContent).toBe('a')
  })
})
