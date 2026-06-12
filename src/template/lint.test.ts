import { describe, it, expect } from 'vitest'
import { lintWidget } from './lint'
import type { LintWidgetInput } from './lint'

/** The canonical seed JS (mirrors @live-alerts/git-utils widget-seed). */
const SEED_JS = `// Widget script — runs inside the sandboxed iframe.
// You receive events through window.eekoSDK. Fill in the handler bodies below;
// keep these window.eekoSDK.on(...) subscriptions — they are the only way in.
// Full surface: window.eekoSDK.on(type, handler), .off(type, handler),
// .getState(), .isReady(). There is no window.widget and no .onShow/.onHide.
;(function () {
  var sdk = window.eekoSDK
  if (!sdk) return

  sdk.on('component_trigger', function (data) {
    // TODO: render the alert from \`data\`.
  })

  sdk.on('component_dismiss', function () {
    // TODO: hide and clean up.
  })
})()
`

/** A valid, seed-style alert widget (starter-shaped). */
function validWidget(): LintWidgetInput {
  return {
    manifest: {
      name: 'Alert',
      componentType: 'alert',
      fields: [
        {
          key: 'backgroundColor',
          label: 'Background',
          type: 'color',
          scope: 'global',
          defaultValue: '#1e1e2e',
        },
        {
          key: 'accentColor',
          label: 'Accent colour',
          type: 'color',
          scope: 'global',
          defaultValue: '#a78bfa',
        },
      ],
      behavior: { displayDuration: 5000 },
      globalConfig: { backgroundColor: '#1e1e2e', accentColor: '#a78bfa' },
      variantConfig: {},
      interactions: {
        version: 1,
        on: {
          component_trigger: [
            { op: 'set-text', target: 'el-title', from: { from: 'displayName' } },
            { op: 'show', target: 'el-alert', animation: 'slide-up' },
            { op: 'wait', ms: { fromBehavior: 'displayDuration' } },
            { op: 'hide', target: 'el-alert', animation: 'fade' },
          ],
          component_dismiss: [{ op: 'hide', target: 'el-alert', animation: 'fade' }],
        },
        queue: { component_trigger: 'queue' },
      },
    },
    html: `<div data-eeko-el="el-alert" class="alert">
  <div data-eeko-el="el-title" class="alert__title"></div>
</div>
`,
    css: `* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  background: transparent;
}

.alert {
  visibility: hidden;
  background: {backgroundColor};
}

.alert__title {
  color: {accentColor};
}
`,
    javascript: SEED_JS,
  }
}

function rules(issues: Array<{ rule: string }>): string[] {
  return issues.map((i) => i.rule)
}

describe('lintWidget', () => {
  it('passes a valid seed-style widget clean', () => {
    const result = lintWidget(validWidget())
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
  })

  describe('errors', () => {
    it('flags an invalid manifest', () => {
      const input = validWidget()
      input.manifest = { componentType: 'alert' }
      const result = lintWidget(input)
      expect(rules(result.errors)).toContain('manifest-invalid')
    })

    it('flags an invalid interactions block', () => {
      const input = validWidget()
      ;(input.manifest as Record<string, unknown>).interactions = {
        version: 1,
        on: { component_trigger: [{ op: 'explode' }] },
      }
      const result = lintWidget(input)
      expect(rules(result.errors)).toContain('interactions-invalid')
    })

    it('flags full-document HTML (doctype/html/head/body)', () => {
      const input = validWidget()
      input.html = `<!DOCTYPE html>
<html><head><title>x</title></head><body><div data-eeko-el="el-alert"><div data-eeko-el="el-title"></div></div></body></html>`
      const result = lintWidget(input)
      const found = result.errors.filter((e) => e.rule === 'full-document-html')
      expect(found.length).toBe(4)
      expect(found[0].file).toBe('index.html')
    })

    it('flags <link rel="stylesheet"> and <script src>', () => {
      const input = validWidget()
      input.html += `<link rel="stylesheet" href="styles.css">\n<script src="script.js"></script>`
      const result = lintWidget(input)
      expect(rules(result.errors)).toContain('external-stylesheet')
      expect(rules(result.errors)).toContain('external-script')
    })

    it('flags window.widget and .onShow/.onHide in real code', () => {
      const input = validWidget()
      input.javascript = `;(function () {
  window.widget.onShow(function (data) { render(data) })
  window.widget.onHide(function () { teardown() })
})()`
      const result = lintWidget(input)
      expect(rules(result.errors)).toContain('window-widget')
      expect(rules(result.errors)).toContain('on-show-hide')
    })

    it('does NOT flag window.widget / .onShow mentioned only in comments', () => {
      // The canonical seed's comments deliberately warn about these names.
      const result = lintWidget(validWidget())
      expect(rules(result.errors)).not.toContain('window-widget')
      expect(rules(result.errors)).not.toContain('on-show-hide')
    })

    it('flags eval( and new Function', () => {
      const input = validWidget()
      input.javascript = `;(function () {
  eval('1 + 1')
  var f = new Function('return 2')
})()`
      const result = lintWidget(input)
      const found = result.errors.filter((e) => e.rule === 'no-eval')
      expect(found.length).toBe(2)
    })

    it('flags interaction targets missing from the markup, with op and id', () => {
      const input = validWidget()
      input.html = `<div data-eeko-el="el-alert"></div>` // el-title missing
      const result = lintWidget(input)
      const found = result.errors.find((e) => e.rule === 'missing-interaction-target')
      expect(found).toBeTruthy()
      expect(found?.message).toContain('el-title')
      expect(found?.file).toBe('widget.json')
    })

    it('flags clone-template binding keys missing from the markup', () => {
      const input = validWidget()
      ;(input.manifest as Record<string, unknown>).interactions = {
        version: 1,
        on: {
          chat_message: [
            {
              op: 'clone-template',
              templateRef: 'el-alert',
              into: 'el-title',
              bindings: { 'el-ghost': { set: 'text', value: { from: 'message.text' } } },
            },
          ],
        },
      }
      const result = lintWidget(input)
      const found = result.errors.find((e) => e.rule === 'missing-interaction-target')
      expect(found?.message).toContain('el-ghost')
    })

    it('flags {tokens} that match no field/globalConfig/variantConfig key', () => {
      const input = validWidget()
      input.html += `<div data-eeko-el="el-x">{mysteryToken}</div>`
      input.css += `.x { color: {ghostColor}; }`
      const result = lintWidget(input)
      const found = result.errors.filter((e) => e.rule === 'unknown-token')
      expect(found.length).toBe(2)
      expect(found.map((e) => e.file).sort()).toEqual(['index.html', 'styles.css'])
      expect(found.some((e) => e.message.includes('mysteryToken'))).toBe(true)
      expect(found.some((e) => e.message.includes('ghostColor'))).toBe(true)
    })

    it('accepts tokens declared only in variantConfig', () => {
      const input = validWidget()
      ;(input.manifest as Record<string, unknown>).variantConfig = { username: 'Someone' }
      input.html += `<div data-eeko-el="el-x">{username}</div>`
      const result = lintWidget(input)
      expect(rules(result.errors)).not.toContain('unknown-token')
    })
  })

  describe('warnings', () => {
    it('warns on innerHTML usage', () => {
      const input = validWidget()
      input.javascript = `;(function () {
  var sdk = window.eekoSDK
  if (!sdk) return
  sdk.on('component_trigger', function (data) {
    document.body.innerHTML = data.message
  })
})()`
      const result = lintWidget(input)
      expect(rules(result.warnings)).toContain('inner-html')
    })

    it('warns when body has no transparent background', () => {
      const input = validWidget()
      input.css = `.alert { visibility: hidden; background: {backgroundColor}; }
.alert__title { color: {accentColor}; }`
      const result = lintWidget(input)
      expect(rules(result.warnings)).toContain('transparent-body')
    })

    it('warns on a global field default not mirrored in globalConfig', () => {
      const input = validWidget()
      ;(input.manifest as Record<string, unknown>).globalConfig = { backgroundColor: '#1e1e2e' }
      const result = lintWidget(input)
      const found = result.warnings.find((w) => w.rule === 'unmirrored-global-default')
      expect(found).toBeTruthy()
      expect(found?.message).toContain('accentColor')
    })

    it('warns on @keyframes redefining a host preset', () => {
      const input = validWidget()
      input.css += `\n@keyframes eeko-fade-in { from { opacity: 0 } to { opacity: 1 } }`
      const result = lintWidget(input)
      const found = result.warnings.find((w) => w.rule === 'preset-keyframes-redefined')
      expect(found).toBeTruthy()
      expect(found?.file).toBe('styles.css')
    })

    it('does not warn on a widget-private @keyframes name', () => {
      const input = validWidget()
      input.css += `\n@keyframes my-wiggle { from { left: 0 } to { left: 4px } }`
      const result = lintWidget(input)
      expect(rules(result.warnings)).not.toContain('preset-keyframes-redefined')
    })
  })
})
