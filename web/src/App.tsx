import { useState, useEffect, useCallback } from 'react'
import { EmoteMenu } from './components/EmoteMenu'
import type { TrendingEmote } from './components/TrendingHero'
import { EmoteWheel } from './components/EmoteWheel'
import { AmbientLayer } from './components/AmbientLayer'
import { emitToast } from './components/Toast'
import { LocaleProvider, type LocaleStrings } from './utils/locale'
import { useNui } from './utils/useNui'
import { buildThemeVars } from './utils/theme'
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
  const [wheelMode, setWheelMode] = useState<'radial' | 'linear'>('radial')
  const [wheelPointer, setWheelPointer] = useState<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false })
  const [personas, setPersonas] = useState<{ id: string; name: string; locked?: boolean }[]>([])
  const [activePersonaId, setActivePersonaId] = useState<string>('default')
  const [personasMax, setPersonasMax] = useState(4)
  const [activeWalk, setActiveWalk] = useState<string | null>(null)
  const [activeExpression, setActiveExpression] = useState<string | null>(null)
  const [savedMenuState, setSavedMenuState] = useState<{
    search: string; tab: string; category: string | null; filter: string; sort: string; scrollTop: number
  } | null>(null)
  const [nearbyCount, setNearbyCount] = useState(0)
  const [trending, setTrending] = useState<TrendingEmote | null>(null)

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
          if (data.personas && Array.isArray(data.personas.personas)) {
            setPersonas(data.personas.personas)
            setActivePersonaId(data.personas.activeId || 'default')
            if (typeof data.personas.max === 'number') setPersonasMax(data.personas.max)
          }
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

        // placement / previewVignette / openJoin* / whatsthat* are owned
        // by AmbientLayer (it runs its own message listener) — not here.

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
          setWheelMode(data.mode === 'linear' ? 'linear' : 'radial')
          setWheelPointer({ x: 0, y: 0, active: false })
          setWheelVisible(true)
          break

        case 'wheelIndex':
          setWheelIndex(data.index ?? 0)
          break

        case 'wheelPointer':
          setWheelPointer({
            x: typeof data.x === 'number' ? data.x : 0,
            y: typeof data.y === 'number' ? data.y : 0,
            active: !!data.active,
          })
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

  // Apply the server theme (config.lua MBT.Theme) as CSS custom properties
  // on :root, so the whole NUI — menu, wheel and the ambient overlays
  // alike — shares one accent. index.css holds the built-in defaults.
  useEffect(() => {
    if (!config) return
    const vars = buildThemeVars(config.theme)
    const root = document.documentElement
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, String(value))
    }
  }, [config])

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

  // ── Personas / loadouts ──
  const handleSwitchPersona = useCallback(async (id: string) => {
    const r = await useNui<{ ok?: boolean; binds?: Record<string, Emote>; wheel?: Record<string, Emote>; activeId?: string }>('switchPersona', { id })
    if (r?.ok) {
      setKeybinds(r.binds || {})
      setWheelSlots(r.wheel || {})
      setActivePersonaId(r.activeId || id)
    }
  }, [])

  const handleCreatePersona = useCallback(async (name: string) => {
    const r = await useNui<{ ok?: boolean; data?: { activeId: string; personas: { id: string; name: string; locked?: boolean }[] } }>('createPersona', { name })
    if (r?.ok && r.data) {
      setPersonas(r.data.personas)
      setActivePersonaId(r.data.activeId)
    }
  }, [])

  const handleRenamePersona = useCallback(async (id: string, name: string) => {
    const r = await useNui<{ ok?: boolean; data?: { activeId: string; personas: { id: string; name: string; locked?: boolean }[] } }>('renamePersona', { id, name })
    if (r?.ok && r.data) setPersonas(r.data.personas)
  }, [])

  const handleDeletePersona = useCallback(async (id: string) => {
    const r = await useNui<{ ok?: boolean; data?: { activeId: string; personas: { id: string; name: string; locked?: boolean }[] }; binds?: Record<string, Emote>; wheel?: Record<string, Emote> }>('deletePersona', { id })
    if (r?.ok && r.data) {
      setPersonas(r.data.personas)
      setActivePersonaId(r.data.activeId)
      if (r.binds) setKeybinds(r.binds)
      if (r.wheel) setWheelSlots(r.wheel)
    }
  }, [])

  // Wheel index is now driven by Lua (game-side scroll detection), no JS handler needed

  // Track whether close was triggered by ESC (manual) vs play (auto)
  const handleManualClose = useCallback(() => {
    mbtDebug('Menu closed (manual ESC/X)')
    setVisible(false)
    setSavedMenuState(null) // ESC → reset state on next open
  }, [])

  if (!visible || !config) {
    // Menu closed (or config not yet loaded): render only the wheel, if
    // held, plus the always-on ambient layer. AmbientLayer owns the
    // overlay state and runs its own NUI message listener.
    return (
      <LocaleProvider strings={locale}>
        {wheelVisible && (
          <EmoteWheel
            visible={wheelVisible}
            slots={wheelSlots}
            activeIndex={wheelIndex}
            maxSlots={wheelMaxSlots}
            mode={wheelMode}
            pointer={wheelPointer}
          />
        )}
        <AmbientLayer layout={config?.layout} />
      </LocaleProvider>
    )
  }

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
        personas={personas}
        activePersonaId={activePersonaId}
        personasMax={personasMax}
        onSwitchPersona={handleSwitchPersona}
        onCreatePersona={handleCreatePersona}
        onRenamePersona={handleRenamePersona}
        onDeletePersona={handleDeletePersona}
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
        onToast={emitToast}
        onClose={handleManualClose}
        onPlayClose={() => setVisible(false)}
      />
      <AmbientLayer layout={config?.layout} />
    </LocaleProvider>
  )
}

export default App
