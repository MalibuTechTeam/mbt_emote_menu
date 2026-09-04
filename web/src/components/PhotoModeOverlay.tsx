import { useEffect, useRef, useState, useCallback } from 'react'
import { Aperture, Grid3x3, Send, X, Camera, Loader2, Sun, CloudSun, Lightbulb, Move3d } from 'lucide-react'
import { useLocale } from '../utils/locale'
import { useNui } from '../utils/useNui'

interface FilterDef {
  id: string
  label: string
  timecycle?: string | null
  strength?: number
}

interface WeatherDef {
  id: string
  label: string
}

type SendState = 'idle' | 'confirm' | 'sending' | 'done' | 'error'
type Tab = 'filters' | 'light' | 'scene'

/** Where the key sits relative to the camera. `custom` is not selectable: it is
 *  what the light becomes once it has been dragged off a preset. */
type KeyPos = 'front' | 'side' | 'rim' | 'custom'

/** Lua's canonical view of the light. Everything here is post-clamp. */
interface LightState {
  on: boolean
  power: number
  warmth: number
  az: number
  elev: number
  dist: number
  preset: KeyPos
}

/* Pixels to degrees and metres. Vertical gets less than horizontal because the
   elevation range is a fraction of the full turn the horizontal covers. */
const DRAG_AZ = 0.42
const DRAG_ELEV = 0.26
const WHEEL_DIST = 0.22

/* At most one request in flight, and at most one every 34 ms. The two bound
   different things and both are needed: 1000/33 would be 30.3 a second, which
   is over the budget by a whisker. */
const MIN_DISPATCH_MS = 34

/** Hours worth a one-tap preset: the light photographers actually wait for. */
const HOUR_PRESETS: Array<{ h: number; key: string; fallback: string }> = [
  { h: 6,  key: 'photo_hour_dawn',  fallback: 'Dawn' },
  { h: 12, key: 'photo_hour_noon',  fallback: 'Noon' },
  { h: 19, key: 'photo_hour_dusk',  fallback: 'Golden hour' },
  { h: 1,  key: 'photo_hour_night', fallback: 'Night' },
]

/**
 * Full-screen Photo Mode overlay. Entirely NUI-driven: a transparent
 * drag-catcher turns pointer drag into camera orbit and wheel into zoom,
 * forwarding accumulated deltas to Lua on a requestAnimationFrame loop (so we
 * never flood the NUI callback bridge with one fetch per mousemove). The
 * control bar drives filters, DOF, the rule-of-thirds grid, capture/send and
 * exit. Lua (modules/photomode) is just the camera engine behind it.
 *
 * Visibility is driven by `photoModeEntered` / `photoModeExited` messages, so
 * this layer stays mounted and cheap when Photo Mode is off.
 */
export function PhotoModeOverlay() {
  const t = useLocale()
  const [active, setActive] = useState(false)
  const [filters, setFilters] = useState<FilterDef[]>([])
  const [discord, setDiscord] = useState(false)
  const [watermark, setWatermark] = useState(true)
  const [activeFilter, setActiveFilter] = useState('none')
  const [dof, setDof] = useState(true)
  const [grid, setGrid] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [send, setSend] = useState<SendState>('idle')

  const [tab, setTab] = useState<Tab>('filters')
  const [hasLight, setHasLight] = useState(false)
  const [hasScene, setHasScene] = useState(false)
  const [weathers, setWeathers] = useState<WeatherDef[]>([])

  const [light, setLight] = useState<LightState>({
    on: false, power: 3, warmth: 0, az: 8, elev: 22, dist: 1.9, preset: 'front',
  })
  const [positioning, setPositioning] = useState(false)

  // null means "the server's own clock and sky", which is where we start and
  // where we go back to. Only an explicit choice overrides the world.
  const [hour, setHour] = useState<number | null>(null)
  const [weather, setWeather] = useState<string | null>(null)

  const pending = useRef({ ox: 0, oy: 0, z: 0, laz: 0, lelev: 0, ldist: 0, px: 0, py: 0 })
  // Which button started the drag. Right pans the framing, always -- including
  // while the light is being positioned, because they move different things.
  const panning = useRef(false)
  const rafRef = useRef<number>(0)
  const inFlight = useRef(false)
  const lastSent = useRef(0)
  // The flush loop reads this rather than the state, so a mode change lands on
  // the very next frame instead of after a re-render.
  const positioningRef = useRef(false)

  // ── NUI message wiring ──
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data
      if (!data || typeof data !== 'object') return
      switch (data.action) {
        case 'photoModeEntered':
          setActive(true)
          setFilters(Array.isArray(data.filters) ? data.filters : [])
          setDiscord(!!data.discord)
          setWatermark(data.watermark !== false)
          setDof(data.dof !== false)
          setActiveFilter('none')
          setGrid(true)
          setSend('idle')
          setTab('filters')
          setHasLight(!!data.lighting)
          setHasScene(!!data.environment)
          setWeathers(Array.isArray(data.weathers) ? data.weathers : [])
          setHour(null)
          setWeather(null)
          setPositioning(false)
          positioningRef.current = false
          if (data.light) setLight(data.light as LightState)
          break
        case 'photoModeExited':
          setActive(false)
          break
        case 'photoPrepareCapture':
          // Lua is about to grab a screenshot — drop the chrome for a clean
          // frame (watermark + letterbox stay).
          setCapturing(true)
          break
        case 'photoCaptureResult':
          setCapturing(false)
          setSend(data.ok ? 'done' : 'error')
          window.setTimeout(() => setSend('idle'), 2600)
          break
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // ── Camera delta flush loop (orbit + zoom), only while active ──
  useEffect(() => {
    if (!active) return
    let running = true

    const flush = () => {
      if (!running) return
      rafRef.current = requestAnimationFrame(flush)

      const p = pending.current
      const has = p.ox || p.oy || p.z || p.laz || p.lelev || p.ldist || p.px || p.py
      if (!has || inFlight.current) return

      const now = performance.now()
      if (now - lastSent.current < MIN_DISPATCH_MS) return

      inFlight.current = true
      lastSent.current = now

      const calls: Array<Promise<unknown>> = []

      if (p.ox !== 0 || p.oy !== 0) {
        calls.push(useNui('photoOrbit', { dx: p.ox, dy: p.oy }))
        p.ox = 0
        p.oy = 0
      }
      if (p.z !== 0) {
        calls.push(useNui('photoZoom', { delta: p.z }))
        p.z = 0
      }
      if (p.px !== 0 || p.py !== 0) {
        calls.push(useNui('photoPan', { dx: p.px, dy: p.py }))
        p.px = 0
        p.py = 0
      }
      if (p.laz !== 0 || p.lelev !== 0 || p.ldist !== 0) {
        calls.push(
          useNui<{ light?: LightState }>('photoLightMove', {
            daz: p.laz, delev: p.lelev, ddist: p.ldist,
          }).then((res) => {
            // Reconcile from what Lua HOLDS, not from what we asked for: a
            // value that hit a clamp must stop being displayed.
            if (res?.light) setLight(res.light)
          }),
        )
        p.laz = 0
        p.lelev = 0
        p.ldist = 0
      }

      Promise.all(calls).finally(() => {
        inFlight.current = false
      })
    }

    rafRef.current = requestAnimationFrame(flush)
    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [active])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 2) return
    panning.current = e.button === 2
    setDragging(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return
    const p = pending.current
    if (panning.current) {
      p.px += e.movementX
      p.py += e.movementY
    } else if (positioningRef.current) {
      p.laz += e.movementX * DRAG_AZ
      p.lelev += -e.movementY * DRAG_ELEV
    } else {
      p.ox += e.movementX
      p.oy += e.movementY
    }
  }, [dragging])

  const endDrag = useCallback((e: React.PointerEvent) => {
    setDragging(false)
    panning.current = false
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* noop */ }
  }, [])

  // A drag can end without a release: the pointer is cancelled, or capture is
  // lost. Left unhandled the flag survives and the mouse goes on moving things
  // with no button held.
  const onPointerCancel = useCallback((e: React.PointerEvent) => {
    endDrag(e)
    const p = pending.current
    p.ox = 0; p.oy = 0; p.laz = 0; p.lelev = 0; p.px = 0; p.py = 0
  }, [endDrag])

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (positioningRef.current) pending.current.ldist += -e.deltaY / 100 * WHEEL_DIST
    else pending.current.z += -e.deltaY / 100
  }, [])

  const pickFilter = useCallback((id: string) => {
    setActiveFilter(id)
    useNui('photoFilter', { id })
  }, [])

  const toggleDof = useCallback(() => {
    setDof((v) => {
      const next = !v
      useNui('photoToggleDof', { on: next })
      return next
    })
  }, [])

  // Ask, then take Lua's answer. Painting the requested value first and letting
  // the response correct it would flicker a wrong number every time a slider
  // ran into a clamp, so the only value ever displayed is the one Lua holds.
  const pushLight = useCallback(
    async (next: Partial<{ on: boolean; power: number; warmth: number; preset: KeyPos }>) => {
      const res = await useNui<{ light?: LightState }>('photoLight', next)
      if (res?.light) setLight(res.light)
    },
    [],
  )

  const togglePositioning = useCallback(() => {
    setPositioning((v) => {
      const next = !v
      positioningRef.current = next
      // Whatever was accumulated belonged to the other target. Carrying it
      // across would apply a camera drag to the light, or the reverse.
      const p = pending.current
      p.ox = 0; p.oy = 0; p.z = 0; p.laz = 0; p.lelev = 0; p.ldist = 0
      return next
    })
  }, [])

  const pushHour = useCallback((h: number | null) => {
    setHour(h)
    useNui('photoTime', h === null ? {} : { hour: h, minute: 0 })
  }, [])

  const pushWeather = useCallback((id: string | null) => {
    setWeather(id)
    useNui('photoWeather', { id: id ?? '' })
  }, [])

  const doExit = useCallback(() => {
    useNui('exitPhotoMode')
  }, [])

  const doSend = useCallback(() => {
    if (send === 'idle') { setSend('confirm'); return }
    if (send === 'confirm') {
      setSend('sending')
      useNui('photoCapture', { mode: 'discord' })
    }
  }, [send])

  if (!active) return null

  return (
    <div className={`mbt-photo ${capturing ? 'mbt-photo--capturing' : ''}`}>
      {/* Drag-catcher: orbit on drag, zoom on wheel */}
      <div
        className={`mbt-photo__stage ${dragging ? 'mbt-photo__stage--drag' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onContextMenu={(e) => e.preventDefault()}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onPointerCancel}
        onWheel={onWheel}
      />

      {/* Rule-of-thirds grid */}
      {grid && (
        <div className="mbt-photo__grid" aria-hidden="true">
          <span /><span /><span /><span />
        </div>
      )}

      {/* Cinematic letterbox bars for framing */}
      <div className="mbt-photo__bar mbt-photo__bar--top" aria-hidden="true" />
      <div className="mbt-photo__bar mbt-photo__bar--bottom" aria-hidden="true" />

      {watermark && <span className="mbt-photo__watermark">MBT</span>}

      {/* Top-right: exit */}
      <button className="mbt-photo__exit" onClick={doExit} title={t.photo_exit || 'Exit Photo Mode'}>
        <X size={16} />
      </button>

      {/* Control bar */}
      <div className="mbt-photo__controls">
        {/* Tabs swap the top row rather than stacking another one: the bar sits
            over the shot it exists to frame, so height is the scarce thing. */}
        {(hasLight || hasScene) && (
          <div className="mbt-photo__tabs">
            <button
              className={`mbt-photo__tab ${tab === 'filters' ? 'mbt-photo__tab--on' : ''}`}
              onClick={() => setTab('filters')}
            >
              <Aperture size={13} />
              <span>{t.photo_tab_filters || 'Look'}</span>
            </button>
            {hasLight && (
              <button
                className={`mbt-photo__tab ${tab === 'light' ? 'mbt-photo__tab--on' : ''}`}
                onClick={() => setTab('light')}
              >
                <Lightbulb size={13} />
                <span>{t.photo_tab_light || 'Light'}</span>
                {light.on && <i className="mbt-photo__tabdot" aria-hidden="true" />}
              </button>
            )}
            {hasScene && (
              <button
                className={`mbt-photo__tab ${tab === 'scene' ? 'mbt-photo__tab--on' : ''}`}
                onClick={() => setTab('scene')}
              >
                <CloudSun size={13} />
                <span>{t.photo_tab_scene || 'Scene'}</span>
                {(hour !== null || weather !== null) && <i className="mbt-photo__tabdot" aria-hidden="true" />}
              </button>
            )}
          </div>
        )}

        {tab === 'filters' && (
          <div className="mbt-photo__filters">
            {filters.map((f) => (
              <button
                key={f.id}
                className={`mbt-photo__filter ${activeFilter === f.id ? 'mbt-photo__filter--active' : ''}`}
                onClick={() => pickFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {tab === 'light' && hasLight && (
          <div className="mbt-photo__panel">
            <button
              className={`mbt-photo__filter ${light.on ? 'mbt-photo__filter--active' : ''}`}
              onClick={() => pushLight({ on: !light.on })}
            >
              {light.on ? t.photo_light_on || 'Light on' : t.photo_light_off || 'Light off'}
            </button>

            {/* Starting points, not the only positions. Once the light has been
                dragged it stops being any of them, and the strip says so
                instead of leaving a name highlighted that no longer fits. */}
            <div className="mbt-photo__seg">
              {(['front', 'side', 'rim'] as KeyPos[]).map((k) => (
                <button
                  key={k}
                  className={`mbt-photo__segbtn ${light.preset === k ? 'mbt-photo__segbtn--on' : ''}`}
                  disabled={!light.on}
                  onClick={() => pushLight({ preset: k })}
                >
                  {k === 'front'
                    ? t.photo_key_front || 'Front'
                    : k === 'side'
                      ? t.photo_key_side || 'Side'
                      : t.photo_key_rim || 'Rim'}
                </button>
              ))}
              {light.preset === 'custom' && (
                <span className="mbt-photo__segbtn mbt-photo__segbtn--on">
                  {t.photo_key_custom || 'Custom'}
                </span>
              )}
            </div>

            {/* Drag positions the LIGHT while this is on. Spatial control by
                spatial gesture, with the camera's own vocabulary: drag to move
                it around, wheel to push it in and out. */}
            <button
              className={`mbt-photo__tool ${positioning ? 'mbt-photo__tool--on' : ''}`}
              disabled={!light.on}
              onClick={togglePositioning}
              title={t.photo_light_move_hint || 'Drag moves the light instead of the camera'}
            >
              <Move3d size={15} />
              <span>{t.photo_light_move || 'Move light'}</span>
            </button>

            <label className="mbt-photo__slider">
              <span>{t.photo_light_power || 'Strength'}</span>
              <input
                type="range" min="0.5" max="8" step="0.5"
                value={light.power}
                disabled={!light.on}
                onChange={(e) => pushLight({ power: Number(e.target.value) })}
              />
            </label>

            <label className="mbt-photo__slider">
              <span>{t.photo_light_warmth || 'Warmth'}</span>
              <input
                type="range" min="-1" max="1" step="0.1"
                value={light.warmth}
                disabled={!light.on}
                onChange={(e) => pushLight({ warmth: Number(e.target.value) })}
              />
            </label>

            {/* Where it actually is. Read-only on purpose: the gesture is the
                input, and a second way to set the same number would be two
                controls arguing over one value. */}
            <span className="mbt-photo__readouts">
              <b>{Math.round(light.elev)}&deg;</b>
              <small>{t.photo_light_elev || 'Height'}</small>
              <b>{light.dist.toFixed(1)}m</b>
              <small>{t.photo_light_dist || 'Distance'}</small>
            </span>
          </div>
        )}

        {tab === 'scene' && hasScene && (
          <div className="mbt-photo__panel">
            <div className="mbt-photo__seg">
              <button
                className={`mbt-photo__segbtn ${hour === null ? 'mbt-photo__segbtn--on' : ''}`}
                onClick={() => pushHour(null)}
                title={t.photo_server_time || 'Server time'}
              >
                <Sun size={12} />
              </button>
              {HOUR_PRESETS.map((p) => (
                <button
                  key={p.h}
                  className={`mbt-photo__segbtn ${hour === p.h ? 'mbt-photo__segbtn--on' : ''}`}
                  onClick={() => pushHour(p.h)}
                >
                  {t[p.key] || p.fallback}
                </button>
              ))}
            </div>

            <label className="mbt-photo__slider">
              <span>{t.photo_hour || 'Hour'}</span>
              <input
                type="range" min="0" max="23" step="1"
                value={hour ?? 12}
                onChange={(e) => pushHour(Number(e.target.value))}
              />
              <b className="mbt-photo__readout">
                {hour === null ? '--' : String(hour).padStart(2, '0')}
              </b>
            </label>

            <div className="mbt-photo__filters">
              <button
                className={`mbt-photo__filter ${weather === null ? 'mbt-photo__filter--active' : ''}`}
                onClick={() => pushWeather(null)}
              >
                {t.photo_sky_server || 'Server sky'}
              </button>
              {weathers.map((w) => (
                <button
                  key={w.id}
                  className={`mbt-photo__filter ${weather === w.id ? 'mbt-photo__filter--active' : ''}`}
                  onClick={() => pushWeather(w.id)}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mbt-photo__tools">
          <button
            className={`mbt-photo__tool ${dof ? 'mbt-photo__tool--on' : ''}`}
            onClick={toggleDof}
            title={t.photo_dof || 'Depth of field'}
          >
            <Aperture size={15} />
            <span>{t.photo_dof_label || 'Blur'}</span>
          </button>
          <button
            className={`mbt-photo__tool ${grid ? 'mbt-photo__tool--on' : ''}`}
            onClick={() => setGrid((v) => !v)}
            title={t.photo_grid || 'Framing grid'}
          >
            <Grid3x3 size={15} />
            <span>{t.photo_grid_label || 'Grid'}</span>
          </button>

          {discord ? (
            <button
              className={`mbt-photo__send mbt-photo__send--${send}`}
              onClick={doSend}
              disabled={send === 'sending' || send === 'done'}
            >
              {send === 'sending' ? <Loader2 size={15} className="mbt-spin" /> : <Send size={15} />}
              <span>
                {send === 'confirm'
                  ? (t.photo_send_confirm || 'Tap to confirm')
                  : send === 'sending'
                    ? (t.photo_sending || 'Sending...')
                    : send === 'done'
                      ? (t.photo_sent || 'Sent!')
                      : send === 'error'
                        ? (t.photo_send_error || 'Failed')
                        : (t.photo_send || 'Send to Discord')}
              </span>
            </button>
          ) : null}
        </div>

        <span className={`mbt-photo__hint ${positioning ? 'mbt-photo__hint--mode' : ''}`}>
          {positioning ? <Move3d size={13} /> : <Camera size={13} />}
          {positioning
            ? t.photo_light_hint || 'Drag to move the light · scroll for distance'
            : t.photo_capture_hint || 'Drag to orbit · scroll to zoom · use your screenshot key to capture'}
        </span>
      </div>
    </div>
  )
}
