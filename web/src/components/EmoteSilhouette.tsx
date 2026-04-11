import { memo, type ReactNode } from 'react'
import type { Emote } from '../utils/types'

type SilhouetteType =
  | 'standing'
  | 'sitting'
  | 'lying'
  | 'dancing'
  | 'waving'
  | 'leaning'
  | 'prop'
  | 'walking'
  | 'expression'
  | 'crouching'
  | 'shared'
  | 'animal'
  | 'celebration'
  | 'emoji'
  | 'phone'
  | 'smoking'
  | 'drinking'
  | 'fighting'
  | 'sports'
  | 'music'

// ─── keyword → silhouette mapping ───────────────────────────────────────────
const KEYWORD_MAP: [RegExp, SilhouetteType][] = [
  // Specific actions first (order matters — first match wins)
  [/phone|call|dial|cellphone|mobile/i,         'phone'],
  [/smoke|smoking|cigar|cigarette|joint|blunt/i, 'smoking'],
  [/drink|beer|wine|coffee|cup|bottle|sip|chug/i,'drinking'],
  [/sit|bench|chair|stool|couch|throne|seated/i, 'sitting'],
  [/lay|lie|sleep|bed|ground|push.?up|plank/i,   'lying'],
  [/lean|wall|rail|fence|post/i,                 'leaning'],
  [/crouch|kneel|pray|beg|squat|meditate|yoga/i, 'crouching'],
  [/wave|hello|hi|bye|greet|salute|thumbs/i,     'waving'],
  [/cheer|celebrate|victory|fist|clap|applaud/i,  'celebration'],
  [/fight|punch|kick|box|slap|karate|martial/i,  'fighting'],
  [/ball|basket|soccer|football|golf|tennis|bat/i,'sports'],
  [/guitar|drum|dj|music|piano|violin|flute/i,   'music'],
  [/point|direct|show|finger/i,                  'waving'],
]

/**
 * Determine the best silhouette icon for an emote based on its category,
 * name, and properties. Falls back to a generic standing figure.
 */
export function getSilhouetteType(emote: Emote): SilhouetteType {
  const cat = emote.category

  // Category-level mapping (always takes priority)
  if (cat === 'Dances')       return 'dancing'
  if (cat === 'Walks')        return 'walking'
  if (cat === 'Expressions')  return 'expression'
  if (cat === 'AnimalEmotes') return 'animal'
  if (cat === 'Emojis')       return 'emoji'
  if (cat === 'Shared')       return 'shared'
  if (cat === 'PropEmotes')   return 'prop'

  // Keyword search in emote name (only for Emotes category)
  const name = emote.name + ' ' + (emote.label || '')
  for (const [regex, type] of KEYWORD_MAP) {
    if (regex.test(name)) return type
  }

  // Property-based fallback
  if (emote.hasProp) return 'prop'

  return 'standing'
}

// ─── SVG paths ──────────────────────────────────────────────────────────────
// Each silhouette is drawn in a 24×24 viewBox, designed to render crisply at
// 18–22 px with currentColor fill.

const silhouettes: Record<SilhouetteType, ReactNode> = {
  standing: (
    <path d="M12 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm-2 7h4a2 2 0 0 1 2 2v5h-2v6h-4v-6H8v-5a2 2 0 0 1 2-2z" />
  ),
  sitting: (
    <path d="M12 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm-2.5 7h5a1.5 1.5 0 0 1 1.5 1.5V14h3v2h-4v-2h-1v4h2v2H8v-2h2v-4H9v2H5v-2h3v-3.5A1.5 1.5 0 0 1 9.5 9z" />
  ),
  lying: (
    <path d="M3 14a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0zm6-2h10a1.5 1.5 0 0 1 0 3H9a1.5 1.5 0 0 1 0-3zm1 4h4v2h-4v-2z" />
  ),
  dancing: (
    <path d="M12 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm1 7.3 3.5-2.1 1 1.7L14 11.5v3l3.5 3-.8 1.2L13 15.5V20h-2v-4.5L7.3 18.7l-.8-1.2 3.5-3v-3L6.5 8.9l1-1.7L11 9.3V11h2V9.3z" />
  ),
  waving: (
    <path d="M12 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm4-1 1.4 1.4L15 4.8V7h-1V4.2l-1-.8V9h-2.5L10 11v5H8v-5.5l1.5-2.5H14V7a2 2 0 0 1 2-2V1zm-6 8h4v2l-1 1v4h2v2H8v-2h2v-4l-1-1V9h1z" />
  ),
  leaning: (
    <path d="M13 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM6 8h1v14H6V8zm5 1h4a1.5 1.5 0 0 1 1.5 1.5V14h-2v8h-4v-8h-2v-3.5A1.5 1.5 0 0 1 10 9h1z" />
  ),
  prop: (
    <path d="M12 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm5 5h2v2h-2V7zm-7 2h4a2 2 0 0 1 2 2v1h-1.5l.5 2v.5L17 12v1l-3 .5V16h-1v6h-2v-6h-1v-2.5L7 13v-1l2.5.5V12l.5-2H8.5v-1a2 2 0 0 1 2-2z" />
  ),
  walking: (
    <path d="M12 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm-1 7h3l2 4-1.8.9L13 11.5V14l2.5 4-.8 1-2.7-3.5V20h-2v-4.5L7.3 19l-.8-1L9 14v-2.5L7.8 13.9 6 13l2-4h3z" />
  ),
  expression: (
    <path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm-2.5 6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm5 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM8.5 14.5c.8 1.5 2 2.5 3.5 2.5s2.7-1 3.5-2.5" />
  ),
  crouching: (
    <path d="M12 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm-2 7h4a2 2 0 0 1 2 2v3h-2l1 4h-2l-1-4h-1l-1 4H8l1-4H7v-3a2 2 0 0 1 2-2h1z" />
  ),
  shared: (
    <path d="M7.5 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm9 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM5.5 8h4a1.5 1.5 0 0 1 1.5 1.5V13H9v7H6v-7H4V9.5A1.5 1.5 0 0 1 5.5 8zm9 0h4a1.5 1.5 0 0 1 1.5 1.5V13h-2v7h-3v-7h-2V9.5A1.5 1.5 0 0 1 14.5 8z" />
  ),
  animal: (
    <path d="M4.5 3 6 5.5V8l2 1.5V12l-1 2v4h2v-3l2-2 2 2v3h2v-4l-1-2V9.5L16 8V5.5L17.5 3 16 4l-1-1v3l-1.5 1.5h-3L9 6V3L8 4 6.5 3zM10 10a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm4 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
  ),
  celebration: (
    <path d="M12 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM7 3l1.5 1.5L7 6V3zm10 0v3l-1.5-1.5L17 3zm-7 6h4a2 2 0 0 1 2 2v3l-2-1v3h2v2H8v-2h2v-3l-2 1v-3a2 2 0 0 1 2-2zm-2-3L6 4 4.5 5.5 6.5 7 8 6zm8 0L17.5 7 19.5 5.5 18 4l-2 2z" />
  ),
  emoji: (
    <path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm-3 6h2v2H9V10zm4 0h2v2h-2v-2zm-4 5h6l-1 2.5h-4L9 15z" />
  ),
  phone: (
    <path d="M12 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm4 5.5h1.5v3H16v-3zM10 9h4a2 2 0 0 1 2 2v1h-2v2h-1v-2h-2v2h-1v-2H8v-1a2 2 0 0 1 2-2zm0 6h4v7h-4v-7z" />
  ),
  smoking: (
    <path d="M12 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm5 6h3v1.5h-3V8zM10 9h4a2 2 0 0 1 2 2v2h1v1h-3v-1h-1v1.5l1.5.5h3v1h-4l-1.5-.5V16h-1v6H9v-6H8v-5a2 2 0 0 1 2-2z" />
  ),
  drinking: (
    <path d="M12 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm4 4h2l-.5 3H16V6zM10 9h4a2 2 0 0 1 2 2v1h-1l1 1v1h-2v-1l-1-1h-2v1.5L12.5 14H15v1h-3l-1-1V12H9v-1a2 2 0 0 1 2-2h-1zm0 7h4v6h-4v-6z" />
  ),
  fighting: (
    <path d="M12 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm-2 7h4a2 2 0 0 1 2 2v2l2-2 1.5 1.5L16 16v-3h-1v3l2 4h-2l-2-4h-2v6h-2v-6l-2 4H5l2-4v-3H6v3l-3.5-3.5L4 8l2 2v-2a2 2 0 0 1 2-2h2z" />
  ),
  sports: (
    <path d="M12 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm6 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM10 9h4a2 2 0 0 1 2 2v3h-2v2l2 2v4h-2v-3l-2-2v6h-2v-6l-2 2v3H6v-4l2-2v-2H6v-3a2 2 0 0 1 2-2h2z" />
  ),
  music: (
    <path d="M12 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm6 5v8a2 2 0 1 1-2-2V9l2-2zM10 9h3v2l-1 1v4h2v2H8v-2h2v-4l-1-1v-2h1zm-1 5v8H7v-8h2z" />
  ),
}

interface EmoteSilhouetteProps {
  emote: Emote
  size?: number
  className?: string
}

export const EmoteSilhouette = memo(function EmoteSilhouette({
  emote,
  size = 20,
  className = '',
}: EmoteSilhouetteProps) {
  const type = getSilhouetteType(emote)

  return (
    <svg
      className={`mbt-silhouette ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      {silhouettes[type]}
    </svg>
  )
})
