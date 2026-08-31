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

/** Update notice, only ever delivered to a player the server has ACE-checked. */
export interface UpdateInfo {
  current: string
  latest: string
  url: string
}

/** Owner diagnostics shown next to the update notice. Same ACE gate. */
export interface Diagnostics {
  rpemotesResource: string
  rpemotesExport: string
  rpemotesVersion: string
  rpemotesMin: string
  catalogCount: number
  placement: boolean
  framework: string
  versionCurrent?: string
  versionLatest?: string
  versionChecked: boolean
}

export interface AdminInfo {
  update: UpdateInfo | null
  diagnostics: Diagnostics
  editor: boolean
}

/** One "stand here, face this way, do this" mark inside a scene. */
export interface SceneMark {
  x: number
  y: number
  z: number
  heading: number
  emote?: string
  category?: string
  label?: string
  role?: string
}

/** Where the player is, pushed while the editor hub is open so the scene list
 *  can show distances without asking Lua to compute one per row. */
export interface WorldPos {
  x: number
  y: number
  z: number
}

/** A spot is a scene with exactly one mark — same schema, one code path. */
export interface Scene {
  id?: string
  type?: 'spot' | 'seats' | 'scene'
  label: string
  marks: SceneMark[]
  radius?: number
}

export interface EditorState {
  active: boolean
  /** 'placing' = the world owns input, one key. 'review' = the inspector does. */
  phase: 'placing' | 'review'
  scene: Scene | null
  selected: number
  /** Unsaved changes exist, so exiting must confirm. */
  dirty: boolean
  /** The next placement retargets the selected actor instead of adding one. */
  replacing: boolean
  /** The ped is standing on the mark performing its emote, for judging a pose
   *  against the actual chair or counter rather than against a circle. */
  previewing: boolean
}
