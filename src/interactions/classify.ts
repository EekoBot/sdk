/**
 * @eeko/sdk — widget behaviour classification (seam-side helper).
 *
 * The one seed-independent signal: does this widget describe its behaviour
 * declaratively (a non-empty `interactions.on`)? The visual editor combines
 * this with a seed comparison it owns — the canonical seed lives in the
 * monorepo (`@live-alerts/git-utils`), not the SDK — to decide whether to
 * expose behaviour controls or degrade to style-only editing.
 */
import type { WidgetManifest } from '../template/manifest'
import type { WidgetInteractions } from './types'

/** True if the manifest declares at least one non-empty interaction sequence. */
export function hasInteractions(
  manifest: Pick<WidgetManifest, 'interactions'> | null | undefined
): boolean {
  const on = (manifest?.interactions as WidgetInteractions | undefined)?.on
  if (!on || typeof on !== 'object') return false
  for (const key of Object.keys(on)) {
    const seq = (on as Record<string, unknown>)[key]
    if (Array.isArray(seq) && seq.length > 0) return true
  }
  return false
}
