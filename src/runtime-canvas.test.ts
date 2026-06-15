// @vitest-environment happy-dom
/**
 * Canvas scaling tests for the runtime bridge.
 *
 * The bridge reads `__EEKO_INIT__.canvas` and pins the platform `#widget-root`
 * to the authored design px, then zoom-to-fits it into the iframe viewport
 * (letterbox-centered). It also reports the canvas to the parent in its
 * `eeko:ready` handshake so preview hosts can shape their wrapper.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RUNTIME_BRIDGE_JS } from './runtime-bridge'

interface InitState {
  componentId?: string
  userId?: string
  globalConfig?: Record<string, unknown>
  variantConfig?: Record<string, unknown>
  canvas?: { width: number; height: number; preset?: string }
}

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true })
}

function boot(init: InitState | undefined) {
  delete (window as any).eekoSDK
  delete (window as any).__EEKO_DEV__
  document.body.innerHTML = '<div id="widget-root" data-instance-id="t"></div>'
  if (init === undefined) delete (window as any).__EEKO_INIT__
  else (window as any).__EEKO_INIT__ = init
  ;(0, eval)(RUNTIME_BRIDGE_JS)
}

function root(): HTMLElement {
  return document.getElementById('widget-root') as HTMLElement
}

describe('runtime bridge canvas scaling', () => {
  beforeEach(() => {
    setViewport(500, 500)
  })
  afterEach(() => {
    delete (window as any).eekoSDK
  })

  it('pins the widget root to design px and zoom-to-fits it (letterboxed)', () => {
    boot({ canvas: { width: 1000, height: 500 } })
    const r = root()
    // scale = min(500/1000, 500/500) = 0.5; centered: offsetY = (500-250)/2 = 125
    expect(r.style.width).toBe('1000px')
    expect(r.style.height).toBe('500px')
    expect(r.style.transformOrigin).toBe('top left')
    expect(r.style.transform).toBe('translate(0px, 125px) scale(0.5)')
  })

  it('renders 1:1 when the viewport equals the canvas (OBS browser source)', () => {
    setViewport(1920, 1080)
    boot({ canvas: { width: 1920, height: 1080 } })
    expect(root().style.transform).toBe('translate(0px, 0px) scale(1)')
  })

  it('leaves the root untouched for legacy widgets with no canvas', () => {
    boot({ componentId: 'c', userId: 'u' })
    expect(root().style.transform).toBe('')
    expect(root().style.width).toBe('')
  })

  it('reports the canvas to the parent in eeko:ready', () => {
    const spy = vi.spyOn(window.parent, 'postMessage')
    boot({ canvas: { width: 1080, height: 1920, preset: 'vertical-1080' } })
    const ready = spy.mock.calls.find(([m]) => m && (m as any).type === 'eeko:ready')
    expect(ready).toBeTruthy()
    expect((ready![0] as any).canvas).toEqual({ width: 1080, height: 1920, preset: 'vertical-1080' })
    spy.mockRestore()
  })

  it('re-fits on viewport resize', () => {
    boot({ canvas: { width: 1000, height: 1000 } })
    expect(root().style.transform).toBe('translate(0px, 0px) scale(0.5)')
    setViewport(1000, 1000)
    window.dispatchEvent(new Event('resize'))
    expect(root().style.transform).toBe('translate(0px, 0px) scale(1)')
  })

  it('clears the pinned styles when the canvas is removed (reset reconcile)', () => {
    boot({ canvas: { width: 1000, height: 1000 } })
    expect(root().style.transform).not.toBe('')
    // Simulate a reset/re-init to a canvas-less (legacy) widget, then re-fit.
    ;(window as any).eekoSDK._setState({ canvas: undefined })
    window.dispatchEvent(new Event('resize'))
    expect(root().style.transform).toBe('')
    expect(root().style.width).toBe('')
    expect(root().style.position).toBe('')
  })

  it('applies the canvas after DOMContentLoaded when #widget-root is absent at boot (head injection)', () => {
    delete (window as any).eekoSDK
    delete (window as any).__EEKO_DEV__
    setViewport(500, 500)
    document.body.innerHTML = '' // no #widget-root yet
    ;(window as any).__EEKO_INIT__ = { canvas: { width: 1000, height: 500 } }
    ;(0, eval)(RUNTIME_BRIDGE_JS)
    // Root appears once the document finishes parsing:
    document.body.innerHTML = '<div id="widget-root" data-instance-id="t"></div>'
    document.dispatchEvent(new Event('DOMContentLoaded'))
    expect(root().style.width).toBe('1000px')
    expect(root().style.transform).toBe('translate(0px, 125px) scale(0.5)')
  })
})
