import { memo, useState, useEffect, useCallback } from 'react'
import { Users, RefreshCw, Send, X } from 'lucide-react'
import { useNui } from '../utils/useNui'
import { useLocale } from '../utils/locale'

interface NearbyPlayer {
  serverId: number
  name: string
  dist: number
}

interface PartnerFinderProps {
  emoteName: string
  top: number
  onClose: () => void
  onSend: (emoteName: string) => void
}

export const PartnerFinder = memo(function PartnerFinder({
  emoteName, top, onClose, onSend,
}: PartnerFinderProps) {
  const [players, setPlayers] = useState<NearbyPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [sent, setSent] = useState(false)
  const t = useLocale()

  const [error, setError] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await useNui<{ players?: NearbyPlayer[] }>(
        'getNearbyPlayers', { radius: 10 }
      )
      setPlayers(res?.players || [])
    } catch {
      setError(true)
      setPlayers([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleSend = useCallback(() => {
    onSend(emoteName)
    setSent(true)
    setTimeout(() => onClose(), 1200)
  }, [emoteName, onSend, onClose])

  return (
    <div className="mbt-partner" style={{ top: `${top}px` }}>
      <div className="mbt-partner__header">
        <Users size={12} />
        <span className="mbt-partner__title">Partner Finder</span>
        <span className="mbt-partner__emote">{emoteName}</span>
        <button className="mbt-partner__close" onClick={onClose}>
          <X size={12} />
        </button>
      </div>

      {loading ? (
        <div className="mbt-partner__loading">{t.partner_loading || 'Searching players...'}</div>
      ) : error ? (
        <div className="mbt-partner__empty">
          {t.partner_empty || 'No players nearby'}
          <button className="mbt-partner__refresh" onClick={refresh}>
            <RefreshCw size={10} /> {t.partner_retry || 'Retry'}
          </button>
        </div>
      ) : players.length === 0 ? (
        <div className="mbt-partner__empty">
          {t.partner_empty || 'No players nearby'}
          <button className="mbt-partner__refresh" onClick={refresh}>
            <RefreshCw size={10} /> {t.partner_retry || 'Retry'}
          </button>
        </div>
      ) : sent ? (
        <div className="mbt-partner__sent">{t.partner_sent || 'Invite sent!'}</div>
      ) : (
        <div className="mbt-partner__list">
          {players.map((p) => (
            <div key={p.serverId} className="mbt-partner__player">
              <span className="mbt-partner__name">{p.name}</span>
              <span className="mbt-partner__dist">{p.dist}m</span>
            </div>
          ))}
          <button className="mbt-partner__send" onClick={handleSend}>
            <Send size={11} /> {t.partner_send || 'Send to nearest'}
          </button>
          <button className="mbt-partner__refresh-btn" onClick={refresh}>
            <RefreshCw size={10} />
          </button>
        </div>
      )}
    </div>
  )
})
