export interface EmoteVariation {
  name: string
  value: number
}

export interface Emote {
  name: string
  label: string
  /** Server-built lowercase search keywords (prop + anim tokens) so a search
   *  finds an emote by its prop/animation, not just its name/label. */
  keywords?: string
  category: string
  hasProp?: boolean
  isShared?: boolean
  variation?: number
  variations?: EmoteVariation[]
  animDict?: string
  animClip?: string
  scenario?: string
  animFlag?: number; blendIn?: number; blendOut?: number; duration?: number
  prop?: string; propBone?: number; propPlace?: number[]
  prop2?: string; prop2Bone?: number; prop2Place?: number[]
  playDuration?: number
  /** MBT emoji reaction (Emojis category) — renders a glyph above the head
   *  instead of an rpemotes animation. `emoji` holds the actual character. */
  isEmoji?: boolean
  emoji?: string
}

export interface CategoryConfig {
  type: string
  label: string
  icon: string
  visible: boolean
}

export interface ThemeConfig {
  Accent: string
  Background: string
  Card: string
  Text: string
  SubText: string
  Border: string
}

export interface FeaturesConfig {
  Favorites: boolean
  RecentEmotes: boolean
  MaxRecent: number
  QuickBind: boolean
  SharedPopup: boolean
  PreviewPed: boolean
  EmoteWheel?: boolean
  EmotePlacement?: boolean
  PhotoMode?: boolean
  Personas?: boolean
}

export interface EcosystemStatus {
  metaClothes: boolean
  wearableProps: boolean
}

export interface MenuConfig {
  layout?: 'default' | 'cinematic' // the new layout switcher
  allowLayoutSwitch?: boolean // owner gate: may the player change the layout?
  position: 'left' | 'right'
  closeOnPlay?: boolean // close the menu when an emote starts (player pref)
  performanceMode?: boolean // drop ambient/vignette/stagger/preview for FPS (player pref)
  wheelMode?: 'radial' | 'linear' // emote wheel interaction mode (player pref)
  language?: string // active UI language code (player pref override)
  languages?: { code: string; label: string }[] // languages offered in settings
  accents?: { hex: string; label: string }[] // curated accent presets
  allowAccentChange?: boolean // owner gate: may the player pick an accent?
  watermark: boolean
  rememberState?: boolean
  debug?: boolean
  theme: ThemeConfig
  categories: CategoryConfig[]
  features: FeaturesConfig
  ecosystem: EcosystemStatus
}

export interface SharedRequest {
  emoteName: string
  fromId: number
}

/** Map of emote name → list of allowed job names */
export type JobPermissions = Record<string, string[]>

/** User-created custom emote list */
export interface CustomList {
  id: string
  name: string
  /** Legacy: colour-swatch lists saved before v7. Kept optional so old
   *  KVP-persisted lists still load; new lists use `icon` instead. */
  color?: string
  /** Lucide icon key (see LIST_ICONS registry) chosen for the list. */
  icon?: string
  emotes: string[] // emote names
}
