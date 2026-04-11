import { useState, useEffect } from 'react'
import { Square } from 'lucide-react'
import { useLocale } from '../utils/locale'
import { useNui } from '../utils/useNui'
import type { PlayerState } from '../utils/types'

interface StatusBarProps {
  onCancel: () => void
}

export function StatusBar({ onCancel }: StatusBarProps) {
  const [state, setState] = useState<PlayerState>({
    playing: false,
    crouched: false,
    prone: false,
    pointing: false,
    handsUp: false,
    walkstyle: null,
  })

  // Poll player state (2s interval — status changes are infrequent, no need for aggressive polling)
  useEffect(() => {
    let mounted = true
    const poll = async () => {
      try {
        const result = await useNui<PlayerState>('getPlayerState', {})
        if (mounted && result && typeof result.playing === 'boolean') {
          setState(result)
        }
      } catch { /* ignore in dev */ }
    }

    poll()
    const interval = setInterval(poll, 2000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

  const t = useLocale()
  const statusLabel = state.playing ? (t.status_playing || 'Playing') : (t.status_idle || 'Idle')

  return (
    <div className="mbt-statusbar">
      <div className="mbt-statusbar__info">
        <span className="mbt-statusbar__label">{t.status_walkstyle ? 'Status' : 'Status'}</span>
        <span className="mbt-statusbar__value">
          <span className={`mbt-statusbar__dot ${state.playing ? 'mbt-statusbar__dot--playing' : 'mbt-statusbar__dot--idle'}`} />
          {statusLabel}
          {state.walkstyle && (
            <span style={{ marginLeft: 8, opacity: 0.5, fontSize: 11 }}>
              {t.status_walkstyle || 'Walk Style'}: {state.walkstyle}
            </span>
          )}
        </span>
      </div>
      <button className="mbt-stop-btn" onClick={onCancel}>
        <Square size={12} />
        {t.cancel_emote || 'Stop'}
      </button>
    </div>
  )
}
