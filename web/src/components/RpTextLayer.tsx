import { useEffect, useRef, useState, type CSSProperties } from 'react'

/** One pill as delivered by Lua's `rpTextUpdate` event. */
interface RpBubbleData {
  id: number
  channel: string
  label: string
  text: string
  /** Channel accent (hex, no '#') from MBT.RpText.Channels[].color. */
  color?: string
  /** World-projected 0–1 screen X. */
  x: number
  /** World-projected 0–1 screen Y. */
  y: number
  /** False when behind the camera or out of range — hidden, not unmounted. */
  onScreen: boolean
}

interface TrackedBubble extends RpBubbleData {
  leaving: boolean
}

// Matches the opacity transition in .mbt-rptext.
const EXIT_MS = 220

interface RpTextLayerProps {
  layout?: 'default' | 'cinematic'
}

/**
 * Renders floating roleplay-action pills (/me, /do) above players' heads.
 *
 * World-to-screen x/y (0..1 of the viewport) are computed in Lua
 * (modules/rptext) and pushed every frame via the `rpTextUpdate` NUI event
 * carrying the full set of live pills. This component diffs that set: new ids
 * mount with a fade-in, ids that drop out fade out then unmount.
 *
 * The message text is rendered as a React text node — never as HTML — so a
 * player typing markup into /me cannot inject anything into the NUI. This is
 * the key hardening over the standalone mbt_me resource.
 *
 * Owns its own NUI-message subscription and state so per-frame position
 * updates re-render only this layer, not the menu tree.
 */
export function RpTextLayer({ layout = 'default' }: RpTextLayerProps) {
  const [bubbles, setBubbles] = useState<Record<number, TrackedBubble>>({})
  const exitTimers = useRef<Record<number, number>>({})

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data
      if (!data || data.action !== 'rpTextUpdate') return
      const incoming: RpBubbleData[] = Array.isArray(data.bubbles) ? data.bubbles : []

      setBubbles((prev) => {
        const next: Record<number, TrackedBubble> = {}
        const seen = new Set<number>()

        for (const b of incoming) {
          if (typeof b?.id !== 'number') continue
          seen.add(b.id)
          // Reappeared before its exit fired — cancel the pending removal.
          const timer = exitTimers.current[b.id]
          if (timer) {
            window.clearTimeout(timer)
            delete exitTimers.current[b.id]
          }
          next[b.id] = { ...b, leaving: false }
        }

        // Pills no longer in the active set: fade out, then unmount.
        for (const key of Object.keys(prev)) {
          const id = Number(key)
          if (seen.has(id)) continue
          next[id] = { ...prev[id], leaving: true }
          if (!exitTimers.current[id]) {
            exitTimers.current[id] = window.setTimeout(() => {
              delete exitTimers.current[id]
              setBubbles((s) => {
                const copy = { ...s }
                delete copy[id]
                return copy
              })
            }, EXIT_MS)
          }
        }

        return next
      })
    }

    window.addEventListener('message', handler)
    return () => {
      window.removeEventListener('message', handler)
      Object.values(exitTimers.current).forEach((t) => window.clearTimeout(t))
      exitTimers.current = {}
    }
  }, [])

  const list = Object.values(bubbles)
  if (list.length === 0) return null

  return (
    <>
      {list.map((b) => (
        <RpTextPill key={b.id} bubble={b} layout={layout} />
      ))}
    </>
  )
}

function RpTextPill({
  bubble,
  layout,
}: {
  bubble: TrackedBubble
  layout: 'default' | 'cinematic'
}) {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => setEntered(true))
    return () => window.cancelAnimationFrame(raf)
  }, [])

  const style: CSSProperties = {
    ['--mbt-x' as keyof CSSProperties]: bubble.x,
    ['--mbt-y' as keyof CSSProperties]: bubble.y,
    // Config-driven channel accent overrides the per-channel CSS fallback.
    ...(bubble.color
      ? { ['--mbt-rptext-accent' as keyof CSSProperties]: `#${bubble.color}` }
      : {}),
  } as CSSProperties

  const visible = entered && !bubble.leaving && bubble.onScreen

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mbt-rptext mbt-rptext--${bubble.channel} layout-${layout}${visible ? ' mbt-rptext--on' : ''}`}
      style={style}
    >
      <span className="mbt-rptext__tag">{bubble.label}</span>
      <span className="mbt-rptext__body">{bubble.text}</span>
    </div>
  )
}
