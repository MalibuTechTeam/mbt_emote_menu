import { useState } from 'react'
import { Keyboard, X } from 'lucide-react'
import { useLocale } from '../utils/locale'
import { useNui } from '../utils/useNui'
import type { Emote } from '../utils/types'

interface QuickBindBarProps {
  keybinds: Record<string, Emote>
  onPlay: (emote: Emote) => void
  onUpdate: (keybinds: Record<string, Emote>) => void
}

const SLOTS = ['1', '2', '3', '4', '5', '6']

export function QuickBindBar({ keybinds, onPlay, onUpdate }: QuickBindBarProps) {
  const t = useLocale()
  const [dragOver, setDragOver] = useState<string | null>(null)

  const handleDrop = async (slot: string, e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(null)

    const raw = e.dataTransfer.getData('application/json')
    if (!raw) return

    try {
      const emoteData = JSON.parse(raw)
      if (!emoteData || typeof emoteData.name !== 'string') {
        console.warn('[MBT QuickBind] Invalid drag data: missing emote name')
        return
      }
      await useNui('setKeybind', { slot, emote: emoteData })
      const updated = { ...keybinds, [slot]: emoteData }
      onUpdate(updated)
    } catch (err) {
      console.warn('[MBT QuickBind] Failed to parse drag data:', err)
    }
  }

  const handleClear = async (slot: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await useNui('setKeybind', { slot, emote: null })
    const updated = { ...keybinds }
    delete updated[slot]
    onUpdate(updated)
  }

  return (
    <div className="mbt-quickbind">
      <div className="mbt-quickbind__header">
        <Keyboard size={12} />
        <span>{t.quickbind_title || 'Quick Bind'}</span>
      </div>
      <div className="mbt-quickbind__slots">
        {SLOTS.map((slot) => {
          const emote = keybinds[slot]
          return (
            <div
              key={slot}
              data-slot={Number(slot) - 1}
              className={`mbt-quickbind__slot ${emote ? 'mbt-quickbind__slot--filled' : ''} ${dragOver === slot ? 'mbt-quickbind__slot--dragover' : ''}`}
              onClick={() => emote && onPlay(emote)}
              onDragOver={(e) => { e.preventDefault(); setDragOver(slot) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => handleDrop(slot, e)}
              title={emote ? emote.label : (t.quickbind_empty || 'Drag emote here')}
            >
              <span className="mbt-quickbind__key">NUM{slot}</span>
              {emote ? (
                <>
                  <span className="mbt-quickbind__name">{emote.label}</span>
                  <button
                    className="mbt-quickbind__clear"
                    onClick={(e) => handleClear(slot, e)}
                  >
                    <X size={10} />
                  </button>
                </>
              ) : (
                <span className="mbt-quickbind__empty">—</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}