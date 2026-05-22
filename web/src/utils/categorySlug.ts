/**
 * Category → CSS-safe slug (e.g. "PropEmotes" → "propemotes",
 * "Walk Styles" → "walk-styles"). The category is one of ~8 fixed
 * strings, so results are memoized — this runs per card/render across
 * a virtualized ~1800-item grid.
 */
const _cache = new Map<string, string>();

export function categorySlug(category: string): string {
  let s = _cache.get(category);
  if (s === undefined) {
    s = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    _cache.set(category, s);
  }
  return s;
}
