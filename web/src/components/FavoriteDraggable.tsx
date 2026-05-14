import { useRef, type ReactNode } from 'react'
import { useDrag, useDrop } from 'react-dnd'
import type { Emote } from '../utils/types'

/**
 * react-dnd drag item type for emote cards. Single shared type means any
 * drop target (favorites reorder, QuickBind slot, future ones) can accept
 * the same source — analogous to ox_inventory's `'SLOT'` type. The item
 * payload carries the emote + the source index in the filtered list so
 * reorder math has everything it needs.
 */
export const DND_EMOTE_CARD = 'EMOTE_CARD' as const

export interface EmoteCardDragItem {
  emote: Emote
  fromIdx: number
}

interface FavoriteDraggableProps {
  emote: Emote
  /** Position in the current filteredEmotes slice (NOT in favOrder). The
   *  reorder math in EmoteMenu translates filteredEmotes indices to the
   *  underlying favOrder positions. */
  idx: number
  /** Only enables drag + drop when on the favorites tab. In other tabs the
   *  wrapper is a no-op div — keeps the public behaviour identical to the
   *  HTML5 native version while react-dnd is wired in. */
  enabled: boolean
  onReorder: (fromIdx: number, toIdx: number) => void
  className?: string
  children: ReactNode
}

/**
 * Wraps each card-wrap on the favorites tab. Mirrors ox_inventory's
 * InventorySlot drag/drop pattern: useDrag describes the source, useDrop
 * describes the target, both connect into a single DOM node via the
 * `drag(drop(ref))` idiom.
 *
 * Drag source: only fires when `enabled` is true (i.e. user is on the
 * favorites tab). Item payload carries emote + source index.
 *
 * Drop target: accepts the same EMOTE_CARD type, declines self-drops via
 * canDrop, and on a real drop hands off to onReorder with from / to
 * filteredEmotes indices. Index translation to favOrder lives in
 * EmoteMenu where favOrder + filteredEmotes are already in scope.
 */
export function FavoriteDraggable({
  emote,
  idx,
  enabled,
  onReorder,
  className = '',
  children,
}: FavoriteDraggableProps) {
  const ref = useRef<HTMLDivElement>(null)

  const [{ isDragging }, drag] = useDrag<EmoteCardDragItem, void, { isDragging: boolean }>(
    () => ({
      type: DND_EMOTE_CARD,
      item: { emote, fromIdx: idx },
      canDrag: () => enabled,
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [emote, idx, enabled],
  )

  const [{ isOver }, drop] = useDrop<EmoteCardDragItem, void, { isOver: boolean }>(
    () => ({
      accept: DND_EMOTE_CARD,
      canDrop: (item) => enabled && item.fromIdx !== idx,
      drop: (item) => {
        if (item.fromIdx !== idx) onReorder(item.fromIdx, idx)
      },
      collect: (monitor) => ({
        isOver: monitor.isOver() && monitor.canDrop(),
      }),
    }),
    [idx, enabled, onReorder],
  )

  // `drag(drop(ref))` attaches both source + target to the same DOM node.
  drag(drop(ref))

  return (
    <div
      ref={ref}
      className={
        className +
        (isOver ? ' mbt-card-wrap--dragover' : '') +
        (isDragging ? ' mbt-card-wrap--dragging' : '')
      }
    >
      {children}
    </div>
  )
}
