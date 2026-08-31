import { useEffect, useRef, useState } from 'react'
import { Kbd } from './Kbd'
import { Users } from 'lucide-react'
import { useLocale } from '../utils/locale'

export type OpenJoinPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

interface OpenJoinPillProps {
  visible: boolean
  emoteLabel: string
  joinKey: string
  position: OpenJoinPosition
  layout?: 'default' | 'cinematic'
}

// Mirrors the leave-keyframe duration declared in index.css. The DOM node
// stays mounted this long after `visible` flips false so the leave keyframe
// can run before React unmounts (without it the pill would snap out).
const EXIT_MS = 150

/**
 * Small ambient pill shown to nearby players when someone in radius starts
 * a broadcast-eligible emote. Anonymous on purpose — never includes the
 * initiator's name.
 *
 * Animation lifecycle (CSS-driven; no motion library, no wrapping):
 *   • Mount with className that has NEITHER --on nor --leaving
 *     → baseline: hidden, scale 0.94, offset off-edge.
 *   • Next animation frame → add --on → enter keyframe runs (320ms slide
 *     + scale-up, plus a one-shot accent ring pulse 80ms after settle).
 *   • visible flips false → swap --on for --leaving → leave keyframe
 *     (150ms slight scale-down + fade).
 *   • EXIT_MS later → unmount.
 *
 * The component is a single <div> with no refs, no scroll handlers, and
 * `pointer-events: none` from CSS. Class toggles drive everything.
 */
export function OpenJoinPill({ visible, emoteLabel, joinKey, position, layout = 'default' }: OpenJoinPillProps) {
  const t = useLocale()
  const [mounted, setMounted] = useState(visible)
  const [stage, setStage] = useState<'arriving' | 'visible' | 'leaving'>(visible ? 'arriving' : 'leaving')
  const exitTimer = useRef<number | null>(null)

  useEffect(() => {
    if (exitTimer.current) {
      window.clearTimeout(exitTimer.current)
      exitTimer.current = null
    }
    if (visible) {
      setMounted(true)
      setStage('arriving')
      const raf = window.requestAnimationFrame(() => setStage('visible'))
      return () => window.cancelAnimationFrame(raf)
    }
    setStage('leaving')
    exitTimer.current = window.setTimeout(() => {
      setMounted(false)
      exitTimer.current = null
    }, EXIT_MS)
    return undefined
  }, [visible])

  if (!mounted) return null

  const stageClass =
    stage === 'visible' ? 'mbt-openjoin--on'
    : stage === 'leaving' ? 'mbt-openjoin--leaving'
    : ''

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mbt-openjoin layout-${layout} pos-${position} ${stageClass}`}
    >
      <Users size={13} className="mbt-openjoin__icon" aria-hidden="true" />
      <span className="mbt-openjoin__text">
        <b>{t.openjoin_label || 'Join'}</b>: {emoteLabel}
      </span>
      <Kbd label={`Press ${joinKey} to join`}>{joinKey}</Kbd>
    </div>
  )
}
