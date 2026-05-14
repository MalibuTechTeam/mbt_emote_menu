import { useEffect, useState } from 'react'

interface AnimatedNumberProps {
  /** Target value to animate towards. */
  value: number
  /** Spring duration in ms. Default 400 reads as "lively but not laggy". */
  duration?: number
  /** Format function — runs on every interpolated frame, so keep it cheap.
   *  Default rounds to integer with locale-aware comma separators. */
  format?: (n: number) => string
  className?: string
  'aria-label'?: string
}

/**
 * Spring-driven number that counts/morphs between values instead of snapping.
 *
 * Implemented with a single requestAnimationFrame loop and ease-out-cubic so
 * we don't drag in a 50KB animation library for a counter. Updates happen
 * via React state on each frame, which is fine for a ~400ms transition —
 * the number lives inside a leaf <span>, no ancestor re-renders.
 *
 * Family pattern: "values that change should count/flip/morph, never just
 * swap". Reserved for low-frequency numeric updates (nearby count, search
 * result count, recent badge). NOT for high-frequency scrolling indices —
 * the snap is the right feedback for those.
 */
export function AnimatedNumber({
  value,
  duration = 400,
  format = (n) => Math.round(n).toLocaleString(),
  className,
  'aria-label': ariaLabel,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    // First render: snap to value without animating; only subsequent
    // value changes get the spring treatment.
    const from = display
    const to = value
    if (from === to) return undefined

    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out-cubic
      setDisplay(from + (to - from) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
      else setDisplay(to)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  return (
    <span className={className} aria-label={ariaLabel}>
      {format(display)}
    </span>
  )
}
