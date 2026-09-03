import { useState, useEffect } from 'react'
import { KeyHint } from './Kbd'
import { MapPin, Move, RotateCw, ArrowUpDown, CornerDownLeft, X } from 'lucide-react'
import { useLocale } from '../utils/locale'

interface PlacementOverlayProps {
  visible: boolean
  layout?: 'default' | 'cinematic'
}

// Top-bar overlay shown while rpemotes-reborn placement is active.
// Mirrors the control hints rpemotes would otherwise draw via SimpleHelpText —
// suppressed on the rpemotes side via { suppressHelpText: true } so we can
// render them with our own branding instead.
//
// The layout prop drives a variant class so the background matches the active
// menu style (radial gradient for default, glass-card for cinematic).
export function PlacementOverlay({ visible, layout = 'default' }: PlacementOverlayProps) {
  const t = useLocale()
  const [render, setRender] = useState(visible)
  const [shown, setShown] = useState(false)

  // Pure transition in/out: mount at the hidden state, flip `shown` on the
  // next frame so the opacity/transform actually transitions (CEF won't
  // animate a value that was set in the same paint). On hide, drop `shown`
  // and unmount only after the transition has run.
  useEffect(() => {
    if (visible) {
      setRender(true)
      const id = requestAnimationFrame(() => setShown(true))
      return () => cancelAnimationFrame(id)
    } else if (render) {
      setShown(false)
      const id = setTimeout(() => setRender(false), 280)
      return () => clearTimeout(id)
    }
  }, [visible, render])

  if (!render) return null

  return (
    <div className={`mbt-placement layout-${layout}${shown ? ' mbt-placement--shown' : ''}`}>
      <div className="mbt-placement__title">
        <MapPin size={14} />
        <span>{t.placement_title || 'Place emote'}</span>
      </div>
      <div className="mbt-placement__keys">
        <KeyHint keys={['W', 'A', 'S', 'D']} label={t.placement_position || 'Position'} icon={<Move size={12} />} />
        <KeyHint keys={['Q', 'E']} label={t.placement_rotate || 'Rotate'} icon={<RotateCw size={12} />} />
        <KeyHint keys={['R', 'G']} label={t.placement_height || 'Height'} icon={<ArrowUpDown size={12} />} />
        <KeyHint keys={['Enter']} label={t.placement_confirm || 'Confirm'} icon={<CornerDownLeft size={12} />} />
        <KeyHint keys={['Backspace']} label={t.placement_cancel || 'Cancel'} icon={<X size={12} />} intent="off" />
      </div>
    </div>
  )
}


