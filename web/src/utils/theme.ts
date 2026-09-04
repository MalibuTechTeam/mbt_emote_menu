import type { CSSProperties } from 'react'
import type { ThemeConfig } from './types'
import { rgbToHex, tintSurface } from './color'

/**
 * The surface ladder, as lightness values.
 *
 * These are the lightnesses the neutral surfaces already had -- #0B100E,
 * #121814 and #1A221E sit at 5.5%, 7.8% and 11.5% -- so a tinted panel keeps
 * exactly the depth relationships the neutral one had. Only the hue changes.
 *
 * Lifted from mbt_malisling's utils/accent.ts, which is where this problem was
 * solved first and where the same numbers live.
 */
const SURFACE_L = { s1: 0.055, s2: 0.078, s3: 0.115 } as const

/** The three stops of the world-panel gradient, same idea: the lightnesses of
 *  the brand gradient's #121814 / #0C100E / #090C0A. */
const PANEL_L = { top: 0.082, mid: 0.055, deep: 0.041 } as const

/**
 * A dark surface carrying the accent's hue.
 *
 * tintSurface caps saturation, so this is a tint and not a wash -- and an
 * accent that is nearly grey yields a nearly grey panel, which is the right
 * answer for a server that picked neutral on purpose.
 */
function surface(accentHex: string, lightness: number, fallback: string): string {
  const rgb = tintSurface(`#${accentHex}`, lightness)
  return rgb ? rgbToHex(rgb) : fallback
}

/**
 * The panel an accent will be read against, for a colour that is not applied yet.
 *
 * The admin picker needs this: now that surfaces derive from the accent, a
 * contrast readout taken against the CURRENT panel measures the wrong pair --
 * it compares the colour you are choosing with the panel of the colour you
 * already had.
 *
 * @param accentHex 6 hex characters, no leading #
 */
export function panelFor(accentHex: string): string {
  return surface(accentHex, PANEL_L.top, '#121814')
}

/** Scales a 6-char hex toward black. 0.5 halves every channel. */
function darken(hex: string, factor: number): string {
  const ch = [0, 2, 4].map((i) =>
    Math.round(parseInt(hex.slice(i, i + 2), 16) * factor)
      .toString(16)
      .padStart(2, '0'),
  )
  return `#${ch.join('')}`
}

/** Relative luminance (WCAG) of a 6-char hex, 0 = black, 1 = white. */
function luminance(hex: string): number {
  const ch = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}

/** WCAG contrast ratio between two relative luminances. */
function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/**
 * What to print ON TOP of the accent.
 *
 * Every one of the ten places that needed this used to hardcode a near-black
 * green, which only works while the accent is bright. Once an owner can pick
 * the accent, a dark one turns those labels into 2:1 -- invisible.
 *
 * No lightness threshold to tune: build both candidates -- a near-black in the
 * accent's own hue, and white -- and keep whichever contrasts more.
 */
function onAccent(hex: string): string {
  const dark = darken(hex, 0.09)
  const la = luminance(hex)
  return contrast(la, luminance(dark.slice(1))) >= contrast(la, 1)
    ? dark
    : '#FFFFFF'
}

/** 6-char "rrggbb" hex (no leading #) → "r, g, b" triplet for rgba(). */
export function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

/**
 * Build the CSS custom-property set from the server theme config
 * (config.lua MBT.Theme). App applies these on :root, so the menu,
 * the emote wheel AND the ambient overlays (toast / pills / bubble)
 * all share one accent — changing MBT.Theme.Accent re-tints the whole
 * NUI, glows included. index.css holds the built-in defaults.
 */
export function buildThemeVars(theme: ThemeConfig): CSSProperties {
  const accent = hexToRgb(theme.Accent)
  return {
    '--mbt-accent': `#${theme.Accent}`,
    '--mbt-accent-rgb': accent,
    '--mbt-accent-strong': `rgba(${accent}, 0.82)`,
    '--mbt-accent-g': `linear-gradient(135deg, #${theme.Accent} 0%, rgba(${accent}, 0.75) 100%)`,
    '--mbt-accent-glow': `rgba(${accent}, 0.25)`,
    '--mbt-accent-soft': `rgba(${accent}, 0.08)`,
    '--mbt-on-accent': onAccent(theme.Accent),
    '--mbt-bg': `#${theme.Background}`,
    '--mbt-bg-glass': `rgba(${hexToRgb(theme.Background)}, 0.88)`,
    '--mbt-card': `rgba(${hexToRgb(theme.Card)}, 0.7)`,
    '--mbt-text': `#${theme.Text}`,
    '--mbt-subtext': `#${theme.SubText}`,
    '--mbt-border': `rgba(${hexToRgb(theme.Border)}, 0.35)`,

    // The surface ladder and the world-panel gradient, both carrying the
    // accent's hue at the lightness they already had.
    //
    // This is what makes an admin's colour reach the CARDS and not only the
    // highlights: picking amber used to leave every panel green, because the
    // gradient was pinned to a fixed Card colour.
    '--mbt-surface-1': surface(theme.Accent, SURFACE_L.s1, '#0B100E'),
    '--mbt-surface-2': surface(theme.Accent, SURFACE_L.s2, '#121814'),
    '--mbt-surface-3': surface(theme.Accent, SURFACE_L.s3, '#1A221E'),
    '--mbt-panel-top': surface(theme.Accent, PANEL_L.top, '#121814'),
    '--mbt-panel-mid': surface(theme.Accent, PANEL_L.mid, '#0C100E'),
    '--mbt-panel-deep': surface(theme.Accent, PANEL_L.deep, '#090C0A'),

    // The panel edge, and it has to survive whatever ground the owner picks:
    // at night the panel and the sky have the same luminance, so this border
    // is the only thing drawing the shape. White over a dark ground, black
    // over a light one -- an owner who sets a pale Card would otherwise get a
    // panel with no outline at all.
    '--mbt-edge-world': luminance(
      surface(theme.Accent, PANEL_L.top, '#121814').slice(1),
    ) > 0.4
      ? 'rgba(0, 0, 0, 0.22)'
      : 'rgba(255, 255, 255, 0.17)',
  } as CSSProperties
}
