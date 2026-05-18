import { memo, useState, useCallback } from 'react'
import { Play, Square, Repeat, Trash2, ChevronUp, ChevronDown, ListMusic } from 'lucide-react'
import { useLocale } from '../utils/locale'
import type { Emote } from '../utils/types'

interface PlaylistPanelProps {
  items: Emote[]
  playing: boolean
  currentIndex: number
  onRemove: (index: number) => void
  onReorder: (from: number, to: number) => void
  onPlay: (loop: boolean) => void
  onStop: () => void
  onClear: () => void
}

export const PlaylistPanel = memo(function PlaylistPanel({
  items, playing, currentIndex,
  onRemove, onReorder, onPlay, onStop, onClear,
}: PlaylistPanelProps) {
  const [loopEnabled, setLoopEnabled] = useState(false)
  const t = useLocale()

  const handlePlay = useCallback(() => {
    if (playing) { onStop() } else { onPlay(loopEnabled) }
  }, [playing, loopEnabled, onPlay, onStop])

  if (items.length === 0) {
    return (
      <div className="mbt-playlist">
        <div className="mbt-playlist__header">
          <ListMusic size={12} />
          <span>{t.playlist_label || 'Playlist'}</span>
        </div>
        <div className="mbt-playlist__empty">{t.playlist_empty || 'Drag or use + to add'}</div>
      </div>
    )
  }

  return (
    <div className="mbt-playlist">
      <div className="mbt-playlist__header">
        <ListMusic size={12} />
        <span>{t.playlist_label || 'Playlist'}</span>
        <span className="mbt-playlist__count">{items.length}</span>
        <div className="mbt-playlist__controls">
          <button
            className={`mbt-playlist__btn ${loopEnabled ? 'mbt-playlist__btn--active' : ''}`}
            onClick={() => setLoopEnabled(l => !l)}
            title={loopEnabled ? (t.playlist_loop_on || 'Loop enabled') : (t.playlist_loop_off || 'Loop disabled')}
          >
            <Repeat size={11} />
          </button>
          <button
            className={`mbt-playlist__btn ${playing ? 'mbt-playlist__btn--stop' : 'mbt-playlist__btn--play'}`}
            onClick={handlePlay}
            title={playing ? (t.btn_stop || 'Stop') : (t.btn_play || 'Play')}
          >
            {playing ? <Square size={11} /> : <Play size={11} />}
          </button>
          <button
            className="mbt-playlist__btn mbt-playlist__btn--clear"
            onClick={onClear}
            title={t.playlist_clear || 'Clear playlist'}
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      <div className="mbt-playlist__list">
        {items.map((emote, idx) => (
          <div
            key={`${emote.name}-${idx}`}
            className={`mbt-playlist__item ${playing && currentIndex === idx ? 'mbt-playlist__item--active' : ''}`}
          >
            <span className="mbt-playlist__idx">{idx + 1}</span>
            <span className="mbt-playlist__name">{emote.label}</span>
            <span className="mbt-playlist__dur">{emote.playDuration || 5}s</span>
            <div className="mbt-playlist__item-actions">
              {idx > 0 && (
                <button className="mbt-playlist__move" onClick={() => onReorder(idx, idx - 1)}>
                  <ChevronUp size={10} />
                </button>
              )}
              {idx < items.length - 1 && (
                <button className="mbt-playlist__move" onClick={() => onReorder(idx, idx + 1)}>
                  <ChevronDown size={10} />
                </button>
              )}
              <button className="mbt-playlist__remove" onClick={() => onRemove(idx)}>
                <Trash2 size={10} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})
