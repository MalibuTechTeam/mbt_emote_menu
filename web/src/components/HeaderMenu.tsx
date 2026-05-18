import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Upload, Download } from "lucide-react";
import { useLocale } from "../utils/locale";

interface HeaderMenuProps {
  onExport: () => void;
  onImport: () => void;
}

/**
 * Header overflow ("...") menu — hosts the favorites Import/Export
 * actions. Rendered only when `features.Favorites` is on (gated by the
 * caller). "New list" is its own dedicated header button, not here.
 */
export function HeaderMenu({ onExport, onImport }: HeaderMenuProps) {
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

  return (
    <div className="mbt-headermenu" ref={wrapRef}>
      <button
        className={`mbt-header__close mbt-headermenu__btn ${open ? "mbt-headermenu__btn--open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title={t.tooltip_more || "More"}
      >
        <MoreHorizontal size={14} />
      </button>

      {open && (
        <div className="mbt-sortpop mbt-headermenu__pop">
          <button
            className="mbt-sortpop__item mbt-sortpop__item--action"
            onClick={() => {
              onExport();
              setOpen(false);
            }}
          >
            <Upload size={14} className="mbt-sortpop__lead" />
            <span>{t.tooltip_export_favorites || "Export favorites"}</span>
          </button>
          <button
            className="mbt-sortpop__item mbt-sortpop__item--action"
            onClick={() => {
              onImport();
              setOpen(false);
            }}
          >
            <Download size={14} className="mbt-sortpop__lead" />
            <span>{t.tooltip_import_favorites || "Import favorites"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
