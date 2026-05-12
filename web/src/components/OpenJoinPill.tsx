import { Users } from 'lucide-react'
import { useLocale } from '../utils/locale'

export type OpenJoinPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

interface OpenJoinPillProps {
  visible: boolean
  emoteLabel: string
  joinKey: string
  position: OpenJoinPosition
  layout?: 'default' | 'cinematic'
}

// Small ambient pill shown to nearby players when someone in radius starts a
// broadcast-eligible emote. Anonymous on purpose — never includes the
// initiator's name. Pressing the configured key (handled in Lua via
// RegisterKeyMapping) joins the same emote.
export function OpenJoinPill({ visible, emoteLabel, joinKey, position, layout = 'default' }: OpenJoinPillProps) {
  const t = useLocale()
  if (!visible) return null

  return (
    <div className={`mbt-openjoin layout-${layout} pos-${position} mbt-openjoin--on`}>
      <Users size={12} className="mbt-openjoin__icon" />
      <span className="mbt-openjoin__text">
        {(t.openjoin_label || 'Join') + ': ' + emoteLabel}
      </span>
      <kbd className="mbt-openjoin__key">{joinKey}</kbd>
    </div>
  )
}
