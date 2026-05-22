import { useState, useEffect } from 'react'
import { PlacementOverlay } from './PlacementOverlay'
import { PreviewVignette } from './PreviewVignette'
import { OpenJoinPill, type OpenJoinPosition } from './OpenJoinPill'
import { WhatsThatBubble } from './WhatsThatBubble'
import { RpTextLayer } from './RpTextLayer'
import { Toast, useToasts, setToastListener } from './Toast'

interface AmbientLayerProps {
  layout?: 'default' | 'cinematic'
}

/**
 * Self-contained ambient overlay layer: preview vignette, placement
 * overlay, OpenJoin pill, WhatsThat bubble and toasts.
 *
 * It owns its own state AND its own NUI-message subscription. This keeps
 * high-frequency ambient events out of App/EmoteMenu — most importantly
 * `whatsthatMove`, which Lua sends every frame while a bubble is tracked.
 * Routing that through App state would re-render the whole menu tree
 * 60×/s; here only this layer re-renders.
 *
 * Toasts use the module-level bus in Toast.tsx (`emitToast`), so any
 * component can fire one without threading state through a shared parent.
 */
export function AmbientLayer({ layout }: AmbientLayerProps) {
  const [placementActive, setPlacementActive] = useState(false)
  const [previewVignette, setPreviewVignette] = useState(false)
  const [openJoin, setOpenJoin] = useState<{
    visible: boolean
    label: string
    joinKey: string
    position: OpenJoinPosition
  }>({ visible: false, label: '', joinKey: 'F', position: 'bottom-center' })
  const [whatsThat, setWhatsThat] = useState<{
    visible: boolean
    label: string
    hotKey: string
    x: number
    y: number
  }>({ visible: false, label: '', hotKey: 'G', x: 0.5, y: 0.5 })
  const { toasts, addToast, dismissToast } = useToasts()

  // Become the live toast sink while mounted.
  useEffect(() => setToastListener(addToast), [addToast])

  // Own message listener — only the ambient actions. App keeps its own
  // listener for menu/wheel actions; the two switches are disjoint.
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data
      if (!data || typeof data !== 'object') return

      switch (data.action) {
        case 'placementStarted':
          setPlacementActive(true)
          break

        case 'placementEnded':
          setPlacementActive(false)
          break

        case 'previewVignette':
          setPreviewVignette(!!data.visible)
          break

        case 'openJoinShow':
          setOpenJoin({
            visible: true,
            label: data.label || '',
            joinKey: data.joinKey || 'F',
            position: (data.position as OpenJoinPosition) || 'bottom-center',
          })
          break

        case 'openJoinHide':
          setOpenJoin((s) => ({ ...s, visible: false }))
          break

        case 'whatsthatShow':
          setWhatsThat({
            visible: true,
            label: data.label || '',
            hotKey: data.hotKey || 'G',
            x: typeof data.x === 'number' ? data.x : 0.5,
            y: typeof data.y === 'number' ? data.y : 0.5,
          })
          break

        case 'whatsthatMove':
          setWhatsThat((s) => ({
            ...s,
            x: typeof data.x === 'number' ? data.x : s.x,
            y: typeof data.y === 'number' ? data.y : s.y,
          }))
          break

        case 'whatsthatHide':
          setWhatsThat((s) => ({ ...s, visible: false }))
          break
      }
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // OpenJoin + WhatsThat both lead to "play the same emote nearby". When
  // both are active and addressing the same emote, only show the OpenJoin
  // pill so the player gets a single prompt, not two competing affordances.
  const whatsThatVisible =
    whatsThat.visible && !(openJoin.visible && openJoin.label === whatsThat.label)

  return (
    <>
      <PreviewVignette visible={previewVignette} layout={layout} />
      <PlacementOverlay visible={placementActive} layout={layout} />
      <OpenJoinPill
        visible={openJoin.visible}
        emoteLabel={openJoin.label}
        joinKey={openJoin.joinKey}
        position={openJoin.position}
        layout={layout}
      />
      <WhatsThatBubble
        visible={whatsThatVisible}
        label={whatsThat.label}
        hotKey={whatsThat.hotKey}
        x={whatsThat.x}
        y={whatsThat.y}
        layout={layout}
      />
      <RpTextLayer layout={layout} />
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </>
  )
}
