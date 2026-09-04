import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Kbd } from './Kbd'
import { Eye } from 'lucide-react'
import { useLocale } from '../utils/locale'

interface WhatsThatBubbleProps {
  visible: boolean
  label: string
  hotKey: string
  /** World-projected 0–1 screen X (Lua's world-to-screen result). */
  x: number
  /** World-projected 0–1 screen Y. */
  y: number
  layout?: 'default' | 'cinematic'
}

// Matches CSS opacity transition.
const EXIT_MS = 200

/**
 * Floating bubble anchored above a nearby player's head. The world-to-screen
 * projection (x, y as 0..1 of viewport) is computed in Lua and pushed via
 * `whatsthatShow` / `whatsthatMove` NUI events.
 *
 * Position is delivered to CSS through two custom properties (--mbt-x,
 * --mbt-y) which the rule composes into a single `translate3d`. This keeps
 * the bubble on the compositor thread (no layout reflow per frame) and
 * lets the entry-on-mount `::before` ring pulse run without fighting the
 * tracking transform.
 *
 * Single-element component, no wrappers — same DOM shape as v1.3.0 to
 * avoid the interaction breakage we saw with anchor-wrapper restructuring.
 */
export function WhatsThatBubble({ visible, label, hotKey, x, y, layout = 'default' }: WhatsThatBubbleProps) {
  const t = useLocale()
  const [mounted, setMounted] = useState(visible)
  const [showing, setShowing] = useState(false)
  const exitTimer = useRef<number | null>(null)

  useEffect(() => {
    if (exitTimer.current) {
      window.clearTimeout(exitTimer.current)
      exitTimer.current = null
    }
    if (visible) {
      setMounted(true)
      const raf = window.requestAnimationFrame(() => setShowing(true))
      return () => window.cancelAnimationFrame(raf)
    }
    setShowing(false)
    exitTimer.current = window.setTimeout(() => {
      setMounted(false)
      exitTimer.current = null
    }, EXIT_MS)
    return undefined
  }, [visible])

  if (!mounted) return null

  const style: CSSProperties = {
    ['--mbt-x' as keyof CSSProperties]: x,
    ['--mbt-y' as keyof CSSProperties]: y,
  } as CSSProperties

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mbt-whatsthat layout-${layout}${showing ? ' mbt-whatsthat--on' : ''}`}
      style={style}
    >
      <Eye size={11} className="mbt-whatsthat__icon" aria-hidden="true" />
      <span className="mbt-whatsthat__label">{label}</span>
      <Kbd label={`Press ${hotKey} to try`}>{hotKey}</Kbd>
      <span className="mbt-whatsthat__try">{t.whatsthat_try || 'Try'}</span>
    </div>
  )
}
