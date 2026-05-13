import { Eye } from 'lucide-react'
import { useLocale } from '../utils/locale'

interface WhatsThatBubbleProps {
  visible: boolean
  label: string
  hotKey: string
  /** World-projected 0–1 screen X. */
  x: number
  /** World-projected 0–1 screen Y. */
  y: number
  layout?: 'default' | 'cinematic'
}

// Floating bubble anchored above a nearby player's head. The position
// (x, y) is the world-to-screen projection computed in Lua and pushed via
// `whatsthatShow` / `whatsthatMove` NUI events. Pointer-events disabled —
// the bubble is purely informational; the actual "try this emote" action
// is triggered with the configured key (default G).
export function WhatsThatBubble({ visible, label, hotKey, x, y, layout = 'default' }: WhatsThatBubbleProps) {
  const t = useLocale()
  if (!visible) return null
  return (
    <div
      className={`mbt-whatsthat layout-${layout} mbt-whatsthat--on`}
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
    >
      <Eye size={11} className="mbt-whatsthat__icon" />
      <span className="mbt-whatsthat__label">{label}</span>
      <kbd className="mbt-whatsthat__key">{hotKey}</kbd>
      <span className="mbt-whatsthat__try">{t.whatsthat_try || 'Try'}</span>
    </div>
  )
}
