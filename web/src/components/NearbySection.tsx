import { Users, Handshake } from 'lucide-react'
import { useLocale } from '../utils/locale'
import type { Emote } from '../utils/types'

// Cap visible chips. The full set is one click away via the +N overflow chip.
// Six fits the menu width comfortably in 1–2 rows without crowding.
const MAX_VISIBLE = 6

interface NearbySectionProps {
  nearbyCount: number
  catalog: Emote[]
  /** User's per-emote play counts. The ribbon picks the top-played shared
   *  emotes so the chips feel personalised rather than alphabetic. */
  playCounts?: Record<string, number>
  onPlay: (emote: Emote, element?: HTMLElement) => void
  /** Optional escape hatch — clicking the overflow "+N" chip surfaces the
   *  full Shared category in the main grid. */
  onShowMore?: () => void
}

// Dedicated ribbon shown above the category pills whenever at least one
// other player is within proximity (driven by modules/nearby/client.lua).
// Surfaces the most-played shared/duet emotes so duos are one click away.
export function NearbySection({
  nearbyCount,
  catalog,
  playCounts,
  onPlay,
  onShowMore,
}: NearbySectionProps) {
  const t = useLocale()
  if (nearbyCount <= 0) return null

  const sharedEmotes = catalog.filter((e) => e.category === 'Shared' || e.isShared)
  if (sharedEmotes.length === 0) return null

  // Most-played first, then alphabetical tie-break so the order is stable
  // across renders (no surprise jumps if two emotes have the same count).
  const sorted = [...sharedEmotes].sort((a, b) => {
    const ac = playCounts?.[a.name] ?? 0
    const bc = playCounts?.[b.name] ?? 0
    if (ac !== bc) return bc - ac
    return a.label.localeCompare(b.label)
  })

  const visible = sorted.slice(0, MAX_VISIBLE)
  const overflow = sorted.length - visible.length

  return (
    <div className="mbt-nearby">
      <div className="mbt-nearby__header">
        <Users size={12} className="mbt-nearby__header-icon" />
        <span className="mbt-nearby__title">{t.nearby_title || 'Nearby'}</span>
        <span className="mbt-nearby__count">{nearbyCount}</span>
        <span className="mbt-nearby__hint">
          <Handshake size={11} />
          <span>{t.nearby_hint || 'try a duet'}</span>
        </span>
      </div>

      <div className="mbt-nearby__chips">
        {visible.map((emote, i) => (
          <button
            key={emote.name}
            type="button"
            className={`mbt-nearby__chip ${i === 0 ? 'mbt-nearby__chip--featured' : ''}`}
            style={{ ['--i' as keyof React.CSSProperties]: i } as React.CSSProperties}
            onClick={(e) => onPlay(emote, e.currentTarget)}
            title={emote.label}
          >
            {emote.label}
          </button>
        ))}

        {overflow > 0 && onShowMore && (
          <button
            type="button"
            className="mbt-nearby__more"
            style={{ ['--i' as keyof React.CSSProperties]: visible.length } as React.CSSProperties}
            onClick={onShowMore}
            title={(t.nearby_more || 'Show all shared emotes') + ` (+${overflow})`}
          >
            +{overflow}
          </button>
        )}
      </div>
    </div>
  )
}
