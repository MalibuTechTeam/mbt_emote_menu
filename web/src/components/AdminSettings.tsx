import { useState } from "react";
import { AlertTriangle, ExternalLink, RotateCcw, ShieldCheck } from "lucide-react";
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
      <section className="mbt-admin__section">
        <div className="mbt-admin__sechead">
          <b>{t.admin_accent || "Server accent"}</b>
          <small>{t.admin_accent_sub || "Applies to everyone on this server"}</small>
        </div>

        <div className="mbt-admin__accent">
          <ColorPicker
            value={draft}
            onChange={setDraft}
            aria-label={t.admin_accent || "Server accent"}
          />

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
        </div>

        <div className="mbt-admin__accentbtns">
          <button
            className="mbt-modal__btn mbt-modal__btn--confirm"
            disabled={draft.slice(1).toLowerCase() === accent.toLowerCase()}
            onClick={() => useNui("themeSet", { accent: draft.slice(1) })}
          >
            {t.admin_apply || "Apply"}
          </button>
          <button
            className="mbt-modal__btn"
            onClick={() => useNui("themeReset", {})}
          >
            <RotateCcw size={13} />
            {t.admin_reset || "Reset"}
          </button>
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
        // GitHub is unreachable, so that goes on the second line -- painting
        // the card as a fault would be a lie about what is wrong.
        const failed = !update && !!d && !d.versionChecked;
        const state = update ? "update" : failed ? "unknown" : "ok";

        const inner = (
          <>
            <div className="mbt-card__row">
              <div className="mbt-card__name">
                <span className="mbt-card__disc">
                  {update ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
                </span>
                <span className="mbt-card__text">
                  <span className="mbt-card__label">
                    {update
                      ? t.admin_update_headline || "Update available"
                      : failed
                        ? t.admin_running || "Running"
                        : t.admin_up_to_date || "Up to date"}
                  </span>
                  <span className="mbt-card__sub">
                    <span className="mbt-card__cmd">
                      {update
                        ? (t.admin_update_sub || "%s on GitHub").replace("%s", update.latest)
                        : failed
                          ? t.admin_check_failed || "Update check failed"
                          : t.admin_latest_release || "Latest release"}
                    </span>
                  </span>
                </span>
              </div>

              <div className="mbt-card__meta">
                {/* The chip is dropped while updating: the card is about the
                    NEW version, so repeating the one you are on competes
                    with it. The arrow takes its place, because the card
                    leaves the game when you press it. */}
                {update ? (
                  <ExternalLink size={14} className="mbt-admin__healthgo" />
                ) : (
                  d?.versionCurrent && (
                    <span className="mbt-badge mbt-badge--plays">{d.versionCurrent}</span>
                  )
                )}
              </div>
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
          </>
        );

        const cls = `mbt-card mbt-admin__health mbt-admin__health--${state}`;

        // Only the update state does anything when pressed, and only then is
        // it a button. A div with a click handler that sometimes works is
        // how you teach people not to try.
        if (!update) return <div className={cls}>{inner}</div>;

        return (
          <button
            className={cls}
            title={`${update.current} -> ${update.latest}`}
            onClick={() => {
              const invoke = (window as any).invokeNative;
              // A plain target=_blank does nothing in CEF: there is no
              // browser to open a tab in. openUrl raises FiveM's own
              // "you are leaving" step.
              if (typeof invoke === "function") invoke("openUrl", update.url);
              else window.open(update.url, "_blank", "noreferrer");
            }}
          >
            {inner}
          </button>
        );
      })()}
    </div>
    </div>
  );
}
