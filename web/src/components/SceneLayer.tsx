import { useEffect, useRef, useState } from "react";
import { MapPin, Users, Navigation2, AlertTriangle } from "lucide-react";
import { useLocale, tFormat } from "../utils/locale";
import { Kbd, KeyHint } from "./Kbd";
import { emitToast } from "./Toast";

type Phase = "idle" | "invited" | "assigned" | "countdown";

interface MarkNav {
  onScreen: boolean;
  x: number;
  y: number;
  dist: number;
  inRange: boolean;
  bearing: number;
}

/**
 * Everything a player sees for an authored spot or scene.
 *
 * Nothing here is clickable, and that is the design, not an omission. A card
 * with buttons needs SetNuiFocus, which takes the mouse and keyboard away from
 * a player who is in the middle of walking to a mark. The proximity pill
 * already showed the right register for this: name the key, let the game keep
 * the input. Lua owns every action; this only renders state.
 *
 * The mark is a place in the world, so finding it is a navigation problem, not
 * a labelling one: a ring on the ground says nothing when it is twenty metres
 * behind you. The pin follows it while it is on screen, an edge arrow points
 * at it when it is not, and the distance is always readable.
 */
export function SceneLayer({ layout }: { layout?: "default" | "cinematic" }) {
  const t = useLocale();
  const [prompt, setPrompt] = useState<{
    visible: boolean;
    label: string;
    key: string;
    isScene: boolean;
    occupied: boolean;
    /** Name of the seat being walked up to, when the author gave it one. */
    mark: string | null;
    seats: number | null;
  }>({ visible: false, label: "", key: "E", isScene: false, occupied: false, mark: null, seats: null });

  const [phase, setPhase] = useState<Phase>("idle");
  const [role, setRole] = useState<string | null>(null);
  const [sceneLabel, setSceneLabel] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [ready, setReady] = useState(false);
  const [nav, setNav] = useState<MarkNav | null>(null);
  const [tooFar, setTooFar] = useState(false);
  const [count, setCount] = useState(0);
  const [progress, setProgress] = useState({ roles: 0, players: 0, ready: 0, pending: 0 });
  const tooFarTimer = useRef<number | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      switch (data.action) {
        case "venueShow":
          setPrompt({
            visible: true,
            label: data.label || "",
            key: data.key || "E",
            isScene: data.isScene === true,
            occupied: data.occupied === true,
            mark: typeof data.mark === "string" && data.mark ? data.mark : null,
            seats: typeof data.seats === "number" ? data.seats : null,
          });
          break;

        case "venueHide":
          setPrompt((s) => ({ ...s, visible: false }));
          break;

        case "sceneInvite":
          setPhase("invited");
          setRole(data.role || null);
          setSceneLabel(data.label || "");
          setIsHost(false);
          setReady(false);
          break;

        case "sceneAssigned":
          setPhase("assigned");
          setRole(data.role || null);
          setSceneLabel(data.label || "");
          setIsHost(data.host === true);
          setReady(false);
          break;

        case "sceneReassigned":
          emitToast(t.scene_reassigned || "That role was taken — you have another", "info");
          break;

        case "sceneReadyState":
          setReady(data.ready === true);
          break;

        case "sceneTooFar":
          // The old build refused silently, which reads as a broken button.
          setTooFar(true);
          if (tooFarTimer.current) window.clearTimeout(tooFarTimer.current);
          tooFarTimer.current = window.setTimeout(() => setTooFar(false), 2200);
          break;

        case "sceneMark":
          setNav({
            onScreen: data.onScreen === true,
            x: typeof data.x === "number" ? data.x : 0.5,
            y: typeof data.y === "number" ? data.y : 0.5,
            dist: typeof data.dist === "number" ? data.dist : 0,
            inRange: data.inRange === true,
            bearing: typeof data.bearing === "number" ? data.bearing : 0,
          });
          break;

        case "sceneProgress":
          setProgress({
            roles: data.roles ?? 0,
            players: data.players ?? 0,
            ready: data.ready ?? 0,
            pending: data.pending ?? 0,
          });
          break;

        case "sceneFull":
          emitToast(t.scene_all_taken || "Every seat here is taken", "info");
          break;

        case "sceneCountdown":
          setPhase("countdown");
          setCount(typeof data.value === "number" ? data.value : 0);
          break;

        case "sceneEnded": {
          const reasons: Record<string, string> = {
            timeout: t.scene_end_timeout || "Scene expired — not everyone was ready",
            cancelled: t.scene_end_cancelled || "Scene cancelled",
            "host-left": t.scene_end_host || "Scene ended — the host left",
            "started-without-you": t.scene_end_without || "The scene started without you",
            "role-taken": t.scene_end_role || "That role was already taken",
            "you-left": t.scene_end_you || "You left the scene",
            declined: t.scene_end_declined || "Invite declined",
          };
          if (data.reason && reasons[data.reason]) emitToast(reasons[data.reason], "info");

          setPhase("idle");
          setRole(null);
          setReady(false);
          setNav(null);
          setTooFar(false);
          setProgress({ roles: 0, players: 0, ready: 0, pending: 0 });
          break;
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [t]);

  const cls = `mbt-scene mbt-scene--${layout || "default"}`;

  // ── Countdown ────────────────────────────────────────────────────────────
  if (phase === "countdown") {
    return (
      <div className={cls}>
        <div className="mbt-scene__count">{count}</div>
        <div className="mbt-scene__hold">
          {role
            ? tFormat(t.scene_hold_role || "Hold position — %s", role)
            : t.scene_hold || "Hold position"}
        </div>
      </div>
    );
  }

  // ── Invitation ───────────────────────────────────────────────────────────
  if (phase === "invited") {
    return (
      <div className={cls}>
        <div className="mbt-scene__card">
          <div className="mbt-scene__head">
            <Users size={15} />
            <span>{t.scene_invite || "Scene invite"}</span>
            <span className="mbt-scene__name">{sceneLabel}</span>
          </div>
          {role && (
            <div className="mbt-scene__role">
              <span className="mbt-scene__rolelabel">{t.scene_your_role || "Your role"}</span>
              {role}
            </div>
          )}
          <div className="mbt-scene__keys">
            <KeyHint size="lg" intent="go" keys={["E"]} label={t.scene_join || "Join"} />
            <KeyHint size="lg" intent="off" keys={["\u232b"]} label={t.scene_decline || "Decline"} />
          </div>
        </div>
      </div>
    );
  }

  // ── Assigned: walking to the mark, then waiting ──────────────────────────
  if (phase === "assigned") {
    const solo = progress.players <= 1 && progress.pending === 0 && progress.roles > 1;

    return (
      <>
        {/* Pin over the mark while it is on screen. Positioned in Lua, which
            is the only place that knows where the mark is in 3D. */}
        {nav?.onScreen && !nav.inRange && (
          <div
            className="mbt-scene__pin"
            style={{ left: `${nav.x * 100}%`, top: `${nav.y * 100}%` }}
          >
            <MapPin size={14} />
            <span>{t.scene_your_mark || "Your mark"}</span>
            <b>{nav.dist}m</b>
          </div>
        )}

        {/* Off screen: an arrow that turns toward it. Bearing is relative to
            the camera, so 0 means straight ahead. */}
        {nav && !nav.onScreen && (
          <div className="mbt-scene__compass">
            <Navigation2 size={26} style={{ transform: `rotate(${nav.bearing}deg)` }} />
            <span>{t.scene_your_mark || "Your mark"}</span>
            <b>{nav.dist}m</b>
          </div>
        )}

        <div className={cls}>
          <div className={`mbt-scene__card ${tooFar ? "mbt-scene__card--warn" : ""}`}>
            <div className="mbt-scene__head">
              <MapPin size={15} />
              <span>{sceneLabel}</span>
            </div>

            {role && (
              <div className="mbt-scene__role">
                <span className="mbt-scene__rolelabel">{t.scene_your_role || "Your role"}</span>
                {role}
              </div>
            )}

            {tooFar ? (
              <div className="mbt-scene__alert">
                <AlertTriangle size={14} />
                {tFormat(t.scene_too_far || "Too far — %sm to your mark", String(nav?.dist ?? "?"))}
              </div>
            ) : (
              <div className="mbt-scene__status">
                {nav?.inRange
                  ? ready
                    ? t.scene_ready_hold || "Ready — hold position"
                    : t.scene_on_mark || "On your mark"
                  : tFormat(t.scene_walk || "Walk to your mark — %sm", String(nav?.dist ?? "?"))}
              </div>
            )}

            {progress.roles > 0 && (
              <div className="mbt-scene__progress">
                {tFormat(
                  t.scene_counts || "%s of %s actors · %s ready",
                  String(progress.players),
                  String(progress.roles),
                  String(progress.ready),
                )}
                {progress.pending > 0 &&
                  ` · ${tFormat(t.scene_pending || "%s invited", String(progress.pending))}`}
              </div>
            )}

            {/* The host can start alone at any moment. The old copy said
                "waiting for the others", which described a rule the server
                does not actually enforce. */}
            {solo && isHost && !ready && (
              <div className="mbt-scene__note">{t.scene_solo || "Nobody joined — you can perform alone"}</div>
            )}

            <div className="mbt-scene__keys">
              <KeyHint
                size="lg"
                intent="go"
                disabled={!nav?.inRange}
                keys={["E"]}
                label={ready ? t.scene_not_ready || "Not ready" : t.scene_ready || "Ready"}
              />
              <KeyHint
                size="lg"
                intent="off"
                keys={["\u232b"]}
                label={isHost ? t.scene_cancel || "Cancel scene" : t.scene_leave || "Leave"}
              />
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Proximity prompt ─────────────────────────────────────────────────────
  if (!prompt.visible) return null;

  return (
    <div className={cls}>
      <div className={`mbt-scene__pill ${prompt.occupied ? "mbt-scene__pill--full" : ""}`}>
        {/* An occupied spot shows no key: offering one that does nothing is
            worse than saying it is taken. */}
        {!prompt.occupied && (
          <Kbd size="lg" intent="go">
            {prompt.key}
          </Kbd>
        )}
        <span className="mbt-scene__label">{prompt.label}</span>
        {/* Which of the seats you are about to take. The claim already goes to
            the one you walked up to, so the prompt can say which that is
            instead of naming the whole bench and leaving you to guess. */}
        {!prompt.occupied && prompt.mark && (
          <span className="mbt-scene__mark">{prompt.mark}</span>
        )}
        {prompt.occupied ? (
          <span className="mbt-scene__badge">{t.scene_all_taken || "Every seat here is taken"}</span>
        ) : prompt.isScene ? (
          <span className="mbt-scene__badge">
            <Users size={12} />
            {t.scene_needs_people || "Needs people nearby"}
          </span>
        ) : prompt.seats && prompt.seats > 1 ? (
          <span className="mbt-scene__badge">
            <Users size={12} />
            {(t.scene_seats || "%s seats").replace("%s", String(prompt.seats))}
          </span>
        ) : null}
      </div>
    </div>
  );
}
