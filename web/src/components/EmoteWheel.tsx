import { memo, useState, useEffect, useCallback } from 'react'
import { useLocale } from '../utils/locale'
import type { Emote } from '../utils/types'

interface EmoteWheelProps {
  visible: boolean
  slots: Record<string, Emote>
  activeIndex: number
  maxSlots: number
}

export const EmoteWheel = memo(function EmoteWheel({
  visible, slots, activeIndex, maxSlots,
}: EmoteWheelProps) {
  const t = useLocale()
  const [removedSlot, setRemovedSlot] = useState<number | null>(null)

  // Listen for slot removal feedback from Lua
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
  const slotLabel = isRemoved
    ? (t.wheel_removed || 'Removed')
    : currentEmote
      ? currentEmote.label
      : (t.wheel_empty || 'Empty')

  const hintParts = [t.wheel_hint || 'Scroll to change · Release to play']
  if (currentEmote && !isRemoved) {
    hintParts.push(t.wheel_hint_remove || 'X to remove')
  }

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
        <div className={`mbt-wheel__slot ${isRemoved ? 'mbt-wheel__slot--removed' : ''}`}>
          <span className="mbt-wheel__num">{activeIndex}</span>
          <span className="mbt-wheel__label">{slotLabel}</span>
        </div>
        <span className="mbt-wheel__hint">{hintParts.join(' · ')}</span>
      </div>
    </div>
  )
})
