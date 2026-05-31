import { useEffect, useRef, useState, useCallback } from 'react'
import { Aperture, Grid3x3, Send, X, Camera, Loader2 } from 'lucide-react'
import { useLocale } from '../utils/locale'
import { useNui } from '../utils/useNui'

interface FilterDef {
  id: string
  label: string
  timecycle?: string | null
  strength?: number
}

type SendState = 'idle' | 'confirm' | 'sending' | 'done' | 'error'

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

  const pending = useRef({ ox: 0, oy: 0, z: 0 })
  const rafRef = useRef<number>(0)

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
      const p = pending.current
      if (p.ox !== 0 || p.oy !== 0) {
        useNui('photoOrbit', { dx: p.ox, dy: p.oy })
        p.ox = 0
        p.oy = 0
      }
      if (p.z !== 0) {
        useNui('photoZoom', { delta: p.z })
        p.z = 0
      }
      rafRef.current = requestAnimationFrame(flush)
    }
    rafRef.current = requestAnimationFrame(flush)
    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [active])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    setDragging(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return
    pending.current.ox += e.movementX
    pending.current.oy += e.movementY
  }, [dragging])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    setDragging(false)
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* noop */ }
  }, [])

  const onWheel = useCallback((e: React.WheelEvent) => {
    pending.current.z += -e.deltaY / 100
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
        onPointerUp={onPointerUp}
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

        <span className="mbt-photo__hint">
          <Camera size={13} />
          {t.photo_capture_hint || 'Drag to orbit · scroll to zoom · use your screenshot key to capture'}
        </span>
      </div>
    </div>
  )
}
