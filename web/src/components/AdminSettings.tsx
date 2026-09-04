import { useState } from "react";
import { AlertTriangle, ArrowRight, RotateCcw, ShieldCheck } from "lucide-react";
import { ColorPicker } from "./ColorPicker";
import { contrastRatio, hexToRgb } from "../utils/color";
import { panelFor } from "../utils/theme";
import { useNui } from "../utils/useNui";
import { useLocale } from "../utils/locale";
import type { AdminInfo } from "../utils/types";

/**
 * The owner's settings, as a view of the menu -- same shell, same header, the
 * way the scene editor already is.
 *
 * The install state used to hang off the bottom of the scene list, which put
 * two subjects in one container: what this server's scenes are, and what this
 * install is. The shield now asks which one you want before showing either.
 */
/**
 * Where to go when the panel cannot answer.
 *
 * Four links, spread across the width so the row reads as a band rather than
 * four stray icons -- the same treatment mbt_malisling gives its rail, because
 * an owner who has seen one MBT panel should recognise the next.
 *
 * Titles stay in English: three of the four are proper nouns, and malisling
 * ships them the same way.
 */
/**
 * The four brand marks, ported from mbt_malisling's Icon.tsx.
 *
 * GitHub and Discord are FILLED. Their own file says why, and it is the reason
 * the lucide line icons I used first were unreadable here: "brand links (filled
 * glyphs -- they're recognisable marks, not line icons)". At 15px a stroke
 * disappears; a solid silhouette does not.
 */
const MARKS = {
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
    </>
  ),
  docs: (
    <>
      <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4Z" />
      <path d="M14 3v4h4" />
      <path d="M9 13h6M9 17h4" />
    </>
  ),
  discord: <path fill="currentColor" stroke="none" d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />,
  github: <path fill="currentColor" stroke="none" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />,
} as const;

function BrandIcon({ name }: { name: keyof typeof MARKS }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {MARKS[name]}
    </svg>
  );
}

const LINKS = [
  { key: "globe", href: "https://malibutechteam.com/", title: "MalibuTech \u2014 all our scripts" },
  { key: "docs", href: "https://malibutechteam.com/docs/mbt-emote-menu/introduction", title: "Documentation" },
  { key: "discord", href: "https://discord.gg/6scYba9AMy", title: "Discord \u2014 support and updates" },
  { key: "github", href: "https://github.com/MalibuTechTeam/mbt_emote_menu", title: "GitHub \u2014 source, issues, releases" },
] as const;

/** CEF has no tab to open, so a plain target=_blank does nothing. openUrl
 *  raises FiveM's own "you are leaving the game" step. */
function openExternal(url: string) {
  const invoke = (window as any).invokeNative;
  if (typeof invoke === "function") invoke("openUrl", url);
  else window.open(url, "_blank", "noreferrer");
}

export function AdminSettings({
  adminInfo,
  accent,
}: {
  adminInfo: AdminInfo | null;
  /** The accent in force right now, 6 hex chars without the "#". */
  accent: string;
}) {
  const t = useLocale();
  const [draft, setDraft] = useState(`#${accent}`.toUpperCase());

  // The applied accent can change under us -- Reset, or another admin applying
  // one -- and the draft has to follow, or the swatch keeps showing a colour
  // that is no longer anywhere. useState only reads its argument on the first
  // render, which is why the swatch survived a reset before this.
  //
  // Adjusted during render rather than in an effect: an effect would paint the
  // stale colour for a frame first.
  const [seen, setSeen] = useState(accent);
  if (seen !== accent) {
    setSeen(accent);
    setDraft(`#${accent}`.toUpperCase());
  }
  const d = adminInfo?.diagnostics;
  const update = adminInfo?.update;

  return (
    <div className="mbt-admin__body">
      <section className="mbt-card mbt-admin__card mbt-admin__section">
        {/* Head: what this is on the left, the control on the right. It is the
            shape every setting row in mbt_malisling has, and the reason the
            swatch is here rather than on its own line -- a colour spanning the
            full width stops being a control and becomes a block of paint. */}
        <div className="mbt-admin__sechead">
          <div className="mbt-admin__secinfo">
            <b>{t.admin_accent || "Server accent"}</b>
            <small>{t.admin_accent_sub || "Applies to everyone on this server"}</small>
          </div>
          <ColorPicker
            value={draft}
            onChange={setDraft}
            aria-label={t.admin_accent || "Server accent"}
          />
        </div>

        <div className="mbt-admin__secbody">
          {/* The one number worth showing. State lives ON the panel -- ready
              slots, active chips -- so an accent that sinks into it stops
              being readable. Text printed on the accent needs no warning:
              theme.ts picks black or white for it by measurement. */}
          <span className="mbt-admin__ratio">
            {(() => {
              const a = hexToRgb(draft);
              // The panel this accent WILL be read against, not the one on
              // screen: surfaces derive from the accent, so reading the live
              // token would measure the colour you already had.
              const p = hexToRgb(panelFor(draft.slice(1)));
              if (!a || !p) return null;
              const r = contrastRatio(a, p);
              return (
                <>
                  <b className={r < 3 ? "mbt-admin__ratio--low" : ""}>{r.toFixed(1)}:1</b>
                  <small>{t.admin_contrast || "against the panel"}</small>
                </>
              );
            })()}
          </span>

          <div className="mbt-admin__secactions">
            <button
              className="mbt-modal__btn"
              onClick={() => useNui("themeReset", {})}
            >
              <RotateCcw size={13} />
              {t.admin_reset || "Reset"}
            </button>
            <button
              className="mbt-modal__btn mbt-modal__btn--confirm"
              disabled={draft.slice(1).toLowerCase() === accent.toLowerCase()}
              onClick={() => useNui("themeSet", { accent: draft.slice(1) })}
            >
              {t.admin_apply || "Apply"}
            </button>
          </div>
        </div>
      </section>

    {/* Install state, pinned. It is reference — an admin consults it once and
        then never again — so it must not push the scenes out of view.

        One card, three states, built from .mbt-card like every row above it.
        The version you run and whether it is current are the same fact about
        the same thing (mbt_malisling's rail plate makes the same argument),
        so an update recolours this card rather than adding a second one. */}
    <div className="mbt-admin__status">
      {(() => {
        // The check itself can fail. The resource is running perfectly when
        // GitHub is unreachable, so that is its own state -- painting the card
        // as a fault would be a lie about what is wrong.
        const failed = !update && !!d && !d.versionChecked;
        const state = update ? "update" : failed ? "unknown" : "ok";

        return (
          <div className={`mbt-card mbt-admin__card mbt-admin__health mbt-admin__health--${state}`}>
            <div className="mbt-admin__healthhead">
              <span className="mbt-card__disc">
                {update ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
              </span>

              {/* The version is why anyone opens this card, so it is the
                  headline rather than a chip in the corner. When an update
                  exists both numbers show: the comparison IS the message, and
                  hiding the one you run left the admin guessing. */}
              <span className="mbt-admin__healthver">
                <b>{d?.versionCurrent || "\u2014"}</b>
                {update && (
                  <>
                    <ArrowRight size={13} aria-hidden="true" />
                    <b className="mbt-admin__healthnew">{update.latest}</b>
                  </>
                )}
              </span>

              <span className={`mbt-admin__healthtag mbt-admin__healthtag--${state}`}>
                {update
                  ? t.admin_update_headline || "Update available"
                  : failed
                    ? t.admin_check_failed || "Update check failed"
                    : t.admin_up_to_date || "Up to date"}
              </span>
            </div>

            {d && (
              <div className="mbt-admin__facts">
                <span className="mbt-admin__fact">
                  <b>{d.rpemotesVersion}</b>
                  <small>{t.admin_diag_rpemotes || "rpemotes"}</small>
                </span>
                <span className="mbt-admin__fact">
                  <b>{d.catalogCount}</b>
                  <small>{t.admin_diag_catalog || "Catalog"}</small>
                </span>
                <span className="mbt-admin__fact">
                  <b>{d.framework}</b>
                  <small>{t.admin_diag_framework || "Framework"}</small>
                </span>
              </div>
            )}
          </div>
        );
      })()}
    </div>

      <nav className="mbt-admin__links" aria-label="MalibuTech">
        {LINKS.map((l) => (
          <a
            key={l.key}
            className="mbt-admin__link"
            href={l.href}
            title={l.title}
            aria-label={l.title}
            onClick={(e) => {
              e.preventDefault();
              openExternal(l.href);
            }}
          >
            <BrandIcon name={l.key} />
          </a>
        ))}
      </nav>
    </div>
  );
}
