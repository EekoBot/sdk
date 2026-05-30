/**
 * @eeko/sdk - Template Types
 *
 * Type definitions for template processing. The widget manifest schema
 * (field definitions, `widget.json` shape) lives in `./manifest`.
 */

/**
 * Template processing options
 */
export interface TemplateOptions {
  /** Whether to escape HTML entities (default: true) */
  escapeHTML?: boolean
  /** Whether to escape CSS values (default: true) */
  escapeCSS?: boolean
  /** Whether to escape JS strings (default: true) */
  escapeJS?: boolean
}
