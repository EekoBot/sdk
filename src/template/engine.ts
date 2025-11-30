/**
 * @eeko/sdk - TemplateEngine
 *
 * Secure variable substitution for widget templates.
 * Supports both {var} and {{var}} syntax with context-aware escaping.
 *
 * SECURITY: All values are escaped based on output context to prevent:
 * - XSS (HTML injection)
 * - CSS injection
 * - JavaScript injection
 *
 * @example
 * ```typescript
 * const engine = new TemplateEngine({
 *   goalTitle: 'Member Goal',
 *   goalTarget: 100,
 *   backgroundColor: '#1a1a2e'
 * })
 *
 * const html = engine.processHTML('<div>{goalTitle}</div>')
 * // Result: '<div>Member Goal</div>'
 *
 * const css = engine.processCSS('.container { background: {backgroundColor}; }')
 * // Result: '.container { background: #1a1a2e; }'
 *
 * const js = engine.processJS("var target = '{goalTarget}';")
 * // Result: "var target = '100';"
 * ```
 */

/**
 * TemplateEngine provides secure template variable substitution
 */
export class TemplateEngine {
  private config: Record<string, unknown>

  /**
   * Create a new TemplateEngine
   * @param config - Configuration object with variable values
   */
  constructor(config: Record<string, unknown> = {}) {
    this.config = config
  }

  /**
   * Update the configuration
   * @param config - New configuration object
   */
  setConfig(config: Record<string, unknown>): void {
    this.config = config
  }

  /**
   * Merge additional config into existing config
   * @param config - Configuration to merge
   */
  mergeConfig(config: Record<string, unknown>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get the current configuration
   */
  getConfig(): Record<string, unknown> {
    return { ...this.config }
  }

  // === Context-Aware Escaping ===

  /**
   * Escape string for HTML text content
   * Prevents XSS by escaping HTML special characters
   */
  private escapeHTML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
  }

  /**
   * Escape string for CSS values
   * Uses whitelist approach - only allows safe CSS value characters
   */
  private escapeCSS(str: string): string {
    // Allow: alphanumeric, #, (, ), ,, ., -, space, %
    // This covers: colors (#fff, rgb(), rgba()), numbers, units, etc.
    return str.replace(/[^a-zA-Z0-9#(),.\-\s%]/g, (char) => {
      return '\\' + char.charCodeAt(0).toString(16) + ' '
    })
  }

  /**
   * Escape string for JavaScript string literals
   * Prevents JS injection by escaping special characters
   */
  private escapeJS(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\u2028/g, '\\u2028') // Line separator
      .replace(/\u2029/g, '\\u2029') // Paragraph separator
      .replace(/<\//g, '<\\/') // Prevent </script> injection
  }

  // === Safe Property Access ===

  /**
   * Safely get a config value with prototype pollution protection
   * @param key - Config key to retrieve
   */
  private safeGet(key: string): unknown {
    // Protect against prototype pollution
    if (!Object.hasOwn(this.config, key)) {
      return undefined
    }
    return this.config[key]
  }

  // === Processing Methods ===

  /**
   * Process a template with a custom escape function
   * @param template - Template string with {var} or {{var}} placeholders
   * @param escapeFn - Function to escape values
   */
  private processWithEscape(
    template: string,
    escapeFn: (str: string) => string
  ): string {
    let result = template

    // Handle {{var}} syntax (double braces)
    result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = this.safeGet(key)
      if (value === undefined) return match
      return escapeFn(String(value))
    })

    // Handle {var} syntax (single braces)
    // Only match word characters to avoid matching CSS blocks like { display: flex }
    result = result.replace(/\{(\w+)\}/g, (match, key) => {
      const value = this.safeGet(key)
      if (value === undefined) return match
      return escapeFn(String(value))
    })

    return result
  }

  /**
   * Process HTML content with HTML escaping
   * @param html - HTML template string
   */
  processHTML(html: string): string {
    return this.processWithEscape(html, (str) => this.escapeHTML(str))
  }

  /**
   * Process CSS content with CSS escaping
   * @param css - CSS template string
   */
  processCSS(css: string): string {
    return this.processWithEscape(css, (str) => this.escapeCSS(str))
  }

  /**
   * Process JavaScript content with JS string escaping
   * @param js - JavaScript template string
   */
  processJS(js: string): string {
    return this.processWithEscape(js, (str) => this.escapeJS(str))
  }

  /**
   * Process template without escaping (for trusted content only)
   * WARNING: Only use with trusted template sources
   * @param template - Template string
   */
  processRaw(template: string): string {
    return this.processWithEscape(template, (str) => str)
  }
}
