/**
 * @eeko/sdk — Declarative Interaction Runtime (`INTERACTION_RUNTIME_JS`)
 *
 * The interpreter for the `WidgetInteractions` contract (`./interactions/types`).
 * Like `runtime-bridge.ts`, this module exports its implementation as a vanilla
 * IIFE **string** so the production widget-host and the local `@eeko/cli` dev
 * harness ship the exact same behaviour behind the one `window.eekoSDK` seam.
 *
 * It is concatenated AFTER the bridge IIFE and BEFORE the author's `script.js`
 * (see `RUNTIME_BRIDGE_JS` composition in `./runtime-bridge`), so by the time
 * it runs `window.eekoSDK` already exists, and any handlers it registers run
 * before the author's. An author can fully opt out by calling
 * `window.eekoSDK.interactions.disable()` at the very top of `script.js`.
 *
 * Design (mirrors the contract's rules):
 *  - The runner is a `switch` over an enumerated op vocabulary — never `eval`,
 *    `new Function`, `fetch`, `XHR`, `WebSocket`, or dynamic import.
 *  - All writes are sanitised: `set-text` uses `textContent`; `clone-template`
 *    uses `cloneNode(true)`; `set-attr` only writes `src`/`alt`/`title` and
 *    validates `src` against `eeko-asset://` / `https://`; class names match
 *    `^[A-Za-z0-9 _-]+$`; animation names match `^[A-Za-z0-9-]+$`.
 *  - Targets are `data-eeko-el` ids resolved with `querySelector`. A target
 *    that doesn't resolve skips the action with a `console.warn` — never throws.
 *  - Purely additive + gated: if `__EEKO_INIT__.interactions` is absent or has
 *    no non-empty `on` sequences, the whole IIFE no-ops, so existing widgets
 *    behave identically.
 *
 * Keep it ES5-ish vanilla (var / function) — no TS-only syntax inside the
 * string. The surrounding `export const … : string = \`…\`` is the only TS.
 */

/**
 * Source code of the interaction interpreter. Composed into `RUNTIME_BRIDGE_JS`.
 * Reads `window.__EEKO_INIT__.interactions` + `.behavior` itself at boot.
 */
export const INTERACTION_RUNTIME_JS: string = `/* @eeko/sdk interaction runtime */
(function () {
  var sdk = window.eekoSDK;
  if (!sdk || sdk.interactions) return; // need the bridge; never install twice

  // ── Gate: read the declarative model the shell injected ────────────────
  var init = window.__EEKO_INIT__;
  var interactions = init && typeof init === 'object' ? init.interactions : null;
  var behavior = (init && typeof init === 'object' && init.behavior && typeof init.behavior === 'object')
    ? init.behavior
    : {};

  function hasSequences(ix) {
    if (!ix || typeof ix !== 'object' || !ix.on || typeof ix.on !== 'object') return false;
    for (var k in ix.on) {
      if (Object.prototype.hasOwnProperty.call(ix.on, k)) {
        var seq = ix.on[k];
        if (Array.isArray(seq) && seq.length > 0) return true;
      }
    }
    return false;
  }

  // Always publish the escape-hatch surface so an author can probe/opt-out
  // even on a widget that ships no interactions.
  var disabledAll = false;
  var disabledEvents = Object.create(null);
  sdk.interactions = {
    disable: function () { disabledAll = true; },
    disableEvent: function (evt) { if (typeof evt === 'string') disabledEvents[evt] = true; },
    isManaged: function () { return hasSequences(interactions) && !disabledAll; }
  };

  if (!hasSequences(interactions)) return; // gated no-op for legacy widgets

  // ── Constants / validators ─────────────────────────────────────────────
  var CLASS_RE = /^[A-Za-z0-9 _-]+$/;
  var ANIM_RE = /^[A-Za-z0-9-]+$/;
  var ATTR_ALLOW = { src: true, alt: true, title: true };
  var ANIM_PRESETS = {
    none: '',
    fade: 'eeko-fade-in',
    'slide-up': 'eeko-slide-up',
    'slide-down': 'eeko-slide-down',
    zoom: 'eeko-zoom-in',
    pulse: 'eeko-pulse'
  };
  var DEFAULT_ANIM_MS = 400;

  function warn() {
    try { console.warn.apply(console, arguments); } catch (e) {}
  }

  // ── State the kit owns ───────────────────────────────────────────────────
  var variables = Object.create(null); // name -> latest variable_updated value
  var counters = Object.create(null);  // counterId -> number
  var timers = Object.create(null);    // timerId -> { handle, startedAt, intervalMs, durationMs, mode }

  function getState() {
    try { return sdk.getState() || {}; } catch (e) { return {}; }
  }

  // ── Element addressing ───────────────────────────────────────────────────
  function selectorFor(id) {
    // id is a stable data-eeko-el value (e.g. "el-3"). Wrap in CSS string
    // quotes and escape backslashes + quotes so it cannot break out of the
    // attribute selector. No HTML is parsed here.
    var safe = String(id).replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"');
    return '[data-eeko-el="' + safe + '"]';
  }

  function resolveEl(id) {
    if (id === undefined || id === null) return null;
    var el = null;
    try { el = document.querySelector(selectorFor(id)); } catch (e) { el = null; }
    return el;
  }

  // ── Binding resolution ───────────────────────────────────────────────────
  // merged = globalConfig <- variantConfig <- payload (later wins).
  function buildMerged(payload) {
    var st = getState();
    var merged = {};
    var g = st.globalConfig;
    if (g && typeof g === 'object') {
      for (var k1 in g) { if (Object.prototype.hasOwnProperty.call(g, k1)) merged[k1] = g[k1]; }
    }
    var v = st.variantConfig;
    if (v && typeof v === 'object') {
      for (var k2 in v) { if (Object.prototype.hasOwnProperty.call(v, k2)) merged[k2] = v[k2]; }
    }
    if (payload && typeof payload === 'object') {
      for (var k3 in payload) { if (Object.prototype.hasOwnProperty.call(payload, k3)) merged[k3] = payload[k3]; }
    }
    return merged;
  }

  // Dotted-path own-property walk — NO bracket access, NO prototype access.
  function walkPath(root, path) {
    if (root === undefined || root === null) return undefined;
    var parts = String(path).split('.');
    var cur = root;
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
      var key = parts[i];
      if (!Object.prototype.hasOwnProperty.call(cur, key)) return undefined;
      cur = cur[key];
    }
    return cur;
  }

  // Resolve a Binding to a raw value. \`merged\` is precomputed per run.
  function resolveBinding(binding, merged) {
    if (!binding || typeof binding !== 'object') return undefined;
    if (Object.prototype.hasOwnProperty.call(binding, 'literal')) return binding.literal;
    if (Object.prototype.hasOwnProperty.call(binding, 'from')) return walkPath(merged, binding.from);
    if (Object.prototype.hasOwnProperty.call(binding, 'fromVariable')) {
      var vn = binding.fromVariable;
      return Object.prototype.hasOwnProperty.call(variables, vn) ? variables[vn] : undefined;
    }
    if (Object.prototype.hasOwnProperty.call(binding, 'fromCounter')) {
      var cn = binding.fromCounter;
      return Object.prototype.hasOwnProperty.call(counters, cn) ? counters[cn] : undefined;
    }
    if (Object.prototype.hasOwnProperty.call(binding, 'fromBehavior')) {
      var bk = binding.fromBehavior;
      return Object.prototype.hasOwnProperty.call(behavior, bk) ? behavior[bk] : undefined;
    }
    return undefined;
  }

  function toNumber(v) {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim() !== '') {
      var n = Number(v);
      return isNaN(n) ? undefined : n;
    }
    if (typeof v === 'boolean') return v ? 1 : 0;
    return undefined;
  }

  // ── onlyIf guard ─────────────────────────────────────────────────────────
  // Returns true if the action should RUN.
  function guardPasses(guard, merged) {
    if (!guard || typeof guard !== 'object') return true;
    var actual = walkPath(merged, guard.from);
    switch (guard.op) {
      case 'present':
        return actual !== undefined && actual !== null;
      case 'truthy':
        return !!actual;
      case 'eq':
        // Loose-ish equality across string/number to match streamer-config data.
        if (actual === guard.value) return true;
        if (actual === undefined || actual === null) return false;
        return String(actual) === String(guard.value);
      case 'gt':
        var a = toNumber(actual);
        var b = toNumber(guard.value);
        if (a === undefined || b === undefined) return false;
        return a > b;
      default:
        return true;
    }
  }

  // ── Animation helpers ────────────────────────────────────────────────────
  function presetKeyframe(preset) {
    if (preset === undefined || preset === null) return ANIM_PRESETS.fade;
    if (!Object.prototype.hasOwnProperty.call(ANIM_PRESETS, preset)) return ANIM_PRESETS.fade;
    return ANIM_PRESETS[preset];
  }

  function applyShow(el, action) {
    // Make visible first so any entrance keyframe is observable. Must be the
    // explicit 'visible' value, not '': clearing the inline style only falls
    // back to the stylesheet, and the standard authoring pattern hides alert
    // roots via a stylesheet rule (.alert { visibility: hidden }) which ''
    // cannot override, so the widget could never be revealed.
    el.style.visibility = 'visible';
    if (el.style.display === 'none') el.style.display = '';
    el.style.opacity = '';
    var name = presetKeyframe(action.animation);
    if (name && ANIM_RE.test(name)) {
      var ms = typeof action.durationMs === 'number' ? action.durationMs : DEFAULT_ANIM_MS;
      el.style.animation = name + ' ' + ms + 'ms ease both';
    }
  }

  function applyHide(el, action) {
    var name = presetKeyframe(action.animation);
    var ms = typeof action.durationMs === 'number' ? action.durationMs : DEFAULT_ANIM_MS;
    if (name && ANIM_RE.test(name)) {
      // Exit = same keyframe reversed (acceptable for v1).
      el.style.animation = name + ' ' + ms + 'ms ease both reverse';
    }
  }

  // Returns a Promise that resolves when the show/hide visual settles, so the
  // sequence runner can sequence on it.
  function waitForVisual(el, durationMs) {
    var ms = typeof durationMs === 'number' ? durationMs : DEFAULT_ANIM_MS;
    return new Promise(function (resolve) {
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        el.removeEventListener('animationend', finish);
        resolve();
      }
      el.addEventListener('animationend', finish);
      // animationend is not guaranteed (display:none, reduced motion, no
      // keyframe) — always have a timer fallback.
      setTimeout(finish, ms);
    });
  }

  // ── Timer formatting ─────────────────────────────────────────────────────
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function formatRemaining(ms) {
    if (ms < 0) ms = 0;
    var totalSec = Math.floor(ms / 1000);
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    if (h > 0) return h + ':' + pad2(m) + ':' + pad2(s);
    return pad2(m) + ':' + pad2(s);
  }

  // ── Op implementations ───────────────────────────────────────────────────
  // Synchronous ops return undefined; show/hide return a Promise to await.
  function runAction(action, ctx) {
    if (!action || typeof action !== 'object') return;
    var op = action.op;
    var merged = ctx.merged;

    // Single-action onlyIf guard: skip JUST this action when false.
    if (action.onlyIf && !guardPasses(action.onlyIf, merged)) return;

    switch (op) {
      case 'show': {
        var elS = resolveEl(action.target);
        if (!elS) { warn('[eeko] show: target not found', action.target); return; }
        applyShow(elS, action);
        return waitForVisual(elS, action.durationMs);
      }
      case 'hide': {
        var elH = resolveEl(action.target);
        if (!elH) { warn('[eeko] hide: target not found', action.target); return; }
        applyHide(elH, action);
        var msH = typeof action.durationMs === 'number' ? action.durationMs : DEFAULT_ANIM_MS;
        return waitForVisual(elH, msH).then(function () {
          elH.style.visibility = 'hidden';
        });
      }
      case 'add-class':
      case 'remove-class':
      case 'toggle-class': {
        var elC = resolveEl(action.target);
        if (!elC) { warn('[eeko] ' + op + ': target not found', action.target); return; }
        var cls = action['class'];
        if (typeof cls !== 'string' || !CLASS_RE.test(cls)) {
          warn('[eeko] ' + op + ': invalid class name', cls);
          return;
        }
        var names = cls.split(/\\s+/);
        for (var ci = 0; ci < names.length; ci++) {
          var nm = names[ci];
          if (!nm) continue;
          if (op === 'add-class') elC.classList.add(nm);
          else if (op === 'remove-class') elC.classList.remove(nm);
          else elC.classList.toggle(nm);
        }
        return;
      }
      case 'set-text': {
        var elT = resolveEl(action.target);
        if (!elT) { warn('[eeko] set-text: target not found', action.target); return; }
        var valT = resolveBinding(action.from, merged);
        elT.textContent = (valT === undefined || valT === null) ? '' : String(valT);
        return;
      }
      case 'set-attr': {
        var elA = resolveEl(action.target);
        if (!elA) { warn('[eeko] set-attr: target not found', action.target); return; }
        var attr = action.attr;
        if (!Object.prototype.hasOwnProperty.call(ATTR_ALLOW, attr)) {
          warn('[eeko] set-attr: attribute not allowed', attr);
          return;
        }
        var valA = resolveBinding(action.from, merged);
        if (valA === undefined || valA === null) return;
        var strA = String(valA);
        if (attr === 'src' && !isSafeSrc(strA)) {
          warn('[eeko] set-attr: unsafe src rejected', strA);
          return;
        }
        elA.setAttribute(attr, strA);
        return;
      }
      case 'set-style-numeric': {
        var elN = resolveEl(action.target);
        if (!elN) { warn('[eeko] set-style-numeric: target not found', action.target); return; }
        var num = toNumber(resolveBinding(action.from, merged));
        if (num === undefined) return;
        if (typeof action.multiplyBy === 'number') num = num * action.multiplyBy;
        if (typeof action.min === 'number' && num < action.min) num = action.min;
        if (typeof action.max === 'number' && num > action.max) num = action.max;
        applyNumericStyle(elN, action.prop, num, action.unit);
        return;
      }
      case 'set-style-ratio': {
        var elR = resolveEl(action.target);
        if (!elR) { warn('[eeko] set-style-ratio: target not found', action.target); return; }
        var numer = toNumber(resolveBinding(action.numerator, merged));
        var denom = toNumber(resolveBinding(action.denominator, merged));
        if (numer === undefined || denom === undefined || denom === 0) return;
        var ratio = numer / denom;
        var pct = ratio * 100;
        if (action.clamp !== false) {
          if (pct < 0) pct = 0;
          if (pct > 100) pct = 100;
        }
        applyNumericStyle(elR, action.prop, pct, action.unit || '%');
        return;
      }
      case 'clone-template': {
        var tpl = resolveEl(action.templateRef);
        var into = resolveEl(action.into);
        if (!tpl) { warn('[eeko] clone-template: templateRef not found', action.templateRef); return; }
        if (!into) { warn('[eeko] clone-template: into not found', action.into); return; }
        // <template> content lives on .content; otherwise clone the node itself.
        var sourceNode = (tpl.content && tpl.content.firstElementChild)
          ? tpl.content.firstElementChild
          : tpl;
        var clone = sourceNode.cloneNode(true);
        // Don't carry the template's own data-eeko-el onto the clone.
        if (clone.removeAttribute) clone.removeAttribute('data-eeko-el');
        applyBindingMap(clone, action.bindings, merged);
        if (action.prepend && into.firstChild) into.insertBefore(clone, into.firstChild);
        else into.appendChild(clone);
        return;
      }
      case 'trim-children': {
        var elTr = resolveEl(action.target);
        if (!elTr) { warn('[eeko] trim-children: target not found', action.target); return; }
        var max = typeof action.max === 'number' ? action.max : 0;
        if (max < 0) max = 0;
        var fromEnd = action.from === 'newest';
        while (elTr.children.length > max) {
          var victim = fromEnd ? elTr.lastElementChild : elTr.firstElementChild;
          if (!victim) break;
          elTr.removeChild(victim);
        }
        return;
      }
      case 'show-nth': {
        var cont = resolveEl(action.container);
        if (!cont) { warn('[eeko] show-nth: container not found', action.container); return; }
        var kids = cont.children;
        if (!kids.length) return;
        var idx = toNumber(resolveBinding(action.index, merged));
        if (idx === undefined) return;
        idx = Math.floor(idx);
        if (action.wrap) {
          idx = ((idx % kids.length) + kids.length) % kids.length;
        } else {
          if (idx < 0) idx = 0;
          if (idx > kids.length - 1) idx = kids.length - 1;
        }
        for (var ki = 0; ki < kids.length; ki++) {
          kids[ki].style.display = (ki === idx) ? '' : 'none';
        }
        return;
      }
      case 'start-timer': {
        startTimer(action);
        return;
      }
      case 'stop-timer': {
        stopTimer(action.timerId);
        return;
      }
      case 'increment-counter': {
        var idIc = action.counterId;
        var cur = Object.prototype.hasOwnProperty.call(counters, idIc) ? counters[idIc] : 0;
        var delta;
        if (action.from) {
          var fv = toNumber(resolveBinding(action.from, merged));
          delta = fv === undefined ? 0 : fv;
        } else {
          delta = typeof action.by === 'number' ? action.by : 1;
        }
        counters[idIc] = cur + delta;
        return;
      }
      case 'set-counter': {
        var sv = toNumber(resolveBinding(action.from, merged));
        counters[action.counterId] = sv === undefined ? 0 : sv;
        return;
      }
      case 'play-sound': {
        playSound(action, merged);
        return;
      }
      case 'wait': {
        var ms = action.ms;
        if (ms && typeof ms === 'object' && ms.fromBehavior) {
          var bw = behavior[ms.fromBehavior];
          ms = typeof bw === 'number' ? bw : 0;
        }
        if (typeof ms !== 'number' || ms < 0) ms = 0;
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
      }
      default:
        warn('[eeko] unknown op', op);
        return;
    }
  }

  function isSafeSrc(s) {
    return /^eeko-asset:\\/\\//.test(s) || /^https:\\/\\//.test(s);
  }

  function applyNumericStyle(el, prop, value, unit) {
    var u = unit === undefined || unit === null ? '' : unit;
    if (prop === 'opacity') {
      // opacity is unitless
      el.style.opacity = String(value);
      return;
    }
    if (prop === '--eeko-progress') {
      el.style.setProperty('--eeko-progress', String(value) + u);
      return;
    }
    // width / height
    el.style[prop] = String(value) + u;
  }

  function applyBindingMap(rootClone, bindings, merged) {
    if (!bindings || typeof bindings !== 'object') return;
    for (var elId in bindings) {
      if (!Object.prototype.hasOwnProperty.call(bindings, elId)) continue;
      var spec = bindings[elId];
      if (!spec || typeof spec !== 'object') continue;
      var target = null;
      try {
        // Match within the clone (the clone itself may be the target).
        if (rootClone.matches && rootClone.matches(selectorFor(elId))) target = rootClone;
        else if (rootClone.querySelector) target = rootClone.querySelector(selectorFor(elId));
      } catch (e) { target = null; }
      if (!target) { warn('[eeko] clone-template binding: el not found in clone', elId); continue; }
      var val = resolveBinding(spec.value, merged);
      var str = (val === undefined || val === null) ? '' : String(val);
      if (spec.set === 'text') {
        target.textContent = str;
      } else if (Object.prototype.hasOwnProperty.call(ATTR_ALLOW, spec.set)) {
        if (val === undefined || val === null) continue;
        if (spec.set === 'src' && !isSafeSrc(str)) {
          warn('[eeko] clone-template binding: unsafe src rejected', str);
          continue;
        }
        target.setAttribute(spec.set, str);
      } else {
        warn('[eeko] clone-template binding: disallowed set kind', spec.set);
      }
    }
  }

  // ── play-sound ───────────────────────────────────────────────────────────
  function playSound(action, merged) {
    var url;
    if (action.from) url = resolveBinding(action.from, merged);
    if (url === undefined || url === null || url === '') url = action.url;
    if (url === undefined || url === null || url === '') url = behavior.soundUrl;
    if (typeof url !== 'string' || url === '') return;
    if (!isSafeSrc(url)) { warn('[eeko] play-sound: unsafe url rejected', url); return; }
    var vol = typeof action.volume === 'number'
      ? action.volume
      : (typeof behavior.soundVolume === 'number' ? behavior.soundVolume : 1);
    if (vol < 0) vol = 0;
    if (vol > 1) vol = 1;
    try {
      var audio = new Audio(url);
      audio.volume = vol;
      var p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (e) { warn('[eeko] play-sound failed', e); }
  }

  // ── Timers ───────────────────────────────────────────────────────────────
  function startTimer(action) {
    var id = action.timerId;
    if (typeof id !== 'string' || id === '') return;
    stopTimer(id); // restart cleanly
    var intervalMs = typeof action.intervalMs === 'number' && action.intervalMs > 0 ? action.intervalMs : 1000;
    var durationMs = typeof action.durationMs === 'number' ? action.durationMs : undefined;
    var mode = action.mode === 'countdown' ? 'countdown' : 'interval';
    var started = Date.now();
    var rec = { startedAt: started, intervalMs: intervalMs, durationMs: durationMs, mode: mode, handle: null };

    function tick() {
      var elapsed = Date.now() - rec.startedAt;
      var remainingMs;
      if (mode === 'countdown' && typeof durationMs === 'number') {
        remainingMs = durationMs - elapsed;
        if (remainingMs <= 0) {
          remainingMs = 0;
          elapsed = durationMs;
        }
      } else {
        remainingMs = typeof durationMs === 'number' ? Math.max(0, durationMs - elapsed) : 0;
      }
      dispatch('timer_tick', {
        timerId: id,
        elapsedMs: elapsed,
        remainingMs: remainingMs,
        remaining: formatRemaining(remainingMs)
      });
      if (mode === 'countdown' && typeof durationMs === 'number' && elapsed >= durationMs) {
        stopTimer(id);
      }
    }

    rec.handle = setInterval(tick, intervalMs);
    timers[id] = rec;
  }

  function stopTimer(id) {
    if (typeof id !== 'string') return;
    var rec = timers[id];
    if (rec && rec.handle !== null && rec.handle !== undefined) {
      clearInterval(rec.handle);
    }
    delete timers[id];
  }

  function stopAllTimers() {
    for (var id in timers) {
      if (Object.prototype.hasOwnProperty.call(timers, id)) {
        var rec = timers[id];
        if (rec && rec.handle !== null && rec.handle !== undefined) clearInterval(rec.handle);
      }
    }
    timers = Object.create(null);
  }

  // ── Sequence runner with queue policy ────────────────────────────────────
  // Per event-key run-control. Each key has its own FIFO + active token.
  var runControl = Object.create(null); // event -> { running, queue:[], token }

  function controlFor(event) {
    if (!runControl[event]) runControl[event] = { running: false, queue: [], token: 0 };
    return runControl[event];
  }

  function queuePolicyFor(event) {
    var p;
    if (interactions.queue && typeof interactions.queue === 'object' &&
        Object.prototype.hasOwnProperty.call(interactions.queue, event)) {
      p = interactions.queue[event];
    }
    if (p === undefined && typeof behavior.queueBehavior === 'string') {
      p = behavior.queueBehavior;
    }
    if (p !== 'queue' && p !== 'replace' && p !== 'skip') p = 'queue';
    return p;
  }

  // Run a sequence. Executes SYNCHRONOUSLY until the first action that yields
  // a thenable (wait / show / hide), then continues asynchronously. So a fully
  // synchronous sequence (e.g. a timer_tick set-text, or an alert's text
  // binds) completes within the caller's tick — back-to-back synchronous
  // events both land before any later assertion / paint.
  //
  // \`token\` lets a 'replace' run cancel us: before each step we check the
  // control's current token still equals ours. \`onDone\` fires once the whole
  // sequence settles (sync or async), for queue draining.
  function runSequence(event, sequence, payload, token, onDone) {
    var ctrl = controlFor(event);
    var merged = buildMerged(payload);
    var ctx = { merged: merged };
    var i = 0;
    var settled = false;

    function finish() {
      if (settled) return;
      settled = true;
      if (onDone) onDone();
    }

    // Drive synchronously; on the first thenable, hand the tail to .then().
    while (true) {
      if (ctrl.token !== token) { finish(); return; } // superseded by 'replace'
      if (i >= sequence.length) { finish(); return; }
      var action = sequence[i++];
      var result;
      try {
        result = runAction(action, ctx);
      } catch (e) {
        warn('[eeko] action threw', action && action.op, e);
        result = undefined;
      }
      if (result && typeof result.then === 'function') {
        result.then(function asyncStep() {
          if (ctrl.token !== token) { finish(); return; }
          if (i >= sequence.length) { finish(); return; }
          var a = sequence[i++];
          var r;
          try {
            r = runAction(a, ctx);
          } catch (e2) {
            warn('[eeko] action threw', a && a.op, e2);
            r = undefined;
          }
          if (r && typeof r.then === 'function') {
            r.then(asyncStep, function () { finish(); });
          } else {
            asyncStep();
          }
        }, function () { finish(); });
        return; // remainder runs on microtasks
      }
      // synchronous action: loop to the next one
    }
  }

  function drainQueue(event) {
    var ctrl = controlFor(event);
    if (ctrl.running) return;
    var next = ctrl.queue.shift();
    if (!next) return;
    ctrl.running = true;
    var token = ctrl.token;
    runSequence(event, next.sequence, next.payload, token, function () {
      ctrl.running = false;
      drainQueue(event);
    });
  }

  // Entry point: dispatch a sequence for an event under its queue policy.
  function dispatch(event, payload) {
    if (disabledAll || disabledEvents[event]) return;
    var sequence = interactions.on[event];
    if (!Array.isArray(sequence) || sequence.length === 0) return;
    var ctrl = controlFor(event);
    var policy = queuePolicyFor(event);

    if (policy === 'skip') {
      if (ctrl.running || ctrl.queue.length > 0) return; // drop
      ctrl.queue.push({ sequence: sequence, payload: payload });
      drainQueue(event);
      return;
    }

    if (policy === 'replace') {
      // Cancel the in-flight run + clear pending, then start fresh now.
      ctrl.token++;
      ctrl.queue.length = 0;
      ctrl.running = true;
      var token = ctrl.token;
      runSequence(event, sequence, payload, token, function () {
        // Only the latest run owns the running flag; a stale finish is a no-op.
        if (ctrl.token === token) {
          ctrl.running = false;
          drainQueue(event);
        }
      });
      return;
    }

    // queue (default): serialize via FIFO.
    ctrl.queue.push({ sequence: sequence, payload: payload });
    drainQueue(event);
  }

  // ── Event hookup ─────────────────────────────────────────────────────────
  // Track variables on EVERY variable_updated (even if no sequence binds it),
  // so {fromVariable} reflects the latest value at run time.
  sdk.on('variable_updated', function (payload) {
    try {
      if (payload && payload.variable && typeof payload.variable.name === 'string') {
        variables[payload.variable.name] = payload.variable.value;
      }
    } catch (e) {}
  });

  // component_mount may fire from two sources we don't want to double-run:
  // the transport's eeko:init emit AND our own boot self-dispatch (below).
  // Run the mount sequence at most once.
  var mountDispatched = false;
  function dispatchMountOnce(payload) {
    if (mountDispatched) return;
    mountDispatched = true;
    dispatch('component_mount', payload);
  }

  // Register one interpreter handler per declared SDK event. timer_tick is
  // internal — dispatched directly from the timer callback, never via on().
  var hookedMount = false;
  for (var evt in interactions.on) {
    if (!Object.prototype.hasOwnProperty.call(interactions.on, evt)) continue;
    var seq = interactions.on[evt];
    if (!Array.isArray(seq) || seq.length === 0) continue;
    if (evt === 'timer_tick') continue; // internal, dispatched by timers
    if (evt === 'component_mount') { hookedMount = true; continue; } // special-cased below
    (function (eventName) {
      sdk.on(eventName, function (payload) { dispatch(eventName, payload); });
    })(evt);
  }

  // component_mount: dedupe across transport + self-dispatch.
  if (hookedMount) {
    sdk.on('component_mount', function (payload) { dispatchMountOnce(payload); });
  }

  // Lifecycle cleanup: clear all timers on unmount + pagehide so countdowns
  // and intervals never leak across a remount.
  sdk.on('component_unmount', function () { stopAllTimers(); });
  try {
    window.addEventListener('pagehide', function () { stopAllTimers(); });
  } catch (e) {}

  // The interpreter registers AFTER the bridge's synchronous __EEKO_INIT__ read
  // but typically BEFORE the transport's mount emit (postMessage eeko:init /
  // dev WS command:init), so the on('component_mount') above catches the real
  // mount. But a host that boots state synchronously (no transport mount, e.g.
  // a future inline host or a test driving _emit) would otherwise never start a
  // mount-bound timer — so if init state is already present, self-dispatch the
  // mount once now. The dedupe guard makes the later transport mount a no-op.
  if (hookedMount && init && typeof init === 'object') {
    dispatchMountOnce({ componentId: getState().componentId, type: 'widget' });
  }
})();
`
