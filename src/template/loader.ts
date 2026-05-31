/**
 * @eeko/sdk - Template Loader (Node.js only)
 *
 * File loading utilities for a widget project's canonical files
 * (`widget.json`, `index.html`, `styles.css`, `script.js`). Uses Node.js APIs
 * and should only be imported in Node.js environments.
 *
 * SECURITY: Includes path traversal protection to prevent directory escape attacks.
 */

import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { validateManifest, type ManifestField, type WidgetManifest } from './manifest'

/**
 * Validate that a resolved path is within the allowed base directory
 * @param basePath - The base directory that paths must stay within
 * @param targetPath - The path to validate
 * @throws Error if path traversal is detected
 */
function validatePathWithinBase(basePath: string, targetPath: string): void {
  const resolvedBase = resolve(basePath)
  const resolvedTarget = resolve(targetPath)

  if (!resolvedTarget.startsWith(resolvedBase + '/') && resolvedTarget !== resolvedBase) {
    throw new Error('Path traversal attempt detected: path escapes base directory')
  }
}

/**
 * Load and validate `widget.json` from a widget project directory.
 *
 * @param templateDir - Absolute path to the widget directory
 * @returns The validated {@link WidgetManifest}
 * @throws Error if the file is missing, invalid JSON, fails validation, or path traversal is detected
 *
 * @example
 * ```typescript
 * const manifest = await loadManifest('/path/to/widget')
 * console.log(manifest.globalConfig) // { goalTitle: 'My Goal', ... }
 * ```
 */
export async function loadManifest(templateDir: string): Promise<WidgetManifest> {
  const resolvedDir = resolve(templateDir)
  const manifestPath = resolve(resolvedDir, 'widget.json')

  // Ensure widget.json is within the widget directory
  validatePathWithinBase(resolvedDir, manifestPath)

  let parsed: unknown
  try {
    const content = await readFile(manifestPath, 'utf-8')
    parsed = JSON.parse(content)
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in widget.json: ${error.message}`)
    }
    throw error
  }

  const result = validateManifest(parsed)
  if (!result.ok) {
    throw new Error(`Invalid widget.json:\n  - ${result.errors.join('\n  - ')}`)
  }
  return result.manifest
}

/**
 * Build a configuration object from manifest fields using their default values,
 * keyed by each field's `key`.
 *
 * `both`-scoped fields participate in both the `global` and `variant` scopes.
 *
 * @param fields - Array of manifest field definitions
 * @param scope - Optional scope filter ('global' or 'variant')
 * @returns Configuration object keyed by field `key` with default values
 *
 * @example
 * ```typescript
 * const fields = [
 *   { key: 'goalTitle', type: 'text', scope: 'global', label: 'Title', defaultValue: 'My Goal' },
 *   { key: 'progress', type: 'number', scope: 'variant', label: 'Progress', defaultValue: 0 }
 * ]
 *
 * buildConfigFromFields(fields)          // { goalTitle: 'My Goal', progress: 0 }
 * buildConfigFromFields(fields, 'global') // { goalTitle: 'My Goal' }
 * ```
 */
export function buildConfigFromFields(
  fields: ManifestField[],
  scope?: 'global' | 'variant'
): Record<string, unknown> {
  const config: Record<string, unknown> = {}

  for (const field of fields) {
    // Apply the scope filter; `both` participates in either scope.
    if (scope && field.scope !== scope && field.scope !== 'both') {
      continue
    }

    // Only include fields that have a default value defined
    if (field.defaultValue !== undefined) {
      config[field.key] = field.defaultValue
    }
  }

  return config
}

/**
 * Merge multiple configuration objects with later objects taking precedence
 *
 * @param configs - Configuration objects to merge (in order of precedence)
 * @returns Merged configuration object
 */
export function mergeConfigs(
  ...configs: Record<string, unknown>[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const config of configs) {
    if (config && typeof config === 'object') {
      for (const key of Object.keys(config)) {
        // Use Object.hasOwn for prototype pollution protection
        if (Object.hasOwn(config, key)) {
          result[key] = config[key]
        }
      }
    }
  }

  return result
}

/**
 * Load the canonical template files (`index.html`, `styles.css`, `script.js`)
 * from a widget project directory.
 *
 * @param templateDir - Absolute path to the widget directory
 * @returns Object containing file contents (html required; css/js optional)
 *
 * @example
 * ```typescript
 * const files = await loadTemplateFiles('/path/to/widget')
 * console.log(files.html) // Contents of index.html
 * console.log(files.css)  // Contents of styles.css (or undefined if not found)
 * ```
 */
export async function loadTemplateFiles(templateDir: string): Promise<{
  html: string
  css?: string
  js?: string
}> {
  const resolvedDir = resolve(templateDir)

  // Define expected file paths (canonical layout)
  const htmlPath = resolve(resolvedDir, 'index.html')
  const cssPath = resolve(resolvedDir, 'styles.css')
  const jsPath = resolve(resolvedDir, 'script.js')

  // Validate all paths are within the widget directory
  validatePathWithinBase(resolvedDir, htmlPath)
  validatePathWithinBase(resolvedDir, cssPath)
  validatePathWithinBase(resolvedDir, jsPath)

  // HTML is required
  const html = await readFile(htmlPath, 'utf-8')

  // CSS and JS are optional
  let css: string | undefined
  let js: string | undefined

  try {
    css = await readFile(cssPath, 'utf-8')
  } catch {
    // CSS file is optional
  }

  try {
    js = await readFile(jsPath, 'utf-8')
  } catch {
    // JS file is optional
  }

  return { html, css, js }
}

/**
 * Get the parent directory of a file path
 * Useful for getting the widget directory from a file path
 *
 * @param filePath - Path to a file
 * @returns Parent directory path
 */
export function getTemplateDir(filePath: string): string {
  return dirname(resolve(filePath))
}
