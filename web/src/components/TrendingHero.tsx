import { memo } from 'react'
import { Flame, Play } from 'lucide-react'
import { EmoteSilhouette } from './EmoteSilhouette'
import { useLocale, tFormat } from '../utils/locale'
import type { Emote } from '../utils/types'

// Category → RGB triplet. Mirrors EmoteMenu's pillCatVar / CATEGORY_COLOR_VAR
// so the hero disc tints exactly like the rail pills and card discs. Triplets
// (not hex/var) so the CSS can feed them to CEF-safe rgb()/rgba() — FiveM's
// CEF lacks color-mix().
const CATEGORY_COLOR_VAR: Record<string, string> = {
  emotes: '34, 211, 238',
  propemotes: '245, 190, 74',
  props: '245, 190, 74',
  dances: '236, 72, 153',
  shared: '251, 113, 88',
  expressions: '168, 139, 250',
  walks: '94, 234, 212',
  'walk-styles': '94, 234, 212',
  animalemotes: '251, 146, 60',
  animals: '251, 146, 60',
  emojis: '250, 224, 72',
}

function catVar(type: string): string {
  const slug = type.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return CATEGORY_COLOR_VAR[slug] || '154, 160, 166'
}

export interface TrendingEmote {
  name: string
  label: string
  category: string
  plays: number
}

interface TrendingHeroProps {
  trending: TrendingEmote
  onPlay: (emote: Emote) => void
}

/**
 * "Trending this week" hero card — the one earned colour moment on the
 * clean browse view. Sits ABOVE the virtualized grid (never inside it:
 * useVirtualGrid assumes a uniform rowHeight). Server-wide data: the
 * trending pipeline feeds {name,label,category,plays}.
 */
export const TrendingHero = memo(function TrendingHero({ trending, onPlay }: TrendingHeroProps) {
  const t = useLocale()

  // Synthesize an Emote so EmoteSilhouette can pick its glyph and the play
  // path stays uniform with the rest of the menu.
  const emote: Emote = {
    name: trending.name,
    label: trending.label,
    category: trending.category,
  }

  return (
    <div
      className="mbt-hero"
      style={{ '--mbt-hero-cat': catVar(trending.category) } as React.CSSProperties}
    >
      <span className="mbt-hero__disc">
        <EmoteSilhouette emote={emote} size={27} />
      </span>
      <div className="mbt-hero__body">
        <span className="mbt-hero__kicker">
          <Flame size={11} />
          {t.trending_kicker || 'Trending this week'}
        </span>
        <span className="mbt-hero__name">{trending.label}</span>
        <span className="mbt-hero__sub">
          {tFormat(
            t.trending_sub || '%s · %s plays this week',
            trending.category,
            String(trending.plays),
          )}
        </span>
      </div>
      <button className="mbt-hero__play" onClick={() => onPlay(emote)}>
        <Play size={13} />
        {t.btn_play || 'Play'}
      </button>
    </div>
  )
})
