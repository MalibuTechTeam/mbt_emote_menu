import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, type LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  /** Smaller text under the title — explains what the user can do. */
  hint?: string
  /** Animated arrow pointing toward the action the user should take.
   *  Omit when no clear next action exists. */
  arrowDirection?: 'up' | 'down' | 'left' | 'right'
  /** Label displayed next to the arrow — usually echoes the target's name. */
  arrowLabel?: string
  /** `sm` for inline use inside small surfaces (tray panels);
   *  `md` (default) for full-grid empty states. */
  size?: 'sm' | 'md'
}

const ARROW_MAP = {
  up: ArrowUp,
  down: ArrowDown,
  left: ArrowLeft,
  right: ArrowRight,
} as const

/**
 * Empty states are first impressions, not afterthoughts. Floating
 * illustration + animated arrow nudging the user toward the action that
 * resolves the emptiness (search, create, refresh).
 *
 * Pure CSS-driven: no motion library, no wrappers around interactive
 * content. The icon disc and arrow keyframes are declared in index.css
 * — this component just composes the structure and applies the right
 * direction class for the arrow.
 */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  arrowDirection,
  arrowLabel,
  size = 'md',
}: EmptyStateProps) {
  const Arrow = arrowDirection ? ARROW_MAP[arrowDirection] : null
  const showArrow = Arrow && arrowLabel
  const arrowLeading = arrowDirection === 'up' || arrowDirection === 'left'

  return (
    <div className={`mbt-empty mbt-empty--${size}`}>
      <div className="mbt-empty__icon-wrap">
        <Icon
          size={size === 'sm' ? 22 : 36}
          strokeWidth={1.5}
          className="mbt-empty__icon"
          aria-hidden="true"
        />
      </div>

      <div className="mbt-empty__title">{title}</div>
      {hint && <div className="mbt-empty__hint">{hint}</div>}

      {showArrow && (
        <div className={`mbt-empty__arrow mbt-empty__arrow--${arrowDirection}`}>
          {arrowLeading ? (
            <>
              <Arrow size={13} aria-hidden="true" />
              <span>{arrowLabel}</span>
            </>
          ) : (
            <>
              <span>{arrowLabel}</span>
              <Arrow size={13} aria-hidden="true" />
            </>
          )}
        </div>
      )}
    </div>
  )
}
