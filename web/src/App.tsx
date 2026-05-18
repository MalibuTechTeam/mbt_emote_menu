import { useState, useEffect, useCallback } from 'react'
import { EmoteMenu } from './components/EmoteMenu'
import type { TrendingEmote } from './components/TrendingHero'
import { EmoteWheel } from './components/EmoteWheel'
import { PlacementOverlay } from './components/PlacementOverlay'
import { PreviewVignette } from './components/PreviewVignette'
import { OpenJoinPill, type OpenJoinPosition } from './components/OpenJoinPill'
import { WhatsThatBubble } from './components/WhatsThatBubble'
import { Toast, useToasts } from './components/Toast'
import { LocaleProvider, type LocaleStrings } from './utils/locale'
import { useNui } from './utils/useNui'
import type { Emote, MenuConfig, SharedRequest, JobPermissions, CustomList } from './utils/types'
import { setDebugEnabled, mbtDebug } from './utils/debug'

function App() {
  const [visible, setVisible] = useState(false)
  const [catalog, setCatalog] = useState<Emote[]>([])
  const [config, setConfig] = useState<MenuConfig | null>(null)
  const [favorites, setFavorites] = useState<Record<string, boolean>>({})
  const [favOrder, setFavOrder] = useState<string[]>([])
  const [playCounts, setPlayCounts] = useState<Record<string, number>>({})
  const [recent, setRecent] = useState<Emote[]>([])
  const [keybinds, setKeybinds] = useState<Record<string, Emote>>({})
  const [sharedRequest, setSharedRequest] = useState<SharedRequest | null>(null)
  const [locale, setLocale] = useState<LocaleStrings>({})
  const [playlist, setPlaylist] = useState<Emote[]>([])
  const [playlistPlaying, setPlaylistPlaying] = useState(false)
  const [playlistIndex, setPlaylistIndex] = useState(-1)
  const [playerJob, setPlayerJob] = useState<string | null>(null)
  const [jobPermissions, setJobPermissions] = useState<JobPermissions>({})
  const [customLists, setCustomLists] = useState<CustomList[]>([])
  const [wheelVisible, setWheelVisible] = useState(false)
  const [wheelSlots, setWheelSlots] = useState<Record<string, Emote>>({})
  const [wheelIndex, setWheelIndex] = useState(0)
  const [wheelMaxSlots, setWheelMaxSlots] = useState(8)
  const [activeWalk, setActiveWalk] = useState<string | null>(null)
  const [activeExpression, setActiveExpression] = useState<string | null>(null)
  const [savedMenuState, setSavedMenuState] = useState<{
    search: string; tab: string; category: string | null; filter: string; sort: string; scrollTop: number
  } | null>(null)
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
  const [nearbyCount, setNearbyCount] = useState(0)
  const [trending, setTrending] = useState<TrendingEmote | null>(null)
  const { toasts, addToast, dismissToast } = useToasts()

  // Listen for NUI messages from client.lua
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data
      // Defensive shape check: drop anything that isn't a proper Lua-bridge
      // message (random postMessage noise from browser extensions in dev,
      // etc). We deliberately do NOT check event.origin — FiveM CEF builds
      // vary in what they report (empty, "null", custom scheme) and any
      // non-permissive check risks rejecting legitimate SendNUIMessage
      // events from our own Lua, which would silently break the menu.
      if (!data || typeof data !== 'object') return

      switch (data.action) {
        case 'openMenu':
          // Catalog, config, locale are only sent on first open; reuse cached values on subsequent opens
          if (Array.isArray(data.catalog)) setCatalog(data.catalog)
          if (data.config && typeof data.config === 'object') {
            setConfig(data.config)
            setDebugEnabled(!!data.config.debug)
          }
          if (data.locale) setLocale(data.locale)
          mbtDebug('Menu opened', { catalogSize: data.catalog?.length, hasConfig: !!data.config })
          setFavorites(data.favorites || {})
          setFavOrder(data.favOrder || [])
          setPlayCounts(data.playCounts || {})
          setRecent(data.recent || [])
          setKeybinds(data.keybinds || {})
          if (data.playerJob !== undefined) setPlayerJob(data.playerJob)
          if (data.jobPermissions) setJobPermissions(data.jobPermissions)
          if (data.customLists) setCustomLists(data.customLists)
          if (data.activeWalk !== undefined) setActiveWalk(data.activeWalk || null)
          if (data.activeExpr !== undefined) setActiveExpression(data.activeExpr || null)
          setVisible(true)
          break

        case 'preloadCatalog':
          if (Array.isArray(data.catalog)) setCatalog(data.catalog)
          if (data.config && typeof data.config === 'object') {
            setConfig(data.config)
            setDebugEnabled(!!data.config.debug)
          }
          if (data.locale) setLocale(data.locale)
          mbtDebug('Catalog preloaded', { count: data.catalog?.length })
          break

        case 'closeMenu':
          // CloseOnPlay or external close — hide without resetting state
          mbtDebug('Menu closed (CloseOnPlay/external)')
          setVisible(false)
          break

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

        case 'nearbyCountUpdate':
          setNearbyCount(typeof data.count === 'number' ? data.count : 0)
          break

        case 'trending':
          // Server-wide trending payload. `data.data` is { name, label,
          // category, plays } or nil/empty when nothing qualifies — in
          // which case the hero is simply not rendered.
          if (
            data.data &&
            typeof data.data.name === 'string' &&
            typeof data.data.plays === 'number'
          ) {
            setTrending({
              name: data.data.name,
              label: data.data.label || data.data.name,
              category: data.data.category || 'Emotes',
              plays: data.data.plays,
            })
          } else {
            setTrending(null)
          }
          break

        case 'sharedEmoteRequest':
          setSharedRequest({
            emoteName: data.emoteName,
            fromId: data.fromId,
          })
          break

        case 'playlistIndex':
          setPlaylistIndex(data.index ?? -1)
          break

        case 'playlistStopped':
          setPlaylistPlaying(false)
          setPlaylistIndex(-1)
          break

        case 'updateJob':
          if (data.playerJob !== undefined) setPlayerJob(data.playerJob)
          if (data.jobPermissions) setJobPermissions(data.jobPermissions)
          break

        case 'openWheel':
          setWheelSlots(data.slots || {})
          setWheelIndex(data.index ?? 0)
          setWheelMaxSlots(data.maxSlots ?? 8)
          setWheelVisible(true)
          break

        case 'wheelIndex':
          setWheelIndex(data.index ?? 0)
          break

        case 'closeWheel':
          setWheelVisible(false)
          break

        case 'wheelSlotRemoved':
          if (data.slots) setWheelSlots(data.slots)
          break

        case 'activeStylesUpdate':
          setActiveWalk(data.activeWalk || null)
          setActiveExpression(data.activeExpr || null)
          break
      }
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // ESC is now handled inside EmoteMenu via handleClose → onClose prop

  const handleImportFavorites = useCallback(async (data: Record<string, boolean>) => {
    const result = await useNui<{ favorites?: Record<string, boolean>; favOrder?: string[] }>('importFavorites', { favorites: data })
    if (result?.favorites) {
      setFavorites(result.favorites)
      setFavOrder(result.favOrder || [])
    }
  }, [])

  const handlePlayEmote = useCallback(async (emote: Emote) => {
    mbtDebug('Play emote', { name: emote.name, category: emote.category })
    await useNui('playEmote', emote)
  }, [])

  const handleCancelEmote = useCallback(async () => {
    await useNui('cancelEmote', {})
  }, [])

  const handleToggleFavorite = useCallback(async (emote: Emote) => {
    const result = await useNui<{ favorites?: Record<string, boolean>; favOrder?: string[] }>('toggleFavorite', { name: emote.name, emote })
    if (result?.favorites) {
      setFavorites(result.favorites)
      setFavOrder(result.favOrder || [])
    }
  }, [])

  const handleReorderFavorites = useCallback(async (newOrder: string[]) => {
    setFavOrder(newOrder)
    await useNui('reorderFavorites', { order: newOrder })
  }, [])

  const handleAddToPlaylist = useCallback((emote: Emote) => {
    setPlaylist(prev => [...prev, { ...emote, playDuration: 5 } as Emote])
  }, [])

  const handleRemoveFromPlaylist = useCallback((index: number) => {
    setPlaylist(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleReorderPlaylist = useCallback((from: number, to: number) => {
    setPlaylist(prev => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }, [])

  const handlePlayPlaylist = useCallback(async (loop: boolean) => {
    if (playlist.length === 0) return
    setPlaylistPlaying(true)
    setPlaylistIndex(0)
    await useNui('playPlaylist', { items: playlist, loop })
  }, [playlist])

  const handleStopPlaylist = useCallback(async () => {
    await useNui('stopPlaylist', {})
    setPlaylistPlaying(false)
    setPlaylistIndex(-1)
  }, [])

  const handleClearPlaylist = useCallback(async () => {
    await useNui('stopPlaylist', {})
    setPlaylistPlaying(false)
    setPlaylistIndex(-1)
    setPlaylist([])
  }, [])

  const handleSaveCustomLists = useCallback(async (lists: CustomList[]) => {
    setCustomLists(lists)
    await useNui('saveCustomLists', { lists })
  }, [])

  const handleResetWalkstyle = useCallback(async () => {
    await useNui('resetWalkstyle', {})
    setActiveWalk(null)
  }, [])

  const handleResetExpression = useCallback(async () => {
    await useNui('resetExpression', {})
    setActiveExpression(null)
  }, [])

  const handleSetWheelSlot = useCallback(async (slot: number, emote: Emote | null) => {
    setWheelSlots(prev => {
      const next = { ...prev }
      if (emote) next[String(slot)] = emote
      else delete next[String(slot)]
      return next
    })
    await useNui('setWheelSlot', { slot, emote })
  }, [])

  // Wheel index is now driven by Lua (game-side scroll detection), no JS handler needed

  // Track whether close was triggered by ESC (manual) vs play (auto)
  const handleManualClose = useCallback(() => {
    mbtDebug('Menu closed (manual ESC/X)')
    setVisible(false)
    setSavedMenuState(null) // ESC → reset state on next open
  }, [])

  // OpenJoin + WhatsThat both lead to "play the same emote nearby". When both
  // are active and addressing the same emote, only show the OpenJoin pill so
  // the player gets a single prompt rather than two competing affordances.
  const whatsThatVisible =
    whatsThat.visible && !(openJoin.visible && openJoin.label === whatsThat.label)

  // Wheel, placement overlay and preview vignette are independent from the
  // menu — render them even when the menu is closed (so the vignette can
  // gracefully fade out on close, for example).
  if (!visible && !wheelVisible) {
    if (!placementActive && !previewVignette && !openJoin.visible && !whatsThatVisible && toasts.length === 0) return null
    return (
      <LocaleProvider strings={locale}>
        <PreviewVignette visible={previewVignette} layout={config?.layout} />
        <PlacementOverlay visible={placementActive} layout={config?.layout} />
        <OpenJoinPill
          visible={openJoin.visible}
          emoteLabel={openJoin.label}
          joinKey={openJoin.joinKey}
          position={openJoin.position}
          layout={config?.layout}
        />
        <WhatsThatBubble
          visible={whatsThatVisible}
          label={whatsThat.label}
          hotKey={whatsThat.hotKey}
          x={whatsThat.x}
          y={whatsThat.y}
          layout={config?.layout}
        />
        {toasts.length > 0 && <Toast toasts={toasts} onDismiss={dismissToast} />}
      </LocaleProvider>
    )
  }

  // If only wheel is visible (menu closed)
  if (!visible && wheelVisible) {
    return (
      <LocaleProvider strings={locale}>
        <EmoteWheel
          visible={wheelVisible}
          slots={wheelSlots}
          activeIndex={wheelIndex}
          maxSlots={wheelMaxSlots}
        />
        <PreviewVignette visible={previewVignette} layout={config?.layout} />
        <PlacementOverlay visible={placementActive} layout={config?.layout} />
        <OpenJoinPill
          visible={openJoin.visible}
          emoteLabel={openJoin.label}
          joinKey={openJoin.joinKey}
          position={openJoin.position}
          layout={config?.layout}
        />
        <WhatsThatBubble
          visible={whatsThatVisible}
          label={whatsThat.label}
          hotKey={whatsThat.hotKey}
          x={whatsThat.x}
          y={whatsThat.y}
          layout={config?.layout}
        />
        <Toast toasts={toasts} onDismiss={dismissToast} />
      </LocaleProvider>
    )
  }

  if (!config) return null

  return (
    <LocaleProvider strings={locale}>
      <EmoteMenu
        savedMenuState={savedMenuState}
        onSaveMenuState={setSavedMenuState}
        catalog={catalog}
        config={config}
        favorites={favorites}
        favOrder={favOrder}
        playCounts={playCounts}
        recent={recent}
        keybinds={keybinds}
        sharedRequest={sharedRequest}
        nearbyCount={nearbyCount}
        trending={trending}
        onPlay={handlePlayEmote}
        onCancel={handleCancelEmote}
        onToggleFavorite={handleToggleFavorite}
        onReorderFavorites={handleReorderFavorites}
        playlist={playlist}
        playlistPlaying={playlistPlaying}
        playlistIndex={playlistIndex}
        onAddToPlaylist={handleAddToPlaylist}
        onRemoveFromPlaylist={handleRemoveFromPlaylist}
        onReorderPlaylist={handleReorderPlaylist}
        onPlayPlaylist={handlePlayPlaylist}
        onStopPlaylist={handleStopPlaylist}
        onClearPlaylist={handleClearPlaylist}
        playerJob={playerJob}
        jobPermissions={jobPermissions}
        customLists={customLists}
        onSaveCustomLists={handleSaveCustomLists}
        wheelSlots={wheelSlots}
        wheelMaxSlots={wheelMaxSlots}
        onSetWheelSlot={handleSetWheelSlot}
        onKeybindsUpdate={setKeybinds}
        onImportFavorites={handleImportFavorites}
        activeWalk={activeWalk}
        activeExpression={activeExpression}
        onResetWalkstyle={handleResetWalkstyle}
        onResetExpression={handleResetExpression}
        onToast={addToast}
        onClose={handleManualClose}
        onPlayClose={() => setVisible(false)}
      />
      <PreviewVignette visible={previewVignette} layout={config?.layout} />
      <PlacementOverlay visible={placementActive} layout={config?.layout} />
      <OpenJoinPill
        visible={openJoin.visible}
        emoteLabel={openJoin.label}
        joinKey={openJoin.joinKey}
        position={openJoin.position}
        layout={config?.layout}
      />
      <WhatsThatBubble
        visible={whatsThatVisible}
        label={whatsThat.label}
        hotKey={whatsThat.hotKey}
        x={whatsThat.x}
        y={whatsThat.y}
        layout={config?.layout}
      />
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </LocaleProvider>
  )
}

export default App
