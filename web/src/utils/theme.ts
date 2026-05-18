import type { CSSProperties } from 'react'
import type { ThemeConfig } from './types'

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
    '--mbt-bg': `#${theme.Background}`,
    '--mbt-bg-glass': `rgba(${hexToRgb(theme.Background)}, 0.88)`,
    '--mbt-card': `rgba(${hexToRgb(theme.Card)}, 0.7)`,
    '--mbt-text': `#${theme.Text}`,
    '--mbt-subtext': `#${theme.SubText}`,
    '--mbt-border': `rgba(${hexToRgb(theme.Border)}, 0.35)`,
  } as CSSProperties
}
