import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Upload, Download } from "lucide-react";
import { useLocale } from "../utils/locale";
import type { MenuConfig } from "../utils/types";

interface HeaderMenuProps {
  config: MenuConfig;
  onSavePref: (key: string, value: unknown) => void;
  showFavoritesData: boolean;
  onExport: () => void;
  onImport: () => void;
}

/** Two-option segmented control. */
function Segment({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="mbt-seg">
      {options.map((o) => (
        <button
          key={o.value}
          className={`mbt-seg__btn ${value === o.value ? "mbt-seg__btn--on" : ""}`}
          onClick={() => value !== o.value && onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** On/off pill switch. */
function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      className={`mbt-switch ${on ? "mbt-switch--on" : ""}`}
      onClick={onToggle}
      role="switch"
      aria-checked={on}
    >
      <span className="mbt-switch__knob" />
    </button>
  );
}

/**
 * Header "..." settings popover. Hosts per-player preferences (layout,
 * position, performance, language, close-on-play) and the favorites
 * Import/Export actions. Every change is persisted Lua-side via onSavePref,
 * which hands back a fresh config the parent re-applies.
 */
export function HeaderMenu({
  config,
  onSavePref,
  showFavoritesData,
  onExport,
  onImport,
}: HeaderMenuProps) {
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

  const langs = config.languages || [];

  return (
    <div className="mbt-headermenu" ref={wrapRef}>
      <button
        className={`mbt-header__close mbt-headermenu__btn ${open ? "mbt-headermenu__btn--open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title={t.settings_title || t.tooltip_more || "Settings"}
      >
        <MoreHorizontal size={14} />
      </button>

      {open && (
        <div className="mbt-sortpop mbt-settings__pop">
          {/* Appearance */}
          <div className="mbt-settings__group">
            <div className="mbt-settings__label">
              {t.settings_appearance || "Appearance"}
            </div>

            {config.allowLayoutSwitch !== false && (
              <div className="mbt-settings__row">
                <span>{t.settings_layout || "Layout"}</span>
                <Segment
                  value={config.layout || "default"}
                  options={[
                    { value: "default", label: t.settings_layout_default || "Standard" },
                    { value: "cinematic", label: t.settings_layout_cinematic || "Cinematic" },
                  ]}
                  onChange={(v) => onSavePref("layout", v)}
                />
              </div>
            )}

            <div className="mbt-settings__row">
              <span>{t.settings_position || "Side"}</span>
              <Segment
                value={config.position}
                options={[
                  { value: "left", label: t.settings_position_left || "Left" },
                  { value: "right", label: t.settings_position_right || "Right" },
                ]}
                onChange={(v) => onSavePref("position", v)}
              />
            </div>

            {config.allowAccentChange !== false &&
              (config.accents?.length ?? 0) > 0 && (
                <div className="mbt-settings__row">
                  <span>{t.settings_accent || "Accent"}</span>
                  <div className="mbt-accents">
                    {config.accents!.map((a) => (
                      <button
                        key={a.hex}
                        className={`mbt-accent-dot ${config.theme?.Accent === a.hex ? "mbt-accent-dot--on" : ""}`}
                        style={{ background: `#${a.hex}` }}
                        title={a.label}
                        onClick={() =>
                          config.theme?.Accent !== a.hex && onSavePref("accent", a.hex)
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
          </div>

          {/* Behavior */}
          <div className="mbt-settings__group">
            <div className="mbt-settings__label">
              {t.settings_behavior || "Behavior"}
            </div>

            <div className="mbt-settings__row">
              <span title={t.settings_performance_hint || "Disable visual effects for more FPS"}>
                {t.settings_performance || "Performance mode"}
              </span>
              <Switch
                on={!!config.performanceMode}
                onToggle={() => onSavePref("performanceMode", !config.performanceMode)}
              />
            </div>

            <div className="mbt-settings__row">
              <span>{t.settings_closeonplay || "Close on play"}</span>
              <Switch
                on={config.closeOnPlay !== false}
                onToggle={() => onSavePref("closeOnPlay", !(config.closeOnPlay !== false))}
              />
            </div>

            {config.features?.EmoteWheel && (
              <div className="mbt-settings__row">
                <span>{t.settings_wheel || "Emote wheel"}</span>
                <Segment
                  value={config.wheelMode || "radial"}
                  options={[
                    { value: "radial", label: t.settings_wheel_radial || "Radial" },
                    { value: "linear", label: t.settings_wheel_linear || "Linear" },
                  ]}
                  onChange={(v) => onSavePref("wheelMode", v)}
                />
              </div>
            )}

            {langs.length > 1 && (
              <div className="mbt-settings__row mbt-settings__row--col">
                <span>{t.settings_language || "Language"}</span>
                <div className="mbt-langs">
                  {langs.map((l) => (
                    <button
                      key={l.code}
                      className={`mbt-lang ${config.language === l.code ? "mbt-lang--on" : ""}`}
                      onClick={() => config.language !== l.code && onSavePref("language", l.code)}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Data */}
          {showFavoritesData && (
            <div className="mbt-settings__group">
              <div className="mbt-settings__label">{t.settings_data || "Data"}</div>
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
      )}
    </div>
  );
}
