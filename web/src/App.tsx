import { useState, useEffect, useCallback } from 'react'
import { EmoteMenu } from './components/EmoteMenu'
import { EmoteWheel } from './components/EmoteWheel'
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
  const { toasts, addToast, dismissToast } = useToasts()

  // Listen for NUI messages from client.lua
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data

      switch (data.action) {
        case 'openMenu':
          // Catalog, config, locale are only sent on first open; reuse cached values on subsequent opens
          if (data.catalog) setCatalog(data.catalog)
          if (data.config) {
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
          if (data.catalog) setCatalog(data.catalog)
          if (data.config) {
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

  // Wheel is independent from menu — render it even when menu is closed
  if (!visible && !wheelVisible) {
    return toasts.length > 0 ? <Toast toasts={toasts} onDismiss={dismissToast} /> : null
  }

  // If only wheel is visible (menu closed)
  if (!visible && wheelVisible) {
    return (
      <>
        <EmoteWheel
          visible={wheelVisible}
          slots={wheelSlots}
          activeIndex={wheelIndex}
          maxSlots={wheelMaxSlots}
        />
        <Toast toasts={toasts} onDismiss={dismissToast} />
      </>
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
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </LocaleProvider>
  )
}

export default App
