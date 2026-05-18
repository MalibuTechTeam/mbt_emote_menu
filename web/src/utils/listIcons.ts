import {
  Star,
  Heart,
  Music,
  Flame,
  Crown,
  Zap,
  Sparkles,
  Smile,
  Gamepad2,
  Sword,
  PartyPopper,
  Dumbbell,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Curated, list-themed lucide icons a user can pick for a custom list.
 * Shared by the New List modal's icon-picker grid and the lens tab that
 * renders each list. Keys are stable strings persisted in KVP via
 * CustomList.icon — never rename a key without a migration.
 */
export const LIST_ICONS: Record<string, LucideIcon> = {
  star: Star,
  heart: Heart,
  music: Music,
  flame: Flame,
  crown: Crown,
  zap: Zap,
  sparkles: Sparkles,
  smile: Smile,
  gamepad: Gamepad2,
  sword: Sword,
  party: PartyPopper,
  dumbbell: Dumbbell,
}

/** Stable key order for the picker grid. */
export const LIST_ICON_KEYS = Object.keys(LIST_ICONS)

/** First icon — default selection in the creator and fallback for
 *  legacy lists saved with a `color` but no `icon`. */
export const DEFAULT_LIST_ICON = LIST_ICON_KEYS[0]

/** Resolve a list's icon key to its component, falling back for
 *  legacy / unknown keys. */
export function listIconFor(key?: string): LucideIcon {
  return (key && LIST_ICONS[key]) || LIST_ICONS[DEFAULT_LIST_ICON]
}
