import { useRef } from 'react'
import { useDrop } from 'react-dnd'
import { Keyboard, X } from 'lucide-react'
import { useLocale } from '../utils/locale'
import { useNui } from '../utils/useNui'
import { DND_EMOTE_CARD, type EmoteCardDragItem } from './FavoriteDraggable'
import { PersonaBar, type PersonaItem } from './PersonaBar'
import type { Emote } from '../utils/types'

interface QuickBindBarProps {
  keybinds: Record<string, Emote>
  onPlay: (emote: Emote) => void
  onUpdate: (keybinds: Record<string, Emote>) => void
  /** Persona switcher, rendered as the loadout row inside this block. Undefined
   *  when the Personas feature is off. */
  personas?: PersonaItem[]
  activePersonaId?: string
  onSwitchPersona?: (id: string) => void
  onCreatePersona?: (name: string) => void
  onRenamePersona?: (id: string, name: string) => void
  onDeletePersona?: (id: string) => void
}

const SLOTS = ['1', '2', '3', '4', '5', '6']

interface QuickBindSlotProps {
  slot: string
  emote: Emote | undefined
  emptyLabel: string
  onAssign: (slot: string, emote: Emote) => void
  onPlay: (emote: Emote) => void
  onClear: (slot: string) => void
}

/**
 * One quick-bind slot. Uses react-dnd useDrop with the same EMOTE_CARD type
 * the favorites cards source, so dragging a favorite onto a slot here lands
 * the bind via the same backend (TouchBackend / pointer events) ox_inventory
 * relies on. CEF's HTML5 native onDrop is not used.
 */
function QuickBindSlot({ slot, emote, emptyLabel, onAssign, onPlay, onClear }: QuickBindSlotProps) {
  const ref = useRef<HTMLDivElement>(null)

  const [{ isOver }, drop] = useDrop<EmoteCardDragItem, void, { isOver: boolean }>(
    () => ({
      accept: DND_EMOTE_CARD,
      drop: (item) => onAssign(slot, item.emote),
      collect: (m) => ({ isOver: m.isOver() }),
    }),
    [slot, onAssign],
  )

  drop(ref)

  return (
    <div
      ref={ref}
      data-slot={Number(slot) - 1}
      className={
        'mbt-quickbind__slot' +
        (emote ? ' mbt-quickbind__slot--filled' : '') +
        (isOver ? ' mbt-quickbind__slot--dragover' : '')
      }
      onClick={() => emote && onPlay(emote)}
      title={emote ? emote.label : emptyLabel}
    >
      <span className="mbt-quickbind__key">NUM {slot}</span>
      {emote ? (
        <>
          <span className="mbt-quickbind__name">{emote.label}</span>
          <button
            className="mbt-quickbind__clear"
            onClick={(e) => {
              e.stopPropagation()
              onClear(slot)
            }}
          >
            <X size={10} />
          </button>
        </>
      ) : (
        <span className="mbt-quickbind__empty">—</span>
      )}
    </div>
  )
}

export function QuickBindBar({
  keybinds, onPlay, onUpdate,
  personas, activePersonaId, onSwitchPersona, onCreatePersona, onRenamePersona, onDeletePersona,
}: QuickBindBarProps) {
  const t = useLocale()
  const emptyLabel = t.quickbind_empty || 'Drag emote here'

  const handleAssign = async (slot: string, emote: Emote) => {
    if (!emote || typeof emote.name !== 'string') return
    await useNui('setKeybind', { slot, emote })
    onUpdate({ ...keybinds, [slot]: emote })
  }

  const handleClear = async (slot: string) => {
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
        <span className="mbt-quickbind__hint">{t.quickbind_hint || 'Press a numpad key in game'}</span>
      </div>
      {personas && personas.length > 0 && onSwitchPersona && (
        <PersonaBar
          inline
          personas={personas}
          activeId={activePersonaId || 'default'}
          max={10}
          onSwitch={onSwitchPersona}
          onCreate={onCreatePersona || (() => {})}
          onRename={onRenamePersona || (() => {})}
          onDelete={onDeletePersona || (() => {})}
        />
      )}
      <div className="mbt-quickbind__slots">
        {SLOTS.map((slot) => (
          <QuickBindSlot
            key={slot}
            slot={slot}
            emote={keybinds[slot]}
            emptyLabel={emptyLabel}
            onAssign={handleAssign}
            onPlay={onPlay}
            onClear={handleClear}
          />
        ))}
      </div>
    </div>
  )
}
