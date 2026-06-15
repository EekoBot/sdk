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

import { INTERACTION_RUNTIME_JS } from './interaction-runtime'

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
 *
 * Kept internal: the shipped runtime ({@link RUNTIME_BRIDGE_JS}) appends the
 * declarative interaction interpreter after this IIFE, under the unchanged
 * public export name so the widget-host / CLI need no injection change.
 */
const BRIDGE_IIFE_JS = `/* @eeko/sdk runtime bridge */
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
    variantConfig: {},
    canvas: undefined
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

  // Unwrap rule for the parent → iframe event envelope.
  //
  // Wire envelopes are always { type, context, payload } across every
  // outbound event. \`payload\` IS the developer-facing data — the canonical
  // shape handlers consume. One rule, no per-event branching.
  function unwrap(_eventName, data) {
    if (data && typeof data === 'object' && 'payload' in data) return data.payload;
    return data;
  }

  function reset() {
    for (var k in listeners) { if (listeners[k]) listeners[k].length = 0; }
    state = {
      componentId: 'dev-component',
      userId: 'dev-user',
      globalConfig: {},
      variantConfig: {},
      canvas: undefined
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

  // ── Phase 2 template substitution ──────────────────────────────────────
  //
  // Widget-host substitutes globalConfig values into HTML/CSS/JS at serve
  // time, but leaves variant-scope {tokens} unsubstituted so they can be
  // filled in here on each trigger event. Mirrors the pre-iframe pipeline:
  // globals bake at init, variants substitute on each trigger by walking
  // the iframe DOM. <script>, <style>, and <template> contents are skipped
  // (their text has already been parsed; re-substituting is a no-op).

  var TOKEN_RE = /\\{(\\w+)\\}/g;

  // Attribute values are stored verbatim by setAttribute (no HTML
  // re-parsing happens on assignment), and the iframe shell is already
  // sandbox-isolated with a strict CSP. We deliberately do not apply
  // HTML-escape here — that would render literal '&amp;' / '&lt;' as
  // user-visible text inside attributes like title / alt / aria-label.
  // Authors who interpolate untrusted values into JS-parsing attributes
  // (style, onclick, srcdoc) own escaping per their own context.
  function substituteString(tpl, data) {
    if (typeof tpl !== 'string' || tpl.indexOf('{') === -1) return tpl;
    return tpl.replace(TOKEN_RE, function (match, key) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        var v = data[key];
        if (v === null || v === undefined) return match;
        return String(v);
      }
      return match;
    });
  }

  function hasOwnKeys(o) {
    for (var k in o) {
      if (Object.prototype.hasOwnProperty.call(o, k)) return true;
    }
    return false;
  }

  function processDOM(data) {
    if (!data || typeof data !== 'object' || !document.body) return;
    if (!hasOwnKeys(data)) return;

    var walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (n) {
          var p = n.parentNode;
          var tag = p && p.nodeName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEMPLATE') {
            return NodeFilter.FILTER_REJECT;
          }
          return n.nodeValue && n.nodeValue.indexOf('{') !== -1
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        }
      }
    );
    var n;
    while ((n = walker.nextNode())) {
      n.nodeValue = substituteString(n.nodeValue, data);
    }

    var els = document.body.querySelectorAll('*');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var tag = el.nodeName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEMPLATE') continue;
      var attrs = el.attributes;
      for (var j = 0; j < attrs.length; j++) {
        var v = attrs[j].value;
        if (v && v.indexOf('{') !== -1) {
          attrs[j].value = substituteString(v, data);
        }
      }
    }
  }

  function phase2(eventName, envelope) {
    if (
      eventName !== 'component_trigger' &&
      eventName !== 'component_update' &&
      eventName !== 'component_sync'
    ) return;

    // Wire envelope's \`payload\` is the developer-facing data — flat record
    // of dataPoints + streamer-configured fields. No nested .data lookup.
    var triggerData = null;
    if (envelope && typeof envelope === 'object') {
      var pl = envelope.payload;
      if (pl && typeof pl === 'object') triggerData = pl;
    }

    var merged = {};
    var base = state.variantConfig;
    if (base && typeof base === 'object') {
      for (var k1 in base) {
        if (Object.prototype.hasOwnProperty.call(base, k1)) merged[k1] = base[k1];
      }
    }
    if (triggerData) {
      for (var k2 in triggerData) {
        if (Object.prototype.hasOwnProperty.call(triggerData, k2)) merged[k2] = triggerData[k2];
      }
    }
    processDOM(merged);
  }

  // ── Canvas: pin design px + zoom-to-fit ────────────────────────────────
  //
  // The author designs against a fixed pixel canvas (state.canvas). We pin the
  // platform #widget-root to those exact dimensions and scale it to fit the
  // iframe viewport, preserving aspect ratio and centering (letterbox). In an
  // OBS browser source sized to the canvas this resolves to scale 1 (pixel-
  // perfect); in a preview pane shaped to the canvas aspect it fills exactly;
  // any other size letterboxes cleanly. Legacy widgets (no canvas) are left
  // untouched and fill 100% as before.
  function applyCanvas() {
    var c = state.canvas;
    var root = document.getElementById('widget-root');
    if (!root || !c) return;
    var w = Number(c.width), h = Number(c.height);
    if (!(w > 0) || !(h > 0)) return;
    root.style.position = 'absolute';
    root.style.top = '0';
    root.style.left = '0';
    root.style.width = w + 'px';
    root.style.height = h + 'px';
    root.style.transformOrigin = 'top left';
    var vw = window.innerWidth || w;
    var vh = window.innerHeight || h;
    var scale = Math.min(vw / w, vh / h);
    var offsetX = (vw - w * scale) / 2;
    var offsetY = (vh - h * scale) / 2;
    root.style.transform = 'translate(' + offsetX + 'px, ' + offsetY + 'px) scale(' + scale + ')';
  }

  // Pick up shell-injected seed state synchronously so the first paint
  // already has variantConfig values filled in before author JS runs.
  // The shell places this script inside <body> after the widget markup,
  // so document.body normally exists by the time we get here — but if a
  // future caller wires the bridge into <head> we'd hit a null body, so
  // fall back to DOMContentLoaded.
  try {
    var injected = window.__EEKO_INIT__;
    if (injected && typeof injected === 'object') {
      setState(injected);
      var injectedVariant = injected.variantConfig;
      if (injectedVariant) {
        if (document.body) {
          processDOM(injectedVariant);
        } else {
          var onReady = function () {
            document.removeEventListener('DOMContentLoaded', onReady);
            processDOM(injectedVariant);
          };
          document.addEventListener('DOMContentLoaded', onReady);
        }
      }
    }
  } catch (e) {
    console.error('[eekoSDK] __EEKO_INIT__ read failed', e);
  }

  // Fit the (possibly already-injected) canvas now, and re-fit whenever the
  // iframe viewport changes (OBS source resize, preview pane reflow).
  try {
    applyCanvas();
    window.addEventListener('resize', applyCanvas);
  } catch (e) { /* no canvas / no DOM — harmless */ }

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
            phase2(msg.event, msg.payload);
            emit(msg.event, unwrap(msg.event, msg.payload));
          }
          break;
        case 'state':
          if (msg.state) setState(msg.state);
          break;
        case 'command':
          if (msg.command === 'init') {
            setState(msg.state || {});
            ready = true;
            applyCanvas();
            if (state.variantConfig) processDOM(state.variantConfig);
            // Parity with the production postMessage path's eeko:init, which
            // emits component_mount so timer-driven / mount-bound widgets (and
            // the interaction runtime's component_mount sequences) fire under
            // \`eeko dev\` too.
            emit('component_mount', { componentId: state.componentId, type: 'widget' });
          }
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
        applyCanvas();
        if (state.variantConfig) processDOM(state.variantConfig);
        emit('component_mount', { componentId: state.componentId, type: 'widget' });
        return;
      }
      if (msg.type === 'eeko:event' && msg.event && EVENT_TYPES.indexOf(msg.event) !== -1) {
        phase2(msg.event, msg.data);
        emit(msg.event, unwrap(msg.event, msg.data));
      }
    });

    try {
      // Report the canvas so the parent preview host can shape its iframe
      // wrapper to the widget's aspect ratio before/while the widget paints.
      window.parent.postMessage({ type: 'eeko:ready', canvas: state.canvas }, '*');
    } catch (e) { /* sandboxed frames may block this; ignore */ }
  }
})();
`

/**
 * The full shipped runtime served at the iframe's `/_runtime/sdk.js`: the
 * bridge IIFE followed by the declarative interaction interpreter IIFE. The
 * interpreter runs after `window.eekoSDK` exists (so it can register handlers)
 * and before the author's `script.js`, and no-ops on widgets with no
 * `interactions`. The export name is unchanged so widget-host and the CLI need
 * no injection change.
 */
export const RUNTIME_BRIDGE_JS: string = BRIDGE_IIFE_JS + '\n' + INTERACTION_RUNTIME_JS
