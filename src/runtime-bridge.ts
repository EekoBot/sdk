/**
 * Shared runtime bridge for `window.eekoSDK`.
 *
 * This module exports the bridge's **source code as a string constant** so
 * that both the production widget-host worker and the local-dev CLI can
 * serve / inject it without bundler gymnastics. The bridge is a vanilla
 * IIFE with zero imports.
 *
 * Transport selection:
 *   - If `window.__EEKO_DEV__` is set (by `@eeko/cli`'s Vite plugin)
 *     → WebSocket to the CLI's local dev server.
 *   - Otherwise → `window.addEventListener('message', …)` for parent-frame
 *     postMessage envelopes from the overlay app.
 *
 * @example
 * // In widget-host (Cloudflare Worker):
 * import { RUNTIME_BRIDGE_JS } from '@eeko/sdk/runtime-bridge'
 * return new Response(RUNTIME_BRIDGE_JS, { headers: { 'Content-Type': 'application/javascript' } })
 *
 * @example
 * // In @eeko/cli Vite plugin:
 * import { RUNTIME_BRIDGE_JS } from '@eeko/sdk/runtime-bridge'
 * return `<script>window.__EEKO_DEV__={wsUrl:"ws://localhost:9876"};</script><script>${RUNTIME_BRIDGE_JS}</script>`
 */

/**
 * Shape of the `window.__EEKO_DEV__` global that the CLI's Vite plugin sets
 * before the bridge loads. Exported so the CLI plugin can typecheck its config.
 */
export interface EekoDevGlobal {
  wsUrl: string
}

/**
 * The bridge source code. ~170 lines of vanilla IIFE, no imports, no
 * module syntax. Both production (parent-postMessage) and dev (WebSocket)
 * transports are compiled in; the IIFE reads `window.__EEKO_DEV__` at
 * boot to decide which path to take.
 */
export const RUNTIME_BRIDGE_JS: string = `/* @eeko/sdk runtime bridge */
(function () {
  if (window.eekoSDK && window.eekoSDK.__eekoBridge) return;

  var EVENT_TYPES = [
    'component_trigger',
    'component_update',
    'component_dismiss',
    'component_sync',
    'component_mount',
    'component_unmount',
    'chat_message',
    'variable_updated'
  ];

  var listeners = Object.create(null);
  var state = {
    componentId: undefined,
    userId: undefined,
    globalConfig: {},
    variantConfig: {}
  };
  var ready = false;

  function emit(event, data) {
    var arr = listeners[event];
    if (!arr) return;
    for (var i = 0; i < arr.length; i++) {
      try { arr[i](data); } catch (e) { console.error('[eekoSDK] handler error', event, e); }
    }
  }

  function on(event, handler) {
    if (typeof handler !== 'function') return;
    if (EVENT_TYPES.indexOf(event) === -1) {
      console.warn('[eekoSDK] unknown event type:', event);
      return;
    }
    (listeners[event] = listeners[event] || []).push(handler);
  }

  function off(event, handler) {
    var arr = listeners[event];
    if (!arr) return;
    var i = arr.indexOf(handler);
    if (i >= 0) arr.splice(i, 1);
  }

  function setState(partial) {
    if (!partial) return;
    for (var k in partial) {
      if (Object.prototype.hasOwnProperty.call(partial, k)) state[k] = partial[k];
    }
  }

  function reset() {
    for (var k in listeners) { if (listeners[k]) listeners[k].length = 0; }
    state = {
      componentId: 'dev-component',
      userId: 'dev-user',
      globalConfig: {},
      variantConfig: {}
    };
    ready = false;
  }

  window.eekoSDK = {
    __eekoBridge: true,
    on: on,
    off: off,
    getState: function () { return state; },
    isReady: function () { return ready; },
    _emit: emit,
    _setState: setState,
    _initialize: function (initial) {
      setState(initial);
      ready = true;
    }
  };

  // ── Transport: dev (WebSocket) or production (parent postMessage) ────────

  var devCfg = window.__EEKO_DEV__;

  if (devCfg && devCfg.wsUrl) {
    // ── WebSocket transport (@eeko/cli local dev) ──────────────────────────
    state.componentId = 'dev-component';
    state.userId = 'dev-user';

    var ws = null;
    var reconnectAttempts = 0;
    var maxReconnectAttempts = 10;

    function connectWs() {
      try {
        ws = new WebSocket(devCfg.wsUrl);

        ws.onopen = function () {
          console.log('[eekoSDK:dev] connected to dev server');
          reconnectAttempts = 0;
          ready = true;
        };

        ws.onmessage = function (ev) {
          try {
            var msg = JSON.parse(ev.data);
            handleWsMessage(msg);
          } catch (e) {
            console.error('[eekoSDK:dev] failed to parse message:', e);
          }
        };

        ws.onerror = function () {
          console.error('[eekoSDK:dev] WebSocket error');
        };

        ws.onclose = function () {
          console.log('[eekoSDK:dev] disconnected');
          ready = false;
          attemptReconnect();
        };
      } catch (e) {
        console.error('[eekoSDK:dev] connect failed:', e);
        attemptReconnect();
      }
    }

    function attemptReconnect() {
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        var delay = Math.min(1000 * reconnectAttempts, 5000);
        console.log('[eekoSDK:dev] reconnecting in ' + delay + 'ms...');
        setTimeout(connectWs, delay);
      }
    }

    function handleWsMessage(msg) {
      switch (msg.type) {
        case 'event':
          if (msg.event && msg.payload !== undefined) {
            emit(msg.event, msg.payload);
          }
          break;
        case 'state':
          if (msg.state) setState(msg.state);
          break;
        case 'command':
          if (msg.command === 'init') { setState(msg.state || {}); ready = true; }
          else if (msg.command === 'reset') { reset(); }
          else if (msg.command === 'disconnect') { if (ws) ws.close(); }
          break;
      }
    }

    connectWs();
    console.log('[eekoSDK:dev] SDK available on window.eekoSDK');

  } else {
    // ── Parent postMessage transport (production iframe) ───────────────────
    window.addEventListener('message', function (ev) {
      if (ev.source !== window.parent) return;
      var msg = ev.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'eeko:init') {
        setState(msg.state || {});
        ready = true;
        emit('component_mount', { componentId: state.componentId, type: 'widget' });
        return;
      }
      if (msg.type === 'eeko:event' && msg.event && EVENT_TYPES.indexOf(msg.event) !== -1) {
        emit(msg.event, msg.data);
      }
    });

    try {
      window.parent.postMessage({ type: 'eeko:ready' }, '*');
    } catch (e) { /* sandboxed frames may block this; ignore */ }
  }
})();
`
