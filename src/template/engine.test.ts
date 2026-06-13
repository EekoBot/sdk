import { describe, it, expect } from 'vitest'
import { TemplateEngine } from './engine'

describe('TemplateEngine.processCSS', () => {
  it('preserves quotes in a quoted font-family value', () => {
    const engine = new TemplateEngine({ fontFamily: "'Courier New', monospace" })
    const out = engine.processCSS('body { font-family: {fontFamily}; }')
    // The quotes survive verbatim — they are required CSS string syntax and
    // were previously hex-escaped, which broke font resolution.
    expect(out).toBe("body { font-family: 'Courier New', monospace; }")
  })

  it('still substitutes colours and numeric values', () => {
    const engine = new TemplateEngine({ accent: '#b6ff00', size: '24' })
    expect(engine.processCSS('.x { color: {accent}; font-size: {size}px; }')).toBe(
      '.x { color: #b6ff00; font-size: 24px; }'
    )
  })

  it('keeps structural injection characters escaped even with quotes allowed', () => {
    // A value that tries to close the declaration and inject a new rule must
    // not be able to: `;` `{` `}` `:` `<` `>` `/` stay hex-escaped, so a
    // quoted value can never break out.
    const engine = new TemplateEngine({ evil: "'; } body { background: red } /*" })
    const out = engine.processCSS('.x { font-family: {evil}; }')
    expect(out).not.toContain('} body {')
    expect(out).not.toMatch(/;\s*}\s*body/)
    // quotes pass through, but ; { } : remain escaped
    expect(out).toContain("'")
    expect(out).toContain('\\3b ') // ';' hex-escaped
    expect(out).toContain('\\7b ') // '{' hex-escaped
    expect(out).toContain('\\7d ') // '}' hex-escaped
  })
})
