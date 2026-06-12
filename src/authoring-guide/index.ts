/**
 * @eeko/sdk/authoring-guide — the drift-proof widget authoring guide.
 *
 * - `AUTHORING_GUIDE` — the complete markdown document, assembled at module
 *   init from the SDK's own typed constants (events, ops, manifest field
 *   types, animation presets, queue policies, forbidden patterns).
 * - `AUTHORING_GUIDE_SECTIONS` — each section separately, keyed by stable id.
 * - `AUTHORING_GUIDE_VERSION` — equals the SDK `VERSION` it documents.
 * - The typed catalogs (`EVENT_CATALOG`, `OP_CATALOG`, `BINDING_KINDS`,
 *   `FORBIDDEN_PATTERNS`) for consumers that render their own docs.
 *
 * Consumers: `@eeko/cli` scaffolds the guide as AGENTS.md into widget
 * projects; the docsite renders it; the companion validators live in
 * `@eeko/sdk/interactions` (`validateInteractions`) and `@eeko/sdk/template`
 * (`validateManifest`, `lintWidget`).
 */
export {
  AUTHORING_GUIDE,
  AUTHORING_GUIDE_SECTIONS,
  AUTHORING_GUIDE_VERSION,
} from './guide'
export {
  EVENT_CATALOG,
  OP_CATALOG,
  BINDING_KINDS,
  FORBIDDEN_PATTERNS,
} from './catalog'
export type { EventDoc, OpDoc, BindingKindDoc, ForbiddenPattern } from './catalog'
