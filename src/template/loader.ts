/**
 * @eeko/sdk - Template Loader (Node.js only)
 *
 * File loading utilities for field.json configuration.
 * This module uses Node.js APIs and should only be imported in Node.js environments.
 *
 * SECURITY: Includes path traversal protection to prevent directory escape attacks.
 */

import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import type { FieldConfig, FieldDefinition } from './types'

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
 * Load and parse field.json from a template directory
 *
 * @param templateDir - Absolute path to the template directory
 * @returns Parsed FieldConfig object
 * @throws Error if file not found, invalid JSON, or path traversal detected
 *
 * @example
 * ```typescript
 * const config = await loadFieldConfig('/path/to/template')
 * console.log(config.globalConfig) // { goalTitle: 'My Goal', ... }
 * ```
 */
export async function loadFieldConfig(templateDir: string): Promise<FieldConfig> {
  const resolvedDir = resolve(templateDir)
  const fieldJsonPath = resolve(resolvedDir, 'field.json')

  // Ensure field.json is within the template directory
  validatePathWithinBase(resolvedDir, fieldJsonPath)

  try {
    const content = await readFile(fieldJsonPath, 'utf-8')
    const parsed = JSON.parse(content) as FieldConfig

    // Validate required structure
    if (!parsed.fields || !Array.isArray(parsed.fields)) {
      throw new Error('Invalid field.json: missing or invalid "fields" array')
    }

    // Ensure globalConfig and variantConfig exist
    if (!parsed.globalConfig || typeof parsed.globalConfig !== 'object') {
      parsed.globalConfig = {}
    }

    if (!parsed.variantConfig || typeof parsed.variantConfig !== 'object') {
      parsed.variantConfig = {}
    }

    return parsed
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in field.json: ${error.message}`)
    }
    throw error
  }
}

/**
 * Build a configuration object from field definitions using their default values
 *
 * @param fields - Array of field definitions
 * @param scope - Optional scope filter ('global' or 'variant')
 * @returns Configuration object with field IDs as keys and default values
 *
 * @example
 * ```typescript
 * const fields = [
 *   { id: 'goalTitle', type: 'text', scope: 'global', label: 'Title', defaultValue: 'My Goal' },
 *   { id: 'progress', type: 'number', scope: 'variant', label: 'Progress', defaultValue: 0 }
 * ]
 *
 * buildConfigFromFields(fields)
 * // Returns: { goalTitle: 'My Goal', progress: 0 }
 *
 * buildConfigFromFields(fields, 'global')
 * // Returns: { goalTitle: 'My Goal' }
 * ```
 */
export function buildConfigFromFields(
  fields: FieldDefinition[],
  scope?: 'global' | 'variant'
): Record<string, unknown> {
  const config: Record<string, unknown> = {}

  for (const field of fields) {
    // Skip if scope filter is set and doesn't match
    if (scope && field.scope !== scope) {
      continue
    }

    // Only include fields that have a default value defined
    if (field.defaultValue !== undefined) {
      config[field.id] = field.defaultValue
    }
  }

  return config
}

/**
 * Merge multiple configuration objects with later objects taking precedence
 *
 * @param configs - Configuration objects to merge (in order of precedence)
 * @returns Merged configuration object
 *
 * @example
 * ```typescript
 * const defaults = { title: 'Default', color: '#fff' }
 * const user = { title: 'Custom' }
 *
 * mergeConfigs(defaults, user)
 * // Returns: { title: 'Custom', color: '#fff' }
 * ```
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
 * Load template files (HTML, CSS, JS) from a template directory
 *
 * @param templateDir - Absolute path to the template directory
 * @returns Object containing file contents
 *
 * @example
 * ```typescript
 * const files = await loadTemplateFiles('/path/to/template')
 * console.log(files.html) // Contents of index.html
 * console.log(files.css)  // Contents of style.css (or undefined if not found)
 * ```
 */
export async function loadTemplateFiles(templateDir: string): Promise<{
  html: string
  css?: string
  js?: string
}> {
  const resolvedDir = resolve(templateDir)

  // Define expected file paths
  const htmlPath = resolve(resolvedDir, 'index.html')
  const cssPath = resolve(resolvedDir, 'style.css')
  const jsPath = resolve(resolvedDir, 'script.js')

  // Validate all paths are within the template directory
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
 * Useful for getting the template directory from a file path
 *
 * @param filePath - Path to a file
 * @returns Parent directory path
 */
export function getTemplateDir(filePath: string): string {
  return dirname(resolve(filePath))
}
