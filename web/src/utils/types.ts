export interface EmoteVariation {
  name: string
  value: number
}

export interface Emote {
  name: string
  label: string
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
  AdultEmotes?: boolean
  AbusableEmotes?: boolean
}

export interface EcosystemStatus {
  metaClothes: boolean
  wearableProps: boolean
}

export interface MenuConfig {
  layout?: 'default' | 'cinematic' // the new layout switcher
  position: 'left' | 'right'
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
