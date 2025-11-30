/**
 * @eeko/sdk - Template Module (Node.js)
 *
 * This entry point includes Node.js-specific utilities for file loading.
 * Use '@eeko/sdk/template' for browser-safe utilities only.
 *
 * @example
 * ```typescript
 * // Node.js usage (CLI, build tools)
 * import {
 *   TemplateEngine,
 *   loadFieldConfig,
 *   loadTemplateFiles,
 *   buildConfigFromFields
 * } from '@eeko/sdk/template/node'
 *
 * // Load field.json and template files
 * const fieldConfig = await loadFieldConfig('./my-template')
 * const files = await loadTemplateFiles('./my-template')
 *
 * // Build config from defaults
 * const config = buildConfigFromFields(fieldConfig.fields, 'global')
 *
 * // Process templates
 * const engine = new TemplateEngine(config)
 * const html = engine.processHTML(files.html)
 * const css = files.css ? engine.processCSS(files.css) : undefined
 * ```
 */

// Re-export everything from browser-safe module
export * from './index'

// Node.js-specific utilities
export {
  loadFieldConfig,
  buildConfigFromFields,
  mergeConfigs,
  loadTemplateFiles,
  getTemplateDir,
} from './loader'
