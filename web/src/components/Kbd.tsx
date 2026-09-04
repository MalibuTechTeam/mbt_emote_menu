import type { ReactNode } from "react";

/**
 * The one keycap in this UI.
 *
 * There were seven, in two visual families. Three surfaces used a raised
 * physical keycap (the placement overlay, whose CSS calls itself "v7 physical
 * keycap", plus Open Join and What's That); three more used a flat mono chip
 * (the placing bar, the spot prompt, the scene panel). Same object, same job,
 * six answers -- so pressing E in one prompt and E in another looked like two
 * different keyboards.
 *
 * The raised keycap wins because it is the one that reads as a physical key at
 * a glance, and because the quick-bind slots -- the most prominent key surface
 * in the product -- already look like that.
 *
 * `intent` is what pressing it does, not what colour it is:
 *   go   the primary action of the surface. Solid accent, dark ink, because a
 *        world prompt has to be readable from across the panel.
 *   off  backing out. Tinted, never solid -- cancel does not get to shout.
 *
 * `size` is legibility, not hierarchy: `lg` for prompts that float over the
 * game world, `sm` for hints inside a panel the reader is already looking at.
 */
export type KeyIntent = "off";
export type KeySize = "sm" | "lg";

export function Kbd({
  children,
  intent,
  size = "sm",
  label,
}: {
  children: ReactNode;
  intent?: KeyIntent;
  size?: KeySize;
  /** Spoken name, when the glyph is a symbol a screen reader cannot voice. */
  label?: string;
}) {
  return (
    <kbd
      className={`mbt-key mbt-key--${size}${intent ? ` mbt-key--${intent}` : ""}`}
      aria-label={label}
    >
      {children}
    </kbd>
  );
}

/**
 * A keycap group with the thing it does written next to it. Every prompt in
 * this resource is a list of these; before, every prompt built its own.
 */
export function KeyHint({
  keys,
  label,
  icon,
  intent,
  size = "sm",
  disabled,
}: {
  keys: ReactNode[];
  label: ReactNode;
  icon?: ReactNode;
  intent?: KeyIntent;
  size?: KeySize;
  /** Shown, but not armed yet -- so pressing it and being refused is not a
   *  surprise. Out of range for a scene mark is the case that needs it. */
  disabled?: boolean;
}) {
  return (
    <span
      className={`mbt-keyhint mbt-keyhint--${size}${intent ? ` mbt-keyhint--${intent}` : ""}${
        disabled ? " mbt-keyhint--off-range" : ""
      }`}
    >
      <span className="mbt-keyhint__keys">
        {keys.map((k, i) => (
          <Kbd key={i} intent={intent} size={size}>
            {k}
          </Kbd>
        ))}
      </span>
      <span className="mbt-keyhint__label">
        {icon}
        <span>{label}</span>
      </span>
    </span>
  );
}
