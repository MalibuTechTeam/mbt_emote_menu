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

export interface PlayerState {
  playing: boolean
  crouched: boolean
  prone: boolean
  pointing: boolean
  handsUp: boolean
  walkstyle: string | null
}

/** Map of emote name → list of allowed job names */
export type JobPermissions = Record<string, string[]>

/** User-created custom emote list */
export interface CustomList {
  id: string
  name: string
  color: string
  emotes: string[] // emote names
}
