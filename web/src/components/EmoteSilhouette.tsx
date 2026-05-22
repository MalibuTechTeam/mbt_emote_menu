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
// \b word boundaries so a keyword matches a WHOLE word, not a substring —
// otherwise 'dj' matches "a-dj-ust", 'hi' matches "t-hi-s", 'lay' matches
// "p-lay", etc. Order matters — first match wins.
const KEYWORD_MAP: [RegExp, SilhouetteType][] = [
  [/\b(phone|call|dial|cellphone|mobile)\b/i,            'phone'],
  [/\b(smoke|smoking|cigar|cigarette|joint|blunt)\b/i,   'smoking'],
  [/\b(drink|beer|wine|coffee|cup|bottle|sip|chug)\b/i,  'drinking'],
  [/\b(sit|bench|chair|stool|couch|throne|seated)\b/i,   'sitting'],
  [/\b(lay|lie|sleep|bed|ground|push.?up|plank)\b/i,     'lying'],
  [/\b(lean|wall|rail|fence|post)\b/i,                   'leaning'],
  [/\b(crouch|kneel|pray|beg|squat|meditate|yoga)\b/i,   'crouching'],
  [/\b(wave|hello|hi|bye|greet|salute|thumbs)\b/i,       'waving'],
  [/\b(cheer|celebrate|victory|fist|clap|applaud)\b/i,   'celebration'],
  [/\b(fight|fighting|punch|kick|box|boxing|slap|karate|martial)\b/i, 'fighting'],
  [/\b(ball|basket|soccer|football|golf|tennis|bat)\b/i, 'sports'],
  [/\b(guitar|drum|dj|music|piano|violin|flute)\b/i,     'music'],
  [/\b(point|direct|show|finger)\b/i,                    'waving'],
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

// ─── geometric pictogram set ─────────────────────────────────────────────────
// One shared vocabulary across all 20 figures, drawn in a 24×24 viewBox:
//   • HEAD   — <circle> radius 2.6 (cy≈4.6 for upright figures)
//   • LIMBS  — rounded capsules: 2.6-wide rects with rx 1.3, or rotated paths
// Only the POSE changes between figures. Designed to read crisply at ~22 px.

const silhouettes: Record<SilhouetteType, ReactNode> = {
  standing: (
    <>
      <circle cx={12} cy={4.6} r={2.6} />
      <rect x={10.7} y={7.6} width={2.6} height={7.4} rx={1.3} />
      <rect x={7.3} y={8.2} width={2.6} height={6.6} rx={1.3} />
      <rect x={14.1} y={8.2} width={2.6} height={6.6} rx={1.3} />
      <rect x={10} y={13.8} width={2.6} height={7.2} rx={1.3} />
      <rect x={11.4} y={13.8} width={2.6} height={7.2} rx={1.3} />
    </>
  ),
  sitting: (
    <>
      <circle cx={10} cy={4.6} r={2.6} />
      <rect x={8.7} y={7.6} width={2.6} height={7.6} rx={1.3} />
      <rect x={7.5} y={8.2} width={2.6} height={6.4} rx={1.3} />
      <rect x={8.7} y={12.6} width={9} height={2.6} rx={1.3} />
      <rect x={14.4} y={12.9} width={2.6} height={7.6} rx={1.3} />
    </>
  ),
  lying: (
    <>
      <circle cx={5.4} cy={14} r={2.6} />
      <rect x={8} y={12.7} width={9} height={2.6} rx={1.3} />
      <rect x={9} y={9.5} width={2.6} height={5} rx={1.3} transform="rotate(50 10.3 12)" />
      <rect x={15} y={12.7} width={2.6} height={6.6} rx={1.3} transform="rotate(-42 16.3 16)" />
      <rect x={15.4} y={12.7} width={2.6} height={6.6} rx={1.3} transform="rotate(42 16.7 16)" />
    </>
  ),
  dancing: (
    <>
      <circle cx={12.4} cy={4.6} r={2.6} />
      <rect x={11.1} y={7.4} width={2.6} height={7.2} rx={1.3} />
      <rect x={11} y={7.6} width={2.6} height={6.6} rx={1.3} transform="rotate(58 12.3 10.9)" />
      <rect x={9.8} y={5} width={2.6} height={6.6} rx={1.3} transform="rotate(-40 11.1 8.3)" />
      <rect x={9.4} y={13.4} width={2.6} height={7.2} rx={1.3} transform="rotate(28 10.7 17)" />
      <rect x={12.2} y={13.4} width={2.6} height={7.2} rx={1.3} transform="rotate(-30 13.5 17)" />
    </>
  ),
  waving: (
    <>
      <circle cx={11.4} cy={4.6} r={2.6} />
      <rect x={10.1} y={7.6} width={2.6} height={7.4} rx={1.3} />
      <rect x={6.7} y={8.2} width={2.6} height={6.6} rx={1.3} />
      <rect x={13.3} y={2.6} width={2.6} height={6.8} rx={1.3} transform="rotate(34 14.6 6)" />
      <rect x={9.4} y={13.8} width={2.6} height={7.2} rx={1.3} />
      <rect x={10.8} y={13.8} width={2.6} height={7.2} rx={1.3} />
    </>
  ),
  leaning: (
    <>
      <circle cx={14} cy={5} r={2.6} />
      <rect x={12.7} y={7.9} width={2.6} height={7} rx={1.3} transform="rotate(14 14 11.4)" />
      <rect x={15.4} y={8.6} width={2.6} height={6.4} rx={1.3} transform="rotate(14 16.7 11.8)" />
      <rect x={9.5} y={8.6} width={2.6} height={6.4} rx={1.3} transform="rotate(14 10.8 11.8)" />
      <rect x={12.2} y={14.2} width={2.6} height={6.8} rx={1.3} transform="rotate(14 13.5 17.6)" />
      <rect x={5.3} y={6} width={2.2} height={15.6} rx={1.1} />
    </>
  ),
  prop: (
    <>
      <circle cx={9.4} cy={5.2} r={2.6} />
      <rect x={8.1} y={8.1} width={2.6} height={7} rx={1.3} />
      <rect x={5.1} y={8.7} width={2.6} height={6} rx={1.3} />
      <rect x={11.1} y={8.7} width={2.6} height={6} rx={1.3} />
      <rect x={7.5} y={14} width={2.6} height={7} rx={1.3} />
      <rect x={8.9} y={14} width={2.6} height={7} rx={1.3} />
      <rect x={14.8} y={12.6} width={6.4} height={6.4} rx={1.4} />
    </>
  ),
  walking: (
    <>
      <circle cx={12} cy={4.6} r={2.6} />
      <rect x={10.7} y={7.5} width={2.6} height={7} rx={1.3} />
      <rect x={6.6} y={8} width={2.6} height={6.6} rx={1.3} transform="rotate(28 7.9 11.3)" />
      <rect x={14.8} y={8} width={2.6} height={6.6} rx={1.3} transform="rotate(-28 16.1 11.3)" />
      <rect x={6.5} y={13.4} width={2.6} height={7.4} rx={1.3} transform="rotate(28 7.8 17.1)" />
      <rect x={14.9} y={13.4} width={2.6} height={7.4} rx={1.3} transform="rotate(-28 16.2 17.1)" />
    </>
  ),
  expression: (
    <>
      <circle cx={12} cy={12} r={9.4} />
      <circle cx={9} cy={10.2} r={1.4} />
      <circle cx={15} cy={10.2} r={1.4} />
      <path d="M8.4 14.4a1.05 1.05 0 0 1 1.9-.9 1.9 1.9 0 0 0 3.4 0 1.05 1.05 0 0 1 1.9.9 4 4 0 0 1-7.2 0z" />
    </>
  ),
  crouching: (
    <>
      <circle cx={12} cy={7.4} r={2.6} />
      <rect x={10.7} y={10} width={2.6} height={5} rx={1.3} />
      <rect x={7.6} y={9.6} width={2.6} height={5} rx={1.3} transform="rotate(34 8.9 12.1)" />
      <rect x={13.8} y={9.6} width={2.6} height={5} rx={1.3} transform="rotate(-34 15.1 12.1)" />
      <rect x={7.6} y={13.6} width={2.6} height={5.4} rx={1.3} transform="rotate(46 8.9 16.3)" />
      <rect x={13.8} y={13.6} width={2.6} height={5.4} rx={1.3} transform="rotate(-46 15.1 16.3)" />
    </>
  ),
  shared: (
    <>
      <circle cx={7} cy={6.4} r={2.2} />
      <rect x={5.9} y={8.9} width={2.2} height={6} rx={1.1} />
      <rect x={3.5} y={9.3} width={2.2} height={5} rx={1.1} />
      <rect x={8.3} y={9.3} width={2.2} height={5} rx={1.1} />
      <rect x={5.3} y={14.2} width={2.2} height={6} rx={1.1} />
      <rect x={6.5} y={14.2} width={2.2} height={6} rx={1.1} />
      <circle cx={17} cy={6.4} r={2.2} />
      <rect x={15.9} y={8.9} width={2.2} height={6} rx={1.1} />
      <rect x={13.5} y={9.3} width={2.2} height={5} rx={1.1} />
      <rect x={18.3} y={9.3} width={2.2} height={5} rx={1.1} />
      <rect x={15.3} y={14.2} width={2.2} height={6} rx={1.1} />
      <rect x={16.5} y={14.2} width={2.2} height={6} rx={1.1} />
    </>
  ),
  animal: (
    <>
      <rect x={6} y={9.4} width={9.6} height={4.6} rx={2.3} />
      <circle cx={17.6} cy={9.4} r={3.2} />
      <path d="M15.2 5.6 16 8.4 14 8z" />
      <path d="M20 5.6 19.2 8.4 21.2 8z" />
      <rect x={6.6} y={13} width={2.2} height={6} rx={1.1} />
      <rect x={9.4} y={13} width={2.2} height={6} rx={1.1} />
      <rect x={12.4} y={13} width={2.2} height={6} rx={1.1} />
      <rect x={3.6} y={8} width={2.2} height={5.4} rx={1.1} transform="rotate(38 4.7 10.7)" />
    </>
  ),
  celebration: (
    <>
      <circle cx={12} cy={6.4} r={2.6} />
      <rect x={10.7} y={9.3} width={2.6} height={6.5} rx={1.3} />
      <rect x={9.9} y={4} width={2.6} height={7} rx={1.3} transform="rotate(-36 11.2 7.5)" />
      <rect x={11.5} y={4} width={2.6} height={7} rx={1.3} transform="rotate(36 12.8 7.5)" />
      <rect x={10} y={15} width={2.6} height={6.4} rx={1.3} />
      <rect x={11.4} y={15} width={2.6} height={6.4} rx={1.3} />
    </>
  ),
  emoji: (
    <>
      <circle cx={12} cy={12} r={9.4} />
      <circle cx={9} cy={9.8} r={1.5} />
      <circle cx={15} cy={9.8} r={1.5} />
      <path d="M5.9 12.6a1.3 1.3 0 0 1 2.5-.5 4 4 0 0 0 7.2 0 1.3 1.3 0 0 1 2.5.5 6.6 6.6 0 0 1-12.2 0z" />
    </>
  ),
  phone: (
    <>
      <circle cx={12} cy={4.6} r={2.6} />
      <rect x={10.7} y={7.6} width={2.6} height={7.4} rx={1.3} />
      <rect x={6.7} y={8.2} width={2.6} height={6.6} rx={1.3} />
      <rect x={14.4} y={4.2} width={2.6} height={6.4} rx={1.3} transform="rotate(42 15.7 7.4)" />
      <rect x={15.4} y={1.8} width={3.4} height={5.4} rx={1} transform="rotate(42 17.1 4.5)" />
      <rect x={10} y={13.8} width={2.6} height={7.2} rx={1.3} />
      <rect x={11.4} y={13.8} width={2.6} height={7.2} rx={1.3} />
    </>
  ),
  smoking: (
    <>
      <circle cx={11} cy={4.6} r={2.6} />
      <rect x={9.7} y={7.6} width={2.6} height={7.4} rx={1.3} />
      <rect x={6.3} y={8.2} width={2.6} height={6.6} rx={1.3} />
      <rect x={11.6} y={6} width={2.6} height={6.2} rx={1.3} transform="rotate(-58 12.9 9.1)" />
      <rect x={14.4} y={4.6} width={5} height={1.8} rx={0.9} />
      <rect x={9} y={13.8} width={2.6} height={7.2} rx={1.3} />
      <rect x={10.4} y={13.8} width={2.6} height={7.2} rx={1.3} />
    </>
  ),
  drinking: (
    <>
      <circle cx={11} cy={4.6} r={2.6} />
      <rect x={9.7} y={7.6} width={2.6} height={7.4} rx={1.3} />
      <rect x={6.3} y={8.2} width={2.6} height={6.6} rx={1.3} />
      <rect x={11.6} y={6} width={2.6} height={6} rx={1.3} transform="rotate(-52 12.9 9)" />
      <path d="M14 3.4h4.4l-0.8 4.2h-2.8z" />
      <rect x={9} y={13.8} width={2.6} height={7.2} rx={1.3} />
      <rect x={10.4} y={13.8} width={2.6} height={7.2} rx={1.3} />
    </>
  ),
  fighting: (
    <>
      <circle cx={10.4} cy={5} r={2.6} />
      <rect x={9.1} y={7.9} width={2.6} height={7} rx={1.3} />
      <rect x={11} y={9} width={8.2} height={2.6} rx={1.3} />
      <circle cx={19} cy={10.3} r={2} />
      <rect x={6} y={9.4} width={2.6} height={5.6} rx={1.3} transform="rotate(38 7.3 12.2)" />
      <rect x={6.3} y={14} width={2.6} height={7} rx={1.3} transform="rotate(30 7.6 17.5)" />
      <rect x={11.1} y={14} width={2.6} height={7} rx={1.3} transform="rotate(-26 12.4 17.5)" />
    </>
  ),
  sports: (
    <>
      <circle cx={11} cy={4.6} r={2.6} />
      <rect x={9.7} y={7.6} width={2.6} height={7.2} rx={1.3} />
      <rect x={6.3} y={8.2} width={2.6} height={6.6} rx={1.3} />
      <rect x={11.4} y={5.2} width={2.6} height={6.6} rx={1.3} transform="rotate(-44 12.7 8.5)" />
      <rect x={9} y={13.6} width={2.6} height={7.2} rx={1.3} transform="rotate(22 10.3 17.2)" />
      <rect x={11.4} y={13.6} width={2.6} height={7.2} rx={1.3} transform="rotate(-26 12.7 17.2)" />
      <circle cx={17.6} cy={4} r={2.6} />
    </>
  ),
  music: (
    <>
      <rect x={11.2} y={3} width={2.4} height={13.4} rx={1.2} />
      <path d="M13.6 3a1 1 0 0 1 1.2-1q3.6 0.9 5.4 3.7a1 1 0 0 1-1.7 1q-1.5-2.3-4.5-3a1 1 0 0 1-0.4-0.7z" />
      <circle cx={9.4} cy={16.4} r={3.6} />
    </>
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
  // Emoji reactions render their actual colour glyph instead of a geometric
  // figure — the glyph IS the emote's identity, a silhouette would be noise.
  if (emote.isEmoji && emote.emoji) {
    return (
      <span
        className={`mbt-silhouette mbt-silhouette--emoji ${className}`}
        style={{ fontSize: size * 0.92 }}
        aria-hidden="true"
      >
        {emote.emoji}
      </span>
    )
  }

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
