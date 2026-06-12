/**
 * @eeko/sdk — widget linter (`lintWidget`)
 *
 * Static, browser-safe checks over the four widget files. Catches the known
 * widget-breaking authoring mistakes BEFORE commit/serve:
 *
 * Errors (the widget will break or be rejected):
 *  - full-document HTML (`<!DOCTYPE>` / `<html>` / `<head>` / `<body>`) —
 *    widget-host inlines `index.html` into its own shell page; a full
 *    document nests html/body and breaks the shell.
 *  - `<link rel="stylesheet">` / `<script src>` — file routes 404; styles.css
 *    and script.js are inlined by the shell automatically.
 *  - `window.widget` / `.onShow(` / `.onHide(` in script.js — a hallucinated
 *    API that never existed; events arrive ONLY via `window.eekoSDK.on(...)`.
 *  - `eval(` / `new Function` — blocked by the iframe CSP.
 *  - interaction targets that don't exist as `data-eeko-el` ids in index.html
 *    — the action is a silent no-op at runtime.
 *  - `{tokens}` in HTML/CSS matching no manifest field key and no
 *    globalConfig/variantConfig key — the token stays a literal on screen.
 *
 * Warnings (probably wrong, occasionally intentional):
 *  - `innerHTML` in script.js — prefer `textContent` / interactions.
 *  - no `background: transparent` on `body` — opaque background covers the
 *    stream in OBS.
 *  - a global-scope field whose `defaultValue` isn't mirrored in
 *    `globalConfig` — Phase-1 substitution reads `globalConfig`.
 *  - `@keyframes eeko-*` in styles.css — the animation-preset keyframes live
 *    in the widget-host shell; redefining them desyncs preview and live.
 *
 * No DOM, no Node APIs — regex/string analysis only, so it runs identically
 * in `eeko build`, the docsite, and editor save paths. nexus-api remains the
 * authoritative validator on commit.
 */
import { validateManifest } from './manifest'
import type { WidgetManifest } from './manifest'
import { validateInteractions } from '../interactions/validate'
import { ANIMATION_PRESETS } from '../interactions/types'

export type LintFile = 'widget.json' | 'index.html' | 'styles.css' | 'script.js'

export interface LintIssue {
  file: LintFile
  rule: string
  message: string
}

export interface LintWidgetInput {
  manifest: unknown
  html: string
  css: string
  javascript: string
}

export interface LintWidgetResult {
  errors: LintIssue[]
  warnings: LintIssue[]
}

/**
 * Strip JS comments so guards check real code only (the canonical seed's
 * comments deliberately NAME `window.widget` / `.onShow` to warn authors off).
 * Same approach as the monorepo's widget-seed drift test.
 */
function stripJsComments(js: string): string {
  return js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

/** Strip CSS comments. */
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Strip HTML comments. */
function stripHtmlComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, '')
}

/** Every `data-eeko-el` id stamped in the markup. */
function elIdsInHtml(html: string): Set<string> {
  return new Set(
    [...html.matchAll(/data-eeko-el\s*=\s*["']([^"']+)["']/g)].map((m) => m[1])
  )
}

/**
 * Every element id an action references: `target` / `templateRef` / `into` /
 * `container`, plus each key of a `clone-template` bindings map.
 */
function referencedElIds(action: Record<string, unknown>): string[] {
  const ids: string[] = []
  for (const key of ['target', 'templateRef', 'into', 'container']) {
    const v = action[key]
    if (typeof v === 'string') ids.push(v)
  }
  if (action.op === 'clone-template' && action.bindings && typeof action.bindings === 'object') {
    for (const k of Object.keys(action.bindings as Record<string, unknown>)) ids.push(k)
  }
  return ids
}

/** `{token}` / `{{token}}` keys present in a template string. */
function tokensIn(source: string): Set<string> {
  return new Set([...source.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))
}

/**
 * Lint the four widget files together. Returns hard `errors` (the widget will
 * not work) and `warnings` (likely mistakes). An empty `errors` array does
 * not guarantee commit acceptance — nexus-api's validation is authoritative.
 */
export function lintWidget(input: LintWidgetInput): LintWidgetResult {
  const errors: LintIssue[] = []
  const warnings: LintIssue[] = []

  const html = stripHtmlComments(input.html ?? '')
  const css = stripCssComments(input.css ?? '')
  const js = stripJsComments(input.javascript ?? '')

  // ── widget.json ──────────────────────────────────────────────────────────
  let manifest: WidgetManifest | null = null
  const manifestResult = validateManifest(input.manifest)
  if (manifestResult.ok) {
    manifest = manifestResult.manifest
  } else {
    for (const message of manifestResult.errors) {
      errors.push({ file: 'widget.json', rule: 'manifest-invalid', message })
    }
  }

  if (manifest?.interactions !== undefined) {
    const ixResult = validateInteractions(manifest.interactions)
    if (!ixResult.ok) {
      for (const message of ixResult.errors) {
        errors.push({ file: 'widget.json', rule: 'interactions-invalid', message })
      }
    }
  }

  // ── index.html: body-only markup ─────────────────────────────────────────
  const fullDocPatterns: Array<[RegExp, string]> = [
    [/<!doctype/i, '<!DOCTYPE>'],
    [/<html[\s>]/i, '<html>'],
    [/<head[\s>]/i, '<head>'],
    [/<body[\s>]/i, '<body>'],
  ]
  for (const [re, label] of fullDocPatterns) {
    if (re.test(html)) {
      errors.push({
        file: 'index.html',
        rule: 'full-document-html',
        message: `index.html must be body-only markup — remove ${label}; widget-host wraps it in its own shell page`,
      })
    }
  }
  if (/<link[^>]*rel\s*=\s*["']?stylesheet/i.test(html)) {
    errors.push({
      file: 'index.html',
      rule: 'external-stylesheet',
      message:
        '<link rel="stylesheet"> 404s — styles.css is inlined into the shell automatically; remove the tag',
    })
  }
  if (/<script[^>]*\ssrc\s*=/i.test(html)) {
    errors.push({
      file: 'index.html',
      rule: 'external-script',
      message:
        '<script src> 404s — script.js is inlined into the shell automatically; remove the tag',
    })
  }

  // ── script.js: forbidden APIs ────────────────────────────────────────────
  if (/window\s*\.\s*widget\b/.test(js)) {
    errors.push({
      file: 'script.js',
      rule: 'window-widget',
      message:
        'window.widget does not exist — events arrive only through window.eekoSDK.on(eventType, handler)',
    })
  }
  if (/\.\s*onShow\s*\(/.test(js)) {
    errors.push({
      file: 'script.js',
      rule: 'on-show-hide',
      message:
        '.onShow( does not exist — subscribe with window.eekoSDK.on("component_trigger", handler)',
    })
  }
  if (/\.\s*onHide\s*\(/.test(js)) {
    errors.push({
      file: 'script.js',
      rule: 'on-show-hide',
      message:
        '.onHide( does not exist — subscribe with window.eekoSDK.on("component_dismiss", handler)',
    })
  }
  if (/\beval\s*\(/.test(js)) {
    errors.push({
      file: 'script.js',
      rule: 'no-eval',
      message: 'eval() is blocked by the iframe CSP',
    })
  }
  if (/\bnew\s+Function\b/.test(js)) {
    errors.push({
      file: 'script.js',
      rule: 'no-eval',
      message: 'new Function() is blocked by the iframe CSP',
    })
  }

  // ── interactions targets must exist in the markup ────────────────────────
  if (manifest?.interactions?.on && typeof manifest.interactions.on === 'object') {
    const present = elIdsInHtml(html)
    for (const [event, sequence] of Object.entries(manifest.interactions.on)) {
      if (!Array.isArray(sequence)) continue
      sequence.forEach((action, i) => {
        if (!action || typeof action !== 'object') return
        for (const id of referencedElIds(action as Record<string, unknown>)) {
          if (!present.has(id)) {
            errors.push({
              file: 'widget.json',
              rule: 'missing-interaction-target',
              message: `on.${event}[${i}] (${String((action as Record<string, unknown>).op)}) references "${id}" but index.html has no data-eeko-el="${id}" — the action is a silent no-op`,
            })
          }
        }
      })
    }
  }

  // ── {tokens} must resolve to a known config key ──────────────────────────
  if (manifest) {
    const knownKeys = new Set<string>([
      ...manifest.fields.map((f) => f.key),
      ...Object.keys(manifest.globalConfig),
      ...Object.keys(manifest.variantConfig),
    ])
    const tokenSources: Array<[LintFile, string]> = [
      ['index.html', html],
      ['styles.css', css],
    ]
    for (const [file, source] of tokenSources) {
      for (const token of tokensIn(source)) {
        if (!knownKeys.has(token)) {
          errors.push({
            file,
            rule: 'unknown-token',
            message: `{${token}} matches no field key and no globalConfig/variantConfig key — it stays a literal on screen. Declare the field (mirroring its default in globalConfig), or bind the value via interactions instead`,
          })
        }
      }
    }
  }

  // ── warnings ─────────────────────────────────────────────────────────────
  if (/\binnerHTML\b/.test(js)) {
    warnings.push({
      file: 'script.js',
      rule: 'inner-html',
      message:
        'innerHTML with event data risks markup injection — prefer textContent or interaction ops (set-text / clone-template)',
    })
  }

  if (!/body[^{}]*\{[^}]*background[^:;{}]*:\s*transparent/.test(css)) {
    warnings.push({
      file: 'styles.css',
      rule: 'transparent-body',
      message:
        'no `body { background: transparent }` found — an opaque body covers the stream in OBS',
    })
  }

  if (manifest) {
    for (const field of manifest.fields) {
      if (field.scope !== 'global' || field.defaultValue === undefined) continue
      if (!Object.prototype.hasOwnProperty.call(manifest.globalConfig, field.key)) {
        warnings.push({
          file: 'widget.json',
          rule: 'unmirrored-global-default',
          message: `global field "${field.key}" has a defaultValue but no globalConfig["${field.key}"] — mirror the default so Phase-1 substitution fills {${field.key}}`,
        })
      }
    }
  }

  for (const match of css.matchAll(/@keyframes\s+([A-Za-z0-9_-]+)/g)) {
    const name = match[1]
    if (name.startsWith('eeko-')) {
      warnings.push({
        file: 'styles.css',
        rule: 'preset-keyframes-redefined',
        message: `@keyframes ${name} redefines a host animation preset — the ${ANIMATION_PRESETS.filter((p) => p !== 'none').join('/')} keyframes ship in the widget-host shell; name the preset in the show/hide op instead`,
      })
    }
  }

  return { errors, warnings }
}
