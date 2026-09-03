import { useEffect, useRef, useState } from "react";
import { MapPin, Settings, ShieldCheck } from "lucide-react";
import { useLocale } from "../utils/locale";
import { useNui } from "../utils/useNui";
import type { AdminInfo } from "../utils/types";

/**
 * The owner's entry point: one header button that asks where you are going.
 *
 * It was a popover once, holding the update notice and the diagnostics inline,
 * and that was wrong for a different reason -- it put the information somewhere
 * other than its subject. This one holds no information at all. It chooses a
 * destination, and the destination renders in the container like the scene
 * editor already does.
 *
 * The button renders only when the server sent an admin payload, and the server
 * only sends one to a player holding the ACE. No client-side flag decides this:
 * an ordinary player never receives the data at all.
 */
export function AdminPanel({
  adminInfo,
  onOpenSettings,
}: {
  adminInfo: AdminInfo | null;
  onOpenSettings: (on: boolean) => void;
}) {
  const t = useLocale();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  if (!adminInfo) return null;

  return (
    <div className="mbt-headermenu" ref={wrapRef}>
      <button
        className={`mbt-header__close mbt-adminmenu__btn ${
          open ? "mbt-headermenu__btn--open" : ""
        } ${adminInfo.update ? "mbt-adminmenu__btn--flag" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title={t.admin_title || "Server"}
      >
        <ShieldCheck size={14} />
      </button>

      {open && (
        <div className="mbt-sortpop mbt-settings__pop mbt-adminmenu__pop">
          <div className="mbt-settings__group">
            <div className="mbt-settings__label">{t.admin_title || "Server"}</div>

            <button
              className="mbt-sortpop__item mbt-sortpop__item--action"
              onClick={() => {
                setOpen(false);
                onOpenSettings(false);
                useNui("editorOpen", {});
              }}
            >
              <MapPin size={14} className="mbt-sortpop__lead" />
              <span>{t.editor_title || "Scene editor"}</span>
            </button>

            <button
              className="mbt-sortpop__item mbt-sortpop__item--action"
              onClick={() => {
                setOpen(false);
                onOpenSettings(true);
              }}
            >
              <Settings size={14} className="mbt-sortpop__lead" />
              <span>{t.admin_settings || "Settings"}</span>
              {/* The only thing in here that can be urgent. It rides the row
                  it belongs to instead of a second badge on the shield. */}
              {adminInfo.update && <i className="mbt-sortpop__dot" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
