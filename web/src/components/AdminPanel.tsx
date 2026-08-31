import { ShieldCheck } from "lucide-react";
import { useLocale } from "../utils/locale";
import { useNui } from "../utils/useNui";
import type { AdminInfo } from "../utils/types";

/**
 * The owner's entry point: one header button that opens the scene editor.
 *
 * It used to be a popover holding the update notice, the diagnostics and a
 * button that opened the editor somewhere else. That is two places to look for
 * one subject. Everything the owner needs now lives inside the editor itself,
 * and this is the door to it.
 *
 * The button renders only when the server sent an admin payload, and the server
 * only sends one to a player holding the ACE. No client-side flag decides this:
 * an ordinary player never receives the data at all.
 */
export function AdminPanel({ adminInfo }: { adminInfo: AdminInfo | null }) {
  const t = useLocale();
  if (!adminInfo) return null;

  return (
    <button
      className={`mbt-header__close mbt-adminmenu__btn ${
        adminInfo.update ? "mbt-adminmenu__btn--flag" : ""
      }`}
      onClick={() => useNui("editorOpen", {})}
      title={t.editor_title || "Scene editor"}
    >
      <ShieldCheck size={14} />
    </button>
  );
}
