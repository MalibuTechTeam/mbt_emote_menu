import { memo, useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { EmoteSilhouette } from './EmoteSilhouette'
import { useLocale } from '../utils/locale'
import { categorySlug } from '../utils/categorySlug'
import type { Emote } from '../utils/types'

interface EmoteWheelProps {
  visible: boolean
  slots: Record<string, Emote>
  activeIndex: number
  maxSlots: number
  /** 'radial' = flick the mouse toward a slot · 'linear' = scroll list. */
  mode?: 'radial' | 'linear'
  /** Radial pointer position (-1..1 of the ring radius) + deadzone state. */
  pointer?: { x: number; y: number; active: boolean }
}

// Ring radius for the radial layout, in px.
const RADIUS = 98

export const EmoteWheel = memo(function EmoteWheel({
  visible, slots, activeIndex, maxSlots, mode = 'radial', pointer,
}: EmoteWheelProps) {
  const t = useLocale()
  const [removedSlot, setRemovedSlot] = useState<number | null>(null)

  // Listen for slot removal feedback from Lua. No origin check — FiveM CEF
  // builds vary in what they report for SendNUIMessage origin, and any
  // restriction risks dropping legitimate Lua messages. See App.tsx.
  const handleMessage = useCallback((e: MessageEvent) => {
    if (e.data?.action === 'wheelSlotRemoved') {
      setRemovedSlot(e.data.index)
      setTimeout(() => setRemovedSlot(null), 600)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [handleMessage])

  if (!visible) return null

  const currentEmote = slots[String(activeIndex)]
  const isRemoved = removedSlot === activeIndex
  const isEmpty = !isRemoved && !currentEmote

  // ─────────────────────────────────────────────────────────────────────────
  // RADIAL — slots arranged in a circle, picked by flicking the mouse.
  // ─────────────────────────────────────────────────────────────────────────
  if (mode === 'radial') {
    const hintParts = [t.wheel_hint_radial || 'Flick to pick · release to play']
    if (currentEmote && !isRemoved) {
      hintParts.push(t.wheel_hint_remove || 'X to remove')
    }

    return (
      <div className="mbt-wheel mbt-wheel--radial">
        <div className="mbt-wheel__ring">
          {Array.from({ length: maxSlots }, (_, i) => {
            const slotNum = i + 1
            const a = (i / maxSlots) * Math.PI * 2 // 0 = top, clockwise
            const x = Math.sin(a) * RADIUS
            const y = -Math.cos(a) * RADIUS
            const slotEmote = slots[String(slotNum)]
            const isActive = slotNum === activeIndex
            const justRemoved = removedSlot === slotNum
            const cat = slotEmote ? `mbt-card--cat-${categorySlug(slotEmote.category)}` : ''
            return (
              <span
                key={slotNum}
                className={
                  `mbt-wheel__node ${cat}` +
                  (isActive ? ' mbt-wheel__node--active' : '') +
                  (!slotEmote || justRemoved ? ' mbt-wheel__node--empty' : '')
                }
                style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
              >
                {slotEmote && !justRemoved
                  ? <EmoteSilhouette emote={slotEmote} size={20} />
                  : <Plus size={14} strokeWidth={2.5} />}
                <span className="mbt-wheel__node-num">{slotNum}</span>
              </span>
            )
          })}

          {/* Flick pointer — only while outside the centre deadzone. */}
          {pointer?.active && (
            <span
              className="mbt-wheel__pointer"
              style={{ transform: `translate(-50%, -50%) translate(${pointer.x * RADIUS}px, ${pointer.y * RADIUS}px)` }}
              aria-hidden="true"
            />
          )}

          {/* Centre hub — selected emote label + slot key. */}
          <div className="mbt-wheel__hub">
            <span className="mbt-wheel__disc" aria-hidden="true">
              {isEmpty || isRemoved
                ? <Plus size={18} strokeWidth={2.5} />
                : <EmoteSilhouette emote={currentEmote!} size={22} />}
            </span>
            {isEmpty ? (
              <span className="mbt-wheel__hub-label mbt-wheel__hub-label--empty">
                {t.wheel_empty_hint || t.wheel_empty || 'Empty slot'}
              </span>
            ) : (
              <span className="mbt-wheel__hub-label">
                {isRemoved ? (t.wheel_removed || 'Removed') : currentEmote!.label}
              </span>
            )}
          </div>
        </div>
        <span className="mbt-wheel__hint">{hintParts.join(' · ')}</span>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LINEAR — original row-of-dots peek indicator (scroll to cycle).
  // ─────────────────────────────────────────────────────────────────────────
  const hintParts = [t.wheel_hint || 'Scroll to change · Release to play']
  if (currentEmote && !isRemoved) {
    hintParts.push(t.wheel_hint_remove || 'X to remove')
  }

  const catClass = currentEmote
    ? `mbt-card--cat-${categorySlug(currentEmote.category)}`
    : ''

  return (
    <div className="mbt-wheel">
      <div className="mbt-wheel__indicator">
        <div className="mbt-wheel__dots">
          {Array.from({ length: maxSlots }, (_, i) => {
            const slot = i + 1
            return (
              <span
                key={slot}
                className={`mbt-wheel__dot ${slot === activeIndex ? 'mbt-wheel__dot--active' : ''} ${!slots[String(slot)] ? 'mbt-wheel__dot--empty' : ''}`}
              />
            )
          })}
        </div>
        <div
          className={`mbt-wheel__slot ${isRemoved ? 'mbt-wheel__slot--removed' : ''} ${isEmpty ? 'mbt-wheel__slot--empty' : ''}`}
        >
          <span
            className={`mbt-wheel__disc ${catClass}`}
            aria-hidden="true"
          >
            {isEmpty || isRemoved ? (
              <Plus size={18} strokeWidth={2.5} />
            ) : (
              <EmoteSilhouette emote={currentEmote!} size={20} />
            )}
          </span>
          <div className="mbt-wheel__body">
            {isEmpty ? (
              <span className="mbt-wheel__label mbt-wheel__label--empty">
                {t.wheel_empty_hint || t.wheel_empty || 'Empty slot'}
              </span>
            ) : (
              <span className="mbt-wheel__label">
                {isRemoved ? (t.wheel_removed || 'Removed') : currentEmote!.label}
              </span>
            )}
            <span className="mbt-wheel__slotrow">
              <span className="mbt-wheel__slotlabel">
                {t.wheel_slot_label || 'Slot'}
              </span>
              <kbd className="mbt-wheel__num">{activeIndex}</kbd>
            </span>
          </div>
        </div>
        <span className="mbt-wheel__hint">{hintParts.join(' · ')}</span>
      </div>
    </div>
  )
})
