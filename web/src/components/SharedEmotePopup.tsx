import { useEffect, useState, useCallback } from 'react'
import { Users } from 'lucide-react'
import { useLocale } from '../utils/locale'
import { useNui } from '../utils/useNui'
import type { SharedRequest } from '../utils/types'

interface SharedEmotePopupProps {
  request: SharedRequest
  onDismiss: () => void
}

export function SharedEmotePopup({ request, onDismiss }: SharedEmotePopupProps) {
  const [visible, setVisible] = useState(true)
  const t = useLocale()

  const handleAccept = useCallback(async () => {
    await useNui('acceptSharedEmote', { emoteName: request.emoteName })
    setVisible(false)
    onDismiss()
  }, [request.emoteName, onDismiss])

  const handleDecline = useCallback(async () => {
    await useNui('declineSharedEmote', {})
    setVisible(false)
    onDismiss()
  }, [onDismiss])

  // Auto-decline after 10 seconds (matches rpemotes timer)
  useEffect(() => {
    const timer = setTimeout(() => {
      handleDecline()
    }, 10000)
    return () => clearTimeout(timer)
  }, [handleDecline])

  if (!visible) return null

  return (
    <div className="mbt-shared-popup">
      <div className="mbt-shared-popup__header">
        <Users className="mbt-shared-popup__icon" size={16} />
        <span className="mbt-shared-popup__title">
          Player #{request.fromId} {t.shared_request || 'wants to play'}{' '}
          <span className="mbt-shared-popup__emote">"{request.emoteName}"</span>
        </span>
      </div>
      <div className="mbt-shared-popup__actions">
        <button
          className="mbt-shared-popup__btn mbt-shared-popup__btn--accept"
          onClick={handleAccept}
        >
          {t.shared_accept || 'Accept'} (Y)
        </button>
        <button
          className="mbt-shared-popup__btn mbt-shared-popup__btn--decline"
          onClick={handleDecline}
        >
          {t.shared_decline || 'Decline'} (N)
        </button>
      </div>
      <div className="mbt-shared-popup__timer">
        <div className="mbt-shared-popup__timer-bar" />
      </div>
    </div>
  )
}
