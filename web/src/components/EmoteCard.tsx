import { memo, useRef, useCallback, useState, useEffect } from 'react'
import { Check, ChevronDown, Eye, EyeOff, FolderPlus, Keyboard, ListPlus, Lock, MapPin, Target } from 'lucide-react'
import { EmoteSilhouette } from './EmoteSilhouette'
import { useLocale, tFormat } from '../utils/locale'
import type { CustomList, Emote } from '../utils/types'

// Categories where "Place in world" makes sense. Walks/Expressions are continuous
// states; Shared requires nearby players; Emojis are chat-style.
const PLACEABLE_CATEGORIES = new Set(['Emotes', 'PropEmotes', 'Dances', 'AnimalEmotes'])

interface EmoteCardProps {
  emote: Emote
  isFavorite: boolean
  isFocused?: boolean
  isPreviewActive?: boolean
  cardIndex?: number
  hidePropBadge?: boolean
  hideSharedBadge?: boolean
  isActiveStyle?: boolean
  playCount?: number
  locked?: boolean
  placementEnabled?: boolean
  onPlay: (emote: Emote) => void
  onToggleFavorite: (emote: Emote) => void
  onPreviewToggle?: (emote: Emote) => void
  onAddToPlaylist?: (emote: Emote) => void
  onPlace?: (emote: Emote) => void
  onBindClick?: (emote: Emote, slot: number, element: HTMLElement) => void
  wheelSlots?: Record<string, Emote>
  wheelMaxSlots?: number
  onSetWheelSlot?: (slot: number, emote: Emote | null) => void
  customLists?: CustomList[]
  onAddToList?: (listId: string, emoteName: string) => void
  onRemoveFromList?: (listId: string, emoteName: string) => void
}

export const EmoteCard = memo(function EmoteCard({ emote, isFavorite, isFocused, isPreviewActive, cardIndex, hidePropBadge, hideSharedBadge, isActiveStyle, playCount, locked, placementEnabled, onPlay, onToggleFavorite, onPreviewToggle, onAddToPlaylist, onPlace, onBindClick, wheelSlots, wheelMaxSlots, onSetWheelSlot, customLists, onAddToList, onRemoveFromList }: EmoteCardProps) {
  const t = useLocale()
  const cardRef = useRef<HTMLDivElement>(null)
  const [drawerType, setDrawerType] = useState<'none' | 'variants' | 'actions' | 'lists'>('none')
  const rafRef = useRef<number>(0)
  const categoryClass = `mbt-card--cat-${emote.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  // Cancel pending RAF on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const card = cardRef.current
    if (!card) return
    if (rafRef.current) return // Skip if a frame is already pending
    const x = e.clientX
    const y = e.clientY
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      if (!card) return
      const rect = card.getBoundingClientRect()
      card.style.setProperty('--mouse-x', `${x - rect.left}px`)
      card.style.setProperty('--mouse-y', `${y - rect.top}px`)
    })
  }, [])


  const handleClick = () => {
    if (locked) return
    if (hasVariants) {
      setDrawerType(drawerType === 'variants' ? 'none' : 'variants')
    } else {
      onPlay(emote)
    }
  }

  const handleWheelSlotPick = (slot: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (onSetWheelSlot) {
      // If this emote is already in this slot, remove it; otherwise assign
      const current = wheelSlots?.[String(slot)]
      if (current && current.name === emote.name) {
        onSetWheelSlot(slot, null)
      } else {
        onSetWheelSlot(slot, emote)
      }
    }
    setDrawerType('none')
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    if (locked) return
    setDrawerType(drawerType === 'actions' ? 'none' : 'actions')
  }

  const handleVariantPick = (value: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setDrawerType('none')
    onPlay({ ...emote, variation: value })
  }

  const handleBindPick = (slot: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (onBindClick && cardRef.current) {
      onBindClick(emote, slot, cardRef.current)
    }
    setDrawerType('none')
  }

  const handleListToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (locked) return
    setDrawerType(drawerType === 'lists' ? 'none' : 'lists')
  }

  const handleListPick = (listId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const list = customLists?.find((l) => l.id === listId)
    const alreadyIn = list?.emotes.includes(emote.name)
    if (alreadyIn && onRemoveFromList) {
      onRemoveFromList(listId, emote.name)
    } else if (!alreadyIn && onAddToList) {
      onAddToList(listId, emote.name)
    }
    setDrawerType('none')
  }

  const categoryBadge = () => {
    if (emote.isShared && !hideSharedBadge) return <span className="mbt-card__tag mbt-card__tag--shared">{t.badge_sync || 'Sync'}</span>
    if (emote.hasProp && !hidePropBadge) return <span className="mbt-card__tag mbt-card__tag--prop">{t.badge_prop || 'Prop'}</span>
    if (emote.category === 'Dances') return <span className="mbt-card__tag mbt-card__tag--dance">{t.badge_dance || 'Dance'}</span>
    return null
  }

  const hasVariants = emote.variations && emote.variations.length > 0
  const canPreview = !!(emote.animDict || emote.scenario) && emote.category !== 'Walks'

  return (
    <div
      ref={cardRef}
      className={`mbt-card ${categoryClass} ${drawerType !== 'none' ? 'mbt-card--expanded' : ''} ${isFocused ? 'mbt-card--focused' : ''} ${isPreviewActive ? 'mbt-card--previewing' : ''} ${isActiveStyle ? 'mbt-card--active-style' : ''} ${locked ? 'mbt-card--locked' : ''}`}
      data-card-index={cardIndex}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setDrawerType('none')}
    >
      <div className="mbt-card__row">
        <div className="mbt-card__name">
          {locked && <Lock size={14} className="mbt-card__lock-icon" />}
          <span className="mbt-card__disc">
            <EmoteSilhouette emote={emote} size={23} />
          </span>
          <span className="mbt-card__text">
            <span className="mbt-card__label">{emote.label}</span>
            <span className="mbt-card__category mbt-card__sub">
              <span className="mbt-card__cmd" title={emote.name}>{emote.name}</span>
              {categoryBadge()}
              {hasVariants && (
                <span
                  className="mbt-card__var"
                  title={tFormat(t.variant_count || '%s variants', emote.variations!.length)}
                >
                  <ChevronDown size={11} className="mbt-card__var-icon" />
                  {emote.variations!.length}
                </span>
              )}
            </span>
          </span>
      </div>
      <div className="mbt-card__meta">
        {isActiveStyle && (
          <span className="mbt-badge mbt-badge--active">{t.badge_active || 'Active'}</span>
        )}
        {playCount != null && playCount > 0 && (
          <span className="mbt-badge mbt-badge--plays">{playCount}x</span>
        )}
      </div>
      <div className="mbt-card__actions">
        {canPreview && onPreviewToggle && (
          <button
            className={`mbt-card__preview ${isPreviewActive ? 'mbt-card__preview--active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onPreviewToggle(emote) }}
            title={isPreviewActive ? (t.tooltip_preview_stop || 'Stop preview') : (t.tooltip_preview_start || 'Preview animation (only you)')}
          >
            {isPreviewActive ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
        {placementEnabled && onPlace && PLACEABLE_CATEGORIES.has(emote.category) && !locked && (
          <button
            className="mbt-card__place"
            onClick={(e) => { e.stopPropagation(); onPlace(emote) }}
            title={t.tooltip_place_in_world || 'Place in world'}
          >
            <MapPin size={16} />
          </button>
        )}
        {onAddToPlaylist && (
          <button
            className="mbt-card__playlist-add"
            onClick={(e) => { e.stopPropagation(); onAddToPlaylist(emote) }}
            title={t.tooltip_add_to_playlist || 'Add to playlist'}
          >
            <ListPlus size={16} />
          </button>
        )}
        {customLists && customLists.length > 0 && onAddToList && (
          <button
            className={`mbt-card__list-add ${drawerType === 'lists' ? 'mbt-card__list-add--active' : ''}`}
            onClick={handleListToggle}
            title={t.tooltip_add_to_list || 'Add to custom list'}
          >
            <FolderPlus size={16} />
          </button>
        )}
        <button
          className={`mbt-card__fav ${isFavorite ? 'mbt-card__fav--active' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite(emote)
          }}
        >
          {isFavorite ? '★' : '☆'}
        </button>
      </div>
      </div>

      {/* Unified Action Drawer */}
      {drawerType !== 'none' && (
        <div className="mbt-card__variants">
          {drawerType === 'variants' && emote.variations && (
            <div className="mbt-drawer__section">
              <div className="mbt-drawer__title">{t.drawer_textures || 'Textures'}</div>
              <div className="mbt-drawer__grid">
                {emote.variations.map((v) => (
                  <button key={v.value} className="mbt-card__variant-btn" onClick={(e) => handleVariantPick(v.value, e)}>
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {drawerType === 'lists' && customLists && (
            <div className="mbt-drawer__section">
              <div className="mbt-drawer__title">{t.drawer_custom_lists || 'Custom Lists'}</div>
              <div className="mbt-drawer__list-grid">
                {customLists.map((list) => {
                  const alreadyIn = list.emotes.includes(emote.name)
                  return (
                    <button
                      key={list.id}
                      className={`mbt-drawer__list-btn ${alreadyIn ? 'mbt-drawer__list-btn--active' : ''}`}
                      onClick={(e) => handleListPick(list.id, e)}
                      title={alreadyIn
                        ? tFormat(t.tooltip_remove_from_list || 'Remove from "%s"', list.name)
                        : tFormat(t.tooltip_add_to_named_list || 'Add to "%s"', list.name)}
                      style={list.color ? ({ '--list-color': `#${list.color}` } as React.CSSProperties) : undefined}
                    >
                      <span className="mbt-drawer__list-dot" />
                      <span className="mbt-drawer__list-name">{list.name}</span>
                      {alreadyIn && <Check size={12} className="mbt-drawer__list-check" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {drawerType === 'actions' && (
            <>
              <div className="mbt-drawer__section">
                <div className="mbt-drawer__title mbt-drawer__label">
                  <Keyboard size={13} />
                  {t.drawer_quick_bind || 'Quick Bind'}
                  <span className="mbt-drawer__hint">{t.drawer_quick_bind_hint || 'Numpad key'}</span>
                </div>
                <div className="mbt-drawer__bind-grid">
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <button key={num} className="mbt-drawer__bind-btn" onClick={(e) => handleBindPick(num - 1, e)}>
                      {tFormat(t.drawer_bind_key || 'NUM %s', num)}
                    </button>
                  ))}
                </div>
              </div>
              {onSetWheelSlot && wheelMaxSlots && wheelMaxSlots > 0 && (
                <div className="mbt-drawer__section mbt-drawer__section--wheel">
                  <div className="mbt-drawer__title mbt-drawer__label">
                    <Target size={13} />
                    {t.drawer_wheel_slot || 'Wheel Slot'}
                    <span className="mbt-drawer__hint">{t.drawer_wheel_slot_hint || 'Radial menu'}</span>
                  </div>
                  <div className="mbt-drawer__wheel-grid">
                    {Array.from({ length: wheelMaxSlots }, (_, i) => i + 1).map((slot) => {
                      const assigned = wheelSlots?.[String(slot)]
                      const isThisEmote = assigned?.name === emote.name
                      return (
                        <button
                          key={slot}
                          className={`mbt-drawer__wheel-btn ${isThisEmote ? 'mbt-drawer__wheel-btn--active' : ''} ${assigned && !isThisEmote ? 'mbt-drawer__wheel-btn--occupied' : ''}`}
                          onClick={(e) => handleWheelSlotPick(slot, e)}
                          title={assigned
                            ? (isThisEmote
                              ? (t.tooltip_wheel_remove || 'Click to remove')
                              : tFormat(t.tooltip_wheel_occupied || 'Occupied: %s', assigned.label))
                            : tFormat(t.tooltip_wheel_assign || 'Assign to slot %s', slot)}
                        >
                          <span className="mbt-drawer__wheel-num">{slot}</span>
                          {assigned && !isThisEmote && <span className="mbt-drawer__wheel-dot" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
})
