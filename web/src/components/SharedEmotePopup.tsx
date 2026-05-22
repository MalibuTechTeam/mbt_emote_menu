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
  const [exiting, setExiting] = useState(false)
  const t = useLocale()

  // Play the exit animation, then actually unmount. ~160ms matches the
  // mbt-popup-out keyframe (Toast.tsx's ToastItem uses the same pattern).
  const close = useCallback(() => {
    setExiting(true)
    setTimeout(() => {
      setVisible(false)
      onDismiss()
    }, 160)
  }, [onDismiss])

  const handleAccept = useCallback(async () => {
    await useNui('acceptSharedEmote', { emoteName: request.emoteName })
    close()
  }, [request.emoteName, close])

  const handleDecline = useCallback(async () => {
    await useNui('declineSharedEmote', {})
    close()
  }, [close])

  // Auto-decline after 10 seconds (matches rpemotes timer)
  useEffect(() => {
    const timer = setTimeout(() => {
      handleDecline()
    }, 10000)
    return () => clearTimeout(timer)
  }, [handleDecline])

  if (!visible) return null

  return (
    <div className={`mbt-shared-popup ${exiting ? 'mbt-shared-popup--closing' : ''}`}>
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
