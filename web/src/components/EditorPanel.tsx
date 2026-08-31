import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  MapPin,
  Plus,
  Trash2,
  Save,
  X,
  Smile,
  Move,
  Users,
  Armchair,
  Pencil,
  ChevronLeft,
  UserPlus,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Navigation,
  SearchX,
  LayoutGrid,
  Compass,
} from "lucide-react";
import { useLocale } from "../utils/locale";
import { useNui } from "../utils/useNui";
import { useVirtualGrid } from "../utils/useVirtualGrid";
import { SearchBar } from "./SearchBar";
import { AnimatedNumber } from "./AnimatedNumber";
import { EmptyState } from "./EmptyState";
import { KeyHint } from "./Kbd";
import { emitToast } from "./Toast";
import type { AdminInfo, EditorState, Scene, WorldPos } from "../utils/types";

/**
 * The scene editor is a VIEW OF THE MENU, not a second panel: EditorBody
 * renders inside `.mbt-menu` where the browse view would be, and the emote
 * picker IS the browse view. Shell, header, cards, scrolling and focus are the
 * menu's own and cannot drift from it.
 *
 * Two levels, because they answer different questions:
 *
 *   hub    what exists on this server, and is the install healthy. Reached by
 *          the shield in the header. It is the browse view for scenes — the
 *          same search, tabs, count row, virtual grid and empty states the
 *          catalog uses, because a server with eighty scenes needs exactly
 *          what a catalog with eighteen hundred emotes needed.
 *   scene  one scene being built. Reached by opening or creating one.
 *
 * `EditorBar` is the only piece outside the menu: while positioning, the menu
 * is closed because the player needs the game's controls.
 */

// ── Positioning: the world owns input, so nothing here is clickable ─────────
export function EditorBar({ state }: { state: EditorState }) {
  const t = useLocale();
  if (!state.active || !state.scene || state.phase !== "placing") return null;

  // The emote used to float over the ped in the game's own font. It says the
  // same thing here, in the panel's type, next to the actor number it belongs
  // to -- and the world is left to show the pose instead of describing it.
  const placing = state.scene.marks?.[state.selected - 1];
  const doing = placing?.label || placing?.emote || null;

  return (
    <div className="mbt-place">
      <div className="mbt-place__bar">
        <div className="mbt-place__id">
          <span className="mbt-place__title">
            <MapPin size={15} />
            {state.scene.label || t.editor_untitled || "Untitled scene"}
          </span>
          <span className="mbt-place__count">
            {(t.editor_placing_actor || "Placing actor %s").replace("%s", String(state.selected))}
            {doing && <b className="mbt-place__doing">{doing}</b>}
          </span>
        </div>

        <div className="mbt-place__keys">
          <KeyHint size="lg" intent="go" keys={["E"]} label={t.editor_confirm_pose || "Confirm the pose"} />
          <KeyHint
            size="lg"
            keys={["\u2190", "\u2191", "\u2193", "\u2192"]}
            label={t.editor_adjust_pose || "Adjust the pose"}
          />
          <KeyHint size="lg" keys={["\u2195"]} label={t.editor_rotate || "Rotate"} />
          <KeyHint size="lg" keys={["PgUp", "PgDn"]} label={t.editor_height || "Height"} />
          <KeyHint size="lg" keys={["\u21e7"]} label={t.editor_fast || "Faster"} />
          <KeyHint size="lg" intent="off" keys={["\u232b"]} label={t.cancel || "Cancel"} />
        </div>
      </div>
    </div>
  );
}

// ── Shared bits ────────────────────────────────────────────────────────────
type SceneKind = "spot" | "seats" | "scene";

function kindOf(s: Scene): SceneKind {
  // One mark is a spot whatever the row says: the type only becomes a real
  // choice once there is more than one place to stand.
  if ((s.marks?.length ?? 0) <= 1) return "spot";
  return s.type === "scene" ? "scene" : "seats";
}

function kindIcon(k: SceneKind, size = 18) {
  if (k === "scene") return <Users size={size} />;
  if (k === "seats") return <Armchair size={size} />;
  return <MapPin size={size} />;
}

/** Metres to the closest mark — a scene is "here" if any of its actors is. */
function distanceTo(s: Scene, at: WorldPos | null): number | null {
  if (!at || !s.marks?.length) return null;
  let best = Infinity;
  for (const m of s.marks) {
    const dx = m.x - at.x;
    const dy = m.y - at.y;
    const dz = m.z - at.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < best) best = d;
  }
  return Number.isFinite(best) ? best : null;
}

function formatDistance(d: number): string {
  return d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d)} m`;
}

// ── Hub: the browse view for scenes ────────────────────────────────────────
function Hub({
  scenes,
  adminInfo,
  playerPos,
}: {
  scenes: Scene[];
  adminInfo: AdminInfo | null;
  playerPos: WorldPos | null;
}) {
  const t = useLocale();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | SceneKind>("all");
  const [nearestFirst, setNearestFirst] = useState(false);
  // Two pieces of state, because the modal plays its exit animation after the
  // answer: the Toast/list-creator pattern this UI already uses.
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmClosing, setConfirmClosing] = useState(false);
  const confirmScene = scenes.find((sc) => sc.id === confirmId) || null;

  const closeConfirm = () => {
    setConfirmClosing(true);
    setTimeout(() => {
      setConfirmId(null);
      setConfirmClosing(false);
    }, 160);
  };
  const d = adminInfo?.diagnostics;
  const update = adminInfo?.update;

  // Everything the list needs, computed once: kind, distance, and the search
  // haystack. Recomputing distance inside the sort comparator would call it
  // O(n log n) times against a position that ticks four times a second.
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = scenes.map((s) => ({
      scene: s,
      kind: kindOf(s),
      dist: distanceTo(s, playerPos),
    }));

    if (tab !== "all") out = out.filter((r) => r.kind === tab);
    if (q) out = out.filter((r) => r.scene.label.toLowerCase().includes(q));

    out.sort((a, b) => {
      if (nearestFirst) {
        // A scene with no known distance sinks rather than claiming to be at
        // the player's feet.
        const da = a.dist ?? Infinity;
        const db = b.dist ?? Infinity;
        if (da !== db) return da - db;
      }
      return a.scene.label.localeCompare(b.scene.label);
    });

    return out;
  }, [scenes, search, tab, nearestFirst, playerPos]);

  const counts = useMemo(() => {
    const c = { spot: 0, seats: 0, scene: 0 };
    for (const s of scenes) c[kindOf(s)]++;
    return c;
  }, [scenes]);

  const { setContainerRef, totalHeight, startIndex, endIndex, offsetY } = useVirtualGrid({
    // Same geometry as the emote grid: 66px row + 1px borders + 6px gap.
    totalItems: rows.length,
    rowHeight: 74,
    columns: 1,
    overscan: 4,
  });

  const tabs: Array<{ key: "all" | SceneKind; label: string; icon: ReactNode; count: number }> = [
    { key: "all", label: t.editor_tab_all || "All", icon: <LayoutGrid size={13} />, count: scenes.length },
    { key: "spot", label: t.editor_tab_spots || "Spots", icon: <MapPin size={13} />, count: counts.spot },
    { key: "seats", label: t.editor_tab_seats || "Seats", icon: <Armchair size={13} />, count: counts.seats },
    { key: "scene", label: t.editor_tab_scenes || "Scenes", icon: <Users size={13} />, count: counts.scene },
  ];

  return (
    <>
      <SearchBar
        value={search}
        onChange={setSearch}
        resultCount={rows.length}
        totalCount={scenes.length}
        placeholder={t.editor_search || "Search scenes..."}
      />

      <div className="mbt-tabs">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            className={`mbt-tab ${tab === tb.key ? "mbt-tab--active" : ""}`}
            onClick={() => setTab(tb.key)}
          >
            {tb.icon}
            <span>{tb.label}</span>
            <span className="mbt-tab__count">{tb.count}</span>
          </button>
        ))}
      </div>

      <div className="mbt-resultbar">
        <span className="mbt-resultbar__count">
          <AnimatedNumber value={rows.length} className="mbt-resultbar__num" />{" "}
          {t.editor_resultbar || "scenes"}
        </span>

        <div className="mbt-resultbar__tools">
          <button
            className={`mbt-sortbtn ${nearestFirst ? "mbt-sortbtn--open" : ""}`}
            onClick={() => setNearestFirst((v) => !v)}
            // Sorting beats a radius filter here: standing 60 m from everything
            // would empty a "nearby" list, while "nearest first" still answers
            // the question the admin actually has.
            disabled={!playerPos}
            title={t.editor_sort_near_hint || "Sort by distance from you"}
          >
            <Compass size={13} />
            <span>{t.editor_sort_near || "Nearest first"}</span>
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mbt-grid--empty">
          {scenes.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title={t.editor_no_scenes || "Nothing placed yet"}
              hint={t.editor_none_hint || "Create the first one, then add actors to it."}
              arrowDirection="up"
              arrowLabel={t.editor_new || "New scene"}
            />
          ) : (
            <EmptyState
              icon={SearchX}
              title={t.editor_no_match || "No scene matches"}
              hint={t.editor_no_match_hint || "Try another name, or another tab."}
              arrowDirection="up"
              arrowLabel={t.no_emotes_arrow || "Search above"}
            />
          )}
        </div>
      ) : (
        <div className="mbt-grid" ref={setContainerRef}>
          <div style={{ height: totalHeight, pointerEvents: "none" }} />
          <div
            className="mbt-grid__virtual"
            style={{ transform: `translateY(${offsetY - totalHeight}px)` }}
          >
            {rows.slice(startIndex, endIndex).map(({ scene: sc, kind, dist }) => (
              <div
                key={sc.id}
                className={`mbt-card mbt-editor__scene mbt-editor__scene--${kind}`}
                onClick={() => useNui("editorOpen", { scene: sc })}
              >
                <div className="mbt-card__row">
                  <div className="mbt-card__name">
                    <span className="mbt-card__disc">{kindIcon(kind)}</span>
                    <span className="mbt-card__text">
                      <span className="mbt-card__label">{sc.label}</span>
                      <span className="mbt-card__sub">
                        <span className="mbt-card__cmd">
                          {kind === "scene"
                            ? (t.editor_kind_scene_short || "Scene · %s roles").replace(
                                "%s",
                                String(sc.marks?.length ?? 0),
                              )
                            : kind === "seats"
                              ? (t.editor_kind_seats_short || "Seats · %s").replace(
                                  "%s",
                                  String(sc.marks?.length ?? 0),
                                )
                              : t.editor_kind_spot_short || "Spot"}
                        </span>
                      </span>
                    </span>
                  </div>

                  <div className="mbt-card__meta">
                    {dist != null && <span className="mbt-badge mbt-badge--plays">{formatDistance(dist)}</span>}
                  </div>

                  <div className="mbt-card__actions">
                    <button
                      className="mbt-editor__act"
                      title={t.editor_goto || "Teleport here"}
                      onClick={(e) => {
                        e.stopPropagation();
                        useNui("editorGoto", { id: sc.id });
                      }}
                    >
                      <Navigation size={14} />
                    </button>
                    <button
                      className="mbt-editor__act"
                      title={t.editor_edit || "Edit"}
                      onClick={(e) => {
                        e.stopPropagation();
                        useNui("editorOpen", { scene: sc });
                      }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="mbt-editor__act mbt-editor__act--off"
                      title={t.editor_delete_scene || "Delete"}
                      onClick={(e) => {
                        e.stopPropagation();
                        // It asks. Arming a button on the first click and
                        // destroying on the second reads as one click doing
                        // nothing, and this cannot be undone.
                        setConfirmClosing(false);
                        setConfirmId(sc.id ?? null);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmScene && (
        <div
          className={`mbt-modal-overlay ${confirmClosing ? "mbt-modal-overlay--closing" : ""}`}
          onClick={closeConfirm}
        >
          <div className="mbt-modal mbt-modal--small" onClick={(e) => e.stopPropagation()}>
            <div className="mbt-modal__header">
              <span className="mbt-modal__title">{t.editor_delete_title || "Delete this scene?"}</span>
              <button className="mbt-modal__btn-close" onClick={closeConfirm} title={t.btn_cancel || "Cancel"}>
                <X size={14} />
              </button>
            </div>
            <p className="mbt-modal__desc">
              {(t.editor_delete_body ||
                "%s and its actors are removed for everyone on this server. This cannot be undone.").replace(
                "%s",
                confirmScene.label,
              )}
            </p>
            <div className="mbt-modal__actions">
              <button className="mbt-modal__btn mbt-modal__btn--cancel" onClick={closeConfirm}>
                {t.btn_cancel || "Cancel"}
              </button>
              <button
                className="mbt-modal__btn mbt-modal__btn--danger"
                onClick={() => {
                  useNui("editorDelete", { id: confirmScene.id });
                  closeConfirm();
                }}
              >
                {t.editor_delete_scene || "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Install state, pinned. It is reference — an admin consults it once and
          then never again — so it must not push the scenes out of view.

          One card, three states, built from .mbt-card like every row above it.
          The version you run and whether it is current are the same fact about
          the same thing (mbt_malisling's rail plate makes the same argument),
          so an update recolours this card rather than adding a second one. */}
      <div className="mbt-editor__status">
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
                    <ExternalLink size={14} className="mbt-editor__healthgo" />
                  ) : (
                    d?.versionCurrent && (
                      <span className="mbt-badge mbt-badge--plays">{d.versionCurrent}</span>
                    )
                  )}
                </div>
              </div>

              {d && (
                <div className="mbt-editor__facts">
                  <span className="mbt-editor__fact">
                    <b>{d.rpemotesVersion}</b>
                    <small>{t.admin_diag_rpemotes || "rpemotes"}</small>
                  </span>
                  <span className="mbt-editor__fact">
                    <b>{d.catalogCount}</b>
                    <small>{t.admin_diag_catalog || "Catalog"}</small>
                  </span>
                  <span className="mbt-editor__fact">
                    <b>{d.framework}</b>
                    <small>{t.admin_diag_framework || "Framework"}</small>
                  </span>
                </div>
              )}
            </>
          );

          const cls = `mbt-card mbt-editor__health mbt-editor__health--${state}`;

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
    </>
  );
}

// ── One scene ──────────────────────────────────────────────────────────────
export function EditorBody({
  state,
  scenes,
  adminInfo,
  playerPos,
  onPick,
}: {
  state: EditorState;
  scenes: Scene[];
  adminInfo: AdminInfo | null;
  playerPos: WorldPos | null;
  onPick: () => void;
}) {
  const t = useLocale();
  const [label, setLabel] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [confirmExit, setConfirmExit] = useState(false);
  const labelRef = useRef<HTMLInputElement>(null);

  const sceneId = state.scene?.id;
  const marks = state.scene?.marks ?? [];

  useEffect(() => {
    setLabel(state.scene?.label ?? "");
  }, [sceneId, state.scene?.marks?.length, state.active]);

  // Local state drives the text fields: Lua does not echo them back, and a
  // round trip per keystroke would fight the caret. Resync only when the actor
  // list changes shape — exactly when removing an actor would otherwise leave
  // the rows below it showing the previous row's role.
  useEffect(() => {
    setRoles(marks.map((m) => m.role ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId, marks.length, state.active]);

  useEffect(() => {
    if (!state.active) setConfirmExit(false);
  }, [state.active]);

  if (!state.scene) return <Hub scenes={scenes} adminInfo={adminInfo} playerPos={playerPos} />;

  const isMulti = marks.length > 1;
  const kind = state.scene.type === "scene" ? "scene" : "seats";
  const incomplete = marks.filter((m) => !m.emote).length;

  const commitLabel = (value: string) => {
    setLabel(value);
    useNui("editorSetField", { field: "label", value });
  };

  const save = async () => {
    const res = await useNui<{ ok?: boolean; error?: string }>("editorSave", {});
    if (res && res.ok === false && res.error) emitToast(res.error, "error");
  };

  const back = () => {
    if (state.dirty && !confirmExit) {
      setConfirmExit(true);
      return;
    }
    useNui("editorCloseScene", {});
  };

  return (
    <div className="mbt-editor__body">
      <button className="mbt-editor__back" onClick={back}>
        <ChevronLeft size={14} />
        <span>{confirmExit ? t.editor_discard_q || "Discard changes?" : t.editor_all_scenes || "All scenes"}</span>
      </button>

      {/* One sentence saying what to do next, rather than a manual. It changes
          with the state, so it is always about the step in front of you. */}
      <div className="mbt-active-banner mbt-editor__lead">
        {marks.length === 0
          ? t.editor_step_first || "Add an actor: pick its emote, then walk it into place."
          : incomplete > 0
            ? t.editor_step_finish || "Finish the actors that still need an emote."
            : !label
              ? t.editor_step_name || "Give it a name, then save."
              : t.editor_step_ready || "Ready to save. Add more actors if you need them."}
      </div>

      <label className="mbt-editor__field">
        <span className="mbt-list-creator__label">{t.editor_scene_name || "Name"}</span>
        <input
          className="mbt-list-creator__input"
          ref={labelRef}
          value={label}
          maxLength={48}
          placeholder={t.editor_name_hint || "Bar counter, Wedding altar..."}
          onChange={(e) => commitLabel(e.target.value)}
        />
        <span className="mbt-editor__hint">
          {t.editor_name_help || "Players read this when they walk up to it."}
        </span>
      </label>

      {isMulti && (
        <div className="mbt-editor__field">
          <span className="mbt-list-creator__label">{t.editor_kind || "Type"}</span>
          <div className="mbt-seg">
            {[
              { v: "seats", label: t.editor_kind_seats || "Seats" },
              { v: "scene", label: t.editor_kind_scene || "Scene" },
            ].map((o) => (
              <button
                key={o.v}
                className={`mbt-seg__btn ${kind === o.v ? "mbt-seg__btn--on" : ""}`}
                onClick={() => useNui("editorSetField", { field: "kind", value: o.v })}
              >
                {o.label}
              </button>
            ))}
          </div>
          <span className="mbt-editor__hint">
            {kind === "seats"
              ? t.editor_kind_seats_hint || "Anyone can take a free one, like stools at a bar."
              : t.editor_kind_scene_hint || "Filled together on a countdown, each with its own role."}
          </span>
        </div>
      )}

      <div className="mbt-editor__label">
        {t.editor_actors || "Actors"}
        {incomplete > 0 && (
          <span className="mbt-editor__warn">
            <AlertTriangle size={12} />
            {(t.editor_incomplete || "%s without emote").replace("%s", String(incomplete))}
          </span>
        )}
      </div>

      {isMulti && (
        <span className="mbt-editor__hint">
          {t.editor_actors_help ||
            "The text on an actor is what a player reads for that spot. Leave it empty and they see only the scene name."}
        </span>
      )}

      {marks.length === 0 ? (
        <div className="mbt-editor__blank">
          <EmptyState
            icon={UserPlus}
            title={t.editor_first_actor || "No actors yet"}
            hint={t.editor_first_actor_hint || "An actor is one person, standing in one place, doing one emote."}
            arrowDirection="down"
            arrowLabel={t.editor_add_actor || "Add an actor"}
          />
        </div>
      ) : (
        <div className="mbt-editor__list">
          {marks.map((m, i) => {
            const n = i + 1;
            const sel = n === state.selected;
            return (
              <div
                key={n}
                className={`mbt-card mbt-editor__actor ${sel ? "mbt-editor__actor--on" : ""} ${
                  m.emote ? "" : "mbt-editor__actor--warn"
                }`}
                onClick={() => useNui("editorSelectMark", { index: n })}
              >
                <div className="mbt-card__row">
                  <div className="mbt-card__name">
                    <span className="mbt-card__disc mbt-editor__num">{n}</span>
                    <span className="mbt-card__text">
                      <span className="mbt-card__label">
                        {m.label || m.emote || t.editor_assign_emote || "Pick emote"}
                      </span>
                      <span className="mbt-card__sub">
                        {/* Which emote this is stays on the row whatever else
                            happens: it is what tells two rows apart, and the
                            field used to take its place. */}
                        <span className="mbt-card__cmd">
                          {m.emote || t.editor_assign_emote || "Pick emote"}
                        </span>

                        {/* The scene name is the name of the PLACE. This is
                            what THIS actor is, and a bench needs it as much as
                            a wedding does: two seats can be two different
                            animations. Same stored field either way, because it
                            is the same thing -- a scene hands it to an invited
                            player as their role, a bench uses it to say which
                            seat you are walking up to. */}
                        {isMulti && (
                          <input
                            className="mbt-editor__role"
                            value={roles[i] ?? ""}
                            maxLength={24}
                            placeholder={
                              kind === "scene"
                                ? t.editor_role_placeholder || "Role"
                                : t.editor_seat_placeholder || "Sit, Lean..."
                            }
                            onChange={(ev) => {
                              const v = ev.target.value;
                              setRoles((prev) => {
                                const next = [...prev];
                                next[i] = v;
                                return next;
                              });
                              useNui("editorSetField", { field: "role", index: n, value: v });
                            }}
                            onClick={(ev) => ev.stopPropagation()}
                          />
                        )}
                      </span>
                    </span>
                  </div>

                  {/* Actions belong on the row they act on. Selecting first is
                      what makes that true: the Lua side works on the selected
                      actor, so the click sets it before it asks for anything. */}
                  <div className="mbt-card__actions">
                    <button
                      className="mbt-editor__act"
                      title={t.editor_change_emote || "Change emote"}
                      onClick={async (e) => {
                        e.stopPropagation();
                        await useNui("editorSelectMark", { index: n });
                        onPick();
                      }}
                    >
                      <Smile size={14} />
                    </button>
                    <button
                      className="mbt-editor__act"
                      title={t.editor_move_actor || "Move this actor"}
                      onClick={(e) => {
                        e.stopPropagation();
                        useNui("editorPreview", { index: n });
                      }}
                    >
                      <Move size={14} />
                    </button>
                    <button
                      className="mbt-editor__act mbt-editor__act--off"
                      title={t.editor_remove_mark || "Remove actor"}
                      onClick={(e) => {
                        e.stopPropagation();
                        useNui("editorRemoveMark", { index: n });
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mbt-editor__foot">
        <button
          className="mbt-modal__btn mbt-modal__btn--cancel mbt-editor__add"
          onClick={() => useNui("editorPlaceMode", { replace: false })}
        >
          <Plus size={14} />
          <span>{t.editor_add_actor || "Add an actor"}</span>
        </button>
        <button
          className="mbt-modal__btn mbt-modal__btn--confirm"
          onClick={save}
          disabled={marks.length === 0 || !label || incomplete > 0}
        >
          <Save size={14} />
          <span>{t.editor_save || "Save scene"}</span>
        </button>
        <button
          className="mbt-modal__btn mbt-modal__btn--cancel mbt-editor__quit"
          onClick={() => useNui("editorExit", {})}
          title={t.editor_exit || "Exit editor"}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
