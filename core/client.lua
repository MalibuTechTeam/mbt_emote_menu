-------------------------------------------------------------------------------
-- [ CORE CLIENT — Menu, Routing, Wheel, QuickBind, Init ]
-------------------------------------------------------------------------------

local isOpen = false
local emoteCatalog = {}
local rpemotesResource = nil
local rpemotesExportName = 'rpemotes'
local ecosystemStatus = {}
local catalogSentToNui = false
local playerJob = nil
local jobPermissions = {}
local activeWalkStyle = nil
local activeExpression = nil
local placementAvailable = false
local RequestEmoteCatalog
local emoteLabelByName = {}
local pendingOpen = false
local PENDING_OPEN_TTL_MS = 20000
local pendingOpenAt = 0

Core = Core or {}

Core._rpemotesExportName = nil

local SanitizeName = Utils.Sanitize

-------------------------------------------------------------------------------
-- [ EMOTE ROUTING — used by playEmote callback, wheel, quickbind, playlist ]
-------------------------------------------------------------------------------

local lastEmotePlayAt = 0

--- @param emoteName string sanitized emote name
--- @param emoteType string category name (Walks, Expressions, Shared, etc.)
--- @param variation number|nil variation index (default 1)
function Core.PlayEmoteRaw(emoteName, emoteType, variation)
    local safeName = SanitizeName(emoteName)
    if not safeName or safeName == '' or not rpemotesResource then return end

    if MBT.AntiSpam and MBT.AntiSpam.Enabled then
        local now = GetGameTimer()
        local cooldown = MBT.AntiSpam.CooldownMs or 250
        if now - lastEmotePlayAt < cooldown then return end
        lastEmotePlayAt = now
    end

    local safeType = SanitizeName(emoteType)
    variation = tonumber(variation) or 1

    -- Emoji reactions are MBT's own feature, not an rpemotes animation —
    -- route them straight to the emoji module (floats a glyph overhead).
    if safeType == 'Emojis' then
        if MBT.Emoji and MBT.Emoji.Enabled and Emoji and Emoji.Play then
            Emoji.Play(safeName)
            Core.IncrementPlayCount(safeName)
        end
        return
    end

    if safeType == 'Shared' then
        ExecuteCommand('nearby ' .. safeName)
    elseif safeType == 'Expressions' then
        ExecuteCommand('mood ' .. safeName)
        activeExpression = safeName
        SendNUIMessage({ action = 'activeStylesUpdate', activeWalk = activeWalkStyle, activeExpr = activeExpression })
    elseif safeType == 'Walks' then
        Utils.SafeExportCall(rpemotesExportName, 'setWalkstyle', safeName)
        activeWalkStyle = safeName
        SendNUIMessage({ action = 'activeStylesUpdate', activeWalk = activeWalkStyle, activeExpr = activeExpression })
    else
        Utils.SafeExportCall(rpemotesExportName, 'EmoteCommandStart', safeName, variation)
    end

    Core.IncrementPlayCount(safeName)

    if OpenJoin and OpenJoin.MaybeAnnounce then
        OpenJoin.MaybeAnnounce(safeName, emoteLabelByName[safeName] or safeName, safeType)
    end

    if Trending and Trending.MaybeReport then
        Trending.MaybeReport(safeName, emoteLabelByName[safeName] or safeName, safeType)
    end
end

-------------------------------------------------------------------------------
-- [ NUI OPEN / CLOSE ] --
-------------------------------------------------------------------------------

function Core.ToggleMenu()
    if isOpen then Core.CloseMenu() else Core.OpenMenu() end
end

local LOCALE_KEYS = {
    -- Original
    'menu_title', 'search_placeholder',
    'tab_all', 'tab_favorites', 'tab_recent',
    'filter_all', 'filter_props', 'filter_shared',
    'status_playing', 'status_idle', 'status_walkstyle',
    'cancel_emote', 'shared_request', 'shared_accept', 'shared_decline',
    'no_emotes_found', 'no_emotes_hint', 'no_emotes_arrow',
    'partner_hint', 'wheel_empty_hint',
    'quickbind_title', 'quickbind_empty',
    'wheel_empty', 'wheel_hint', 'wheel_hint_remove', 'wheel_removed',
    'partner_loading', 'partner_empty', 'partner_sent', 'partner_send', 'partner_retry',
    'playlist_empty', 'playlist_clear', 'playlist_loop_on', 'playlist_loop_off',
    -- Buttons
    'btn_create', 'btn_cancel', 'btn_done', 'btn_import', 'btn_reset', 'btn_play', 'btn_stop',
    -- Tabs (extra)
    'tab_top',
    -- Tooltips
    'tooltip_new_list', 'tooltip_stop_animation',
    'tooltip_export_favorites', 'tooltip_import_favorites',
    'tooltip_preview_start', 'tooltip_preview_stop',
    'tooltip_add_to_playlist', 'tooltip_add_to_list', 'tooltip_list_delete',
    'tooltip_wheel_remove', 'tooltip_wheel_occupied', 'tooltip_wheel_assign',
    'tooltip_remove_from_list', 'tooltip_add_to_named_list',
    'tooltip_place_in_world',
    -- Placement overlay
    'placement_title', 'placement_position', 'placement_rotate', 'placement_height',
    'placement_confirm', 'placement_cancel',
    -- Preview indicator
    'preview_mode',
    -- Open Join pill
    'openjoin_label',
    -- What's That Emote bubble
    'whatsthat_try',
    -- Nearby section (Shared Emotes 2.0)
    'nearby_title', 'nearby_hint', 'nearby_more',
    -- Trending hero
    'trending_kicker', 'trending_sub',
    -- Modals
    'modal_new_list', 'modal_list_name_placeholder',
    'modal_export_title', 'modal_import_title',
    'modal_export_desc', 'modal_import_desc', 'modal_import_placeholder',
    -- Banners
    'banner_walk_active', 'banner_expression_active', 'banner_default',
    -- Drawers
    'drawer_textures', 'drawer_custom_lists', 'drawer_quick_bind', 'drawer_wheel_slot',
    -- Misc labels
    'playlist_label', 'partner_title',
    -- Badges
    'badge_active', 'badge_sync', 'badge_prop', 'badge_dance',
    -- Toasts
    'toast_walk_reset', 'toast_expression_reset', 'toast_emote_restricted',
    'toast_wheel_assigned',
    'toast_list_deleted', 'toast_list_already_in', 'toast_list_added',
    -- Result bar & sort
    'sort_az', 'sort_za', 'sort_cat',
    'sortpop_sort_by', 'sortpop_filter', 'resultbar_emotes',
    'btn_random', 'btn_sort_filter', 'tooltip_sort_filter', 'tooltip_more',
    'wheel_slot_label', 'modal_list_icon_label',
    -- Previously defined, now shipped to the NUI
    'quickbind_hint', 'drawer_quick_bind_hint', 'drawer_wheel_slot_hint',
    'drawer_bind_key', 'variant_count',
}

local function BuildLocaleStrings()
    local L = MBT.Locale or {}
    local out = {}
    for _, key in ipairs(LOCALE_KEYS) do
        out[key] = L[key] or key
    end
    return out
end

local function BuildLocalizedCategories()
    local out = {}
    for i, c in ipairs(MBT.Categories or {}) do
        local label = c.label
        if c.localeKey then
            local translated = Translate(c.localeKey)
            if translated ~= c.localeKey then label = translated end
        end
        out[i] = {
            type    = c.type,
            icon    = c.icon,
            visible = c.visible,
            label   = label,
        }
    end
    return out
end

local function BuildMenuConfig()
    local features = {}
    for k, v in pairs(MBT.Features or {}) do features[k] = v end
    features.EmotePlacement = (MBT.Features.EmotePlacement ~= false) and placementAvailable

    return {
        layout        = MBT.Menu.Layout or 'default',
        position      = MBT.Menu.Position,
        watermark     = MBT.Menu.Watermark,
        rememberState = MBT.Menu.RememberState,
        debug         = MBT.Debug or false,
        theme         = MBT.Theme,
        categories    = BuildLocalizedCategories(),
        features      = features,
        ecosystem     = ecosystemStatus,
    }
end

function Core.OpenMenu()
    if isOpen then return end

    if not LocalPlayer.state.canEmote and LocalPlayer.state.canEmote ~= nil then
        MBT.Notification({ description = MBT.Locale['cannot_open_menu'] or 'Cannot open menu right now' })
        return
    end

    if #emoteCatalog == 0 then
        pendingOpen = true
        pendingOpenAt = GetGameTimer()
        MBT.Notification({ description = MBT.Locale['loading_emotes'] or 'Loading emotes, please wait...' })
        RequestEmoteCatalog()
        return
    end

    pendingOpen = false

    isOpen = true

    if rpemotesResource then
        local w = Utils.SafeExport(rpemotesExportName, 'getWalkstyle')
        activeWalkStyle = (w and w ~= '') and w or nil
    end

    local payload = {
        action         = 'openMenu',
        favorites      = Core.GetFavorites(),
        favOrder       = Core.GetFavOrder(),
        recent         = Core._recentEmotes,
        keybinds       = Core.GetKeybinds(),
        playCounts     = Core.GetPlayCounts(),
        playerJob      = playerJob,
        jobPermissions = jobPermissions,
        customLists    = Core.GetCustomLists(),
        activeWalk     = activeWalkStyle,
        activeExpr     = activeExpression,
        config         = BuildMenuConfig(),
        locale         = BuildLocaleStrings(),
    }

    if not catalogSentToNui then
        payload.catalog = emoteCatalog
        catalogSentToNui = true
    end

    SendNUIMessage(payload)
    SetNuiFocus(true, true)

    -- Ask the server for the current "Trending this week" emote. The reply
    -- arrives async via mbt_emote_menu:client:receiveTrending → SendNUIMessage.
    if Trending and Trending.Request then
        Trending.Request()
    end

    Utils.MbtDebugger('Menu opened')
end

function Core.CloseMenu()
    if not isOpen then return end
    isOpen = false

    Core.StopPreview()
    SendNUIMessage({ action = 'closeMenu' })
    SetNuiFocus(false, false)
    Utils.MbtDebugger('Menu closed')
end

function Core.IsMenuOpen()
    return isOpen
end

-------------------------------------------------------------------------------
-- [ NUI CALLBACKS — Core ] --
-------------------------------------------------------------------------------

RegisterNUICallback('closeUI', function(_, cb)
    Core.CloseMenu()
    cb({ ok = true })
end)

RegisterNUICallback('playEmote', function(data, cb)
    if not rpemotesResource then
        cb({ ok = false, error = 'rpemotes not detected' })
        return
    end

    local emoteName = SanitizeName(data.name)
    local emoteType = SanitizeName(data.category)
    if not emoteName or emoteName == '' or not emoteType then
        cb({ ok = false, error = 'invalid input' })
        return
    end

    Core.PlayEmoteRaw(emoteName, emoteType, tonumber(data.variation) or 1)

    if MBT.Features.RecentEmotes then
        Core.AddRecent(data)
    end

    if MBT.Menu.CloseOnPlay then
        Core.CloseMenu()
    end

    cb({ ok = true })
end)

RegisterNUICallback('cancelEmote', function(_, cb)
    if rpemotesResource then
        Utils.SafeExportCall(rpemotesExportName, 'EmoteCancel')
    end
    cb({ ok = true })
end)

RegisterNUICallback('placeEmote', function(data, cb)
    if not rpemotesResource then
        cb({ ok = false, error = 'rpemotes not detected' })
        return
    end
    if not placementAvailable then
        cb({ ok = false, error = 'placement export not available' })
        return
    end

    local emoteName = SanitizeName(data.name)
    if not emoteName or emoteName == '' then
        cb({ ok = false, error = 'invalid input' })
        return
    end

    Core.CloseMenu()
    Utils.SafeExportCall(rpemotesExportName, 'StartNewPlacement', emoteName, {
        suppressHelpText = true,
    })

    cb({ ok = true })
end)

-------------------------------------------------------------------------------
-- [ WALK / EXPRESSION STATE ] --
-------------------------------------------------------------------------------

RegisterNUICallback('resetWalkstyle', function(_, cb)
    if rpemotesResource then
        ExecuteCommand('walk reset')
    end
    activeWalkStyle = nil
    SendNUIMessage({ action = 'activeStylesUpdate', activeWalk = activeWalkStyle, activeExpr = activeExpression })
    cb({ ok = true })
end)

RegisterNUICallback('resetExpression', function(_, cb)
    if rpemotesResource then
        ExecuteCommand('mood reset')
    end
    activeExpression = nil
    SendNUIMessage({ action = 'activeStylesUpdate', activeWalk = activeWalkStyle, activeExpr = activeExpression })
    cb({ ok = true })
end)

RegisterNUICallback('getActiveStyles', function(_, cb)
    if rpemotesResource then
        local w = Utils.SafeExport(rpemotesExportName, 'getWalkstyle')
        activeWalkStyle = (w and w ~= '') and w or nil
    end
    cb({ ok = true, activeWalk = activeWalkStyle, activeExpr = activeExpression })
end)

-------------------------------------------------------------------------------
-- [ JOB PERMISSIONS ] --
-------------------------------------------------------------------------------

RegisterNetEvent('mbt_emote_menu:receivePlayerJob', function(job, permissions)
    playerJob = job
    jobPermissions = permissions or {}
    Utils.MbtDebugger('Received player job: ' .. tostring(job))
    if isOpen then
        SendNUIMessage({ action = 'updateJob', playerJob = playerJob, jobPermissions = jobPermissions })
    end
end)

RegisterNUICallback('refreshJob', function(_, cb)
    TriggerServerEvent('mbt_emote_menu:requestPlayerJob')
    cb({ ok = true })
end)

-------------------------------------------------------------------------------
-- [ EMOTE WHEEL (hold-to-peek) ] --
-------------------------------------------------------------------------------

if MBT.Features.EmoteWheel then
    local wheelOpen = false
    local wheelIndex = 1
    local wheelCmdName = 'mbt_emote_wheel'
    local wheelRemoveCmdName = 'mbt_wheel_remove'
    local maxSlots = MBT.EmoteWheel.Slots or 8

    RegisterCommand('+' .. wheelCmdName, function()
        if isOpen or wheelOpen then return end
        wheelOpen = true
        wheelIndex = 1

        SendNUIMessage({
            action   = 'openWheel',
            slots    = Core.GetWheelSlots(),
            index    = wheelIndex,
            maxSlots = maxSlots,
        })

        CreateThread(function()
            while wheelOpen do
                DisableControlAction(0, 16, true) -- scroll down
                DisableControlAction(0, 17, true) -- scroll up

                if IsDisabledControlJustPressed(0, 17) then
                    wheelIndex = wheelIndex - 1
                    if wheelIndex < 1 then wheelIndex = maxSlots end
                    SendNUIMessage({ action = 'wheelIndex', index = wheelIndex })
                elseif IsDisabledControlJustPressed(0, 16) then
                    wheelIndex = wheelIndex + 1
                    if wheelIndex > maxSlots then wheelIndex = 1 end
                    SendNUIMessage({ action = 'wheelIndex', index = wheelIndex })
                end
                Wait(0)
            end
        end)
    end, false)

    RegisterCommand(wheelRemoveCmdName, function()
        if not wheelOpen then return end
        local slots = Core.GetWheelSlots()
        if slots[tostring(wheelIndex)] then
            Core.SetWheelSlot(wheelIndex, nil)
            local updatedSlots = Core.GetWheelSlots()
            SendNUIMessage({ action = 'wheelSlotRemoved', index = wheelIndex, slots = updatedSlots })
            Utils.MbtDebugger('Removed emote from wheel slot ' .. wheelIndex)
        end
    end, false)

    RegisterKeyMapping(wheelRemoveCmdName, 'MBT Wheel: Remove Emote', 'keyboard', MBT.EmoteWheel.RemoveKey or 'X')

    RegisterCommand('-' .. wheelCmdName, function()
        if not wheelOpen then return end
        wheelOpen = false
        SendNUIMessage({ action = 'closeWheel' })

        local slots = Core.GetWheelSlots()
        local emote = slots[tostring(wheelIndex)]
        if emote and rpemotesResource then
            Core.PlayEmoteRaw(emote.name, emote.category, tonumber(emote.variation) or 1)
        end
    end, false)

    RegisterKeyMapping('+' .. wheelCmdName, 'MBT Emote Wheel (Hold)', 'keyboard', MBT.EmoteWheel.Key or 'Z')
end

-------------------------------------------------------------------------------
-- [ MENU KEYBIND & COMMAND ] --
-------------------------------------------------------------------------------

RegisterCommand(MBT.Menu.Command, function()
    Core.ToggleMenu()
end, false)

if not MBT.Menu.OverrideNativeMenu then
    RegisterKeyMapping(MBT.Menu.Command, 'MBT Emote Menu', 'keyboard', MBT.Menu.Keybind)
end

-------------------------------------------------------------------------------
-- [ QUICK BIND (NUM1-NUM6) ] --
-------------------------------------------------------------------------------

if MBT.Features.QuickBind then
    for i = 1, 6 do
        local slot = tostring(i)
        local cmdName = 'mbt_quickbind_' .. slot
        RegisterCommand(cmdName, function()
            if isOpen then return end
            local binds = Core.GetKeybinds()
            local emote = binds[slot]
            if emote and rpemotesResource then
                Core.PlayEmoteRaw(emote.name, emote.category, tonumber(emote.variation) or 1)
            end
        end, false)
        RegisterKeyMapping(cmdName, 'MBT Quick Bind Slot ' .. slot, 'keyboard', 'NUMPAD' .. slot)
    end
end

-------------------------------------------------------------------------------
-- [ DEV / SHOWCASE: LIVE LAYOUT TOGGLE ] --
-------------------------------------------------------------------------------

RegisterCommand('mbt_layout', function(_, args)
    local newLayout = args[1]
    if newLayout ~= 'default' and newLayout ~= 'cinematic' then
        -- Toggle between the two
        if MBT.Menu.Layout == 'cinematic' then
            newLayout = 'default'
        else
            newLayout = 'cinematic'
        end
    end

    MBT.Menu.Layout = newLayout
    catalogSentToNui = false -- Force config re-send on next open

    -- If menu is open, push the new config immediately
    if isOpen then
        Core.CloseMenu()
        Wait(250)
        Core.OpenMenu()
    end

    Utils.MbtDebugger('Layout switched to: ' .. newLayout)
end, false)

-------------------------------------------------------------------------------
-- [ OVERRIDE NATIVE MENU ] --
-------------------------------------------------------------------------------

if MBT.Menu.OverrideNativeMenu then
    RegisterCommand('emotemenu', function() Core.ToggleMenu() end, false)
    RegisterCommand('emoteui', function() Core.ToggleMenu() end, false)
end

-------------------------------------------------------------------------------
-- [ AUTO-CLOSE ON DEATH ]
-- Close the menu automatically if the player ped dies while it's open.
-- Avoids the menu staying on screen during respawn / death camera.
-------------------------------------------------------------------------------

CreateThread(function()
    while true do
        if isOpen then
            if IsEntityDead(PlayerPedId()) then
                Core.CloseMenu()
                Utils.MbtDebugger('Menu closed: player died')
            end
            Wait(500)
        else
            Wait(1000)
        end
    end
end)

-------------------------------------------------------------------------------
-- [ PLACEMENT STATE WATCHER ]
-- Polls rpemotes' GetPlacementState() and emits NUI events when it transitions
-- in/out of an active state. The React side renders the placement overlay
-- (controls hint) while the player is positioning the preview ped.
-------------------------------------------------------------------------------

CreateThread(function()
    local lastActive = false
    while true do
        if placementAvailable then
            local state = Utils.SafeExport(rpemotesExportName, 'GetPlacementState')
            local active = (state ~= nil and state ~= 'None')

            if active and not lastActive then
                SendNUIMessage({ action = 'placementStarted' })
                lastActive = true
            elseif not active and lastActive then
                SendNUIMessage({ action = 'placementEnded' })
                lastActive = false
            end

            Wait(active and 100 or 500)
        else
            Wait(2000)
        end
    end
end)

-------------------------------------------------------------------------------
-- [ INITIALIZATION ] --
-------------------------------------------------------------------------------

RegisterNetEvent('mbt_emote_menu:receiveEmoteCatalog', function(catalog, resourceName)
    if not catalog or #catalog == 0 then return end

    emoteCatalog = catalog
    rpemotesResource = resourceName
    catalogSentToNui = false
    emoteLabelByName = {}
    for _, e in ipairs(emoteCatalog) do
        if e.name then emoteLabelByName[e.name] = e.label or e.name end
    end

    if rpemotesResource then
        local provided = GetResourceMetadata(rpemotesResource, 'provide', 0)
        if provided and provided ~= '' then
            rpemotesExportName = provided
        else
            rpemotesExportName = rpemotesResource
        end
    end

    Core._rpemotesExportName = rpemotesExportName

    if MBT.Features.EmotePlacement ~= false then
        local _, ok = Utils.SafeExport(rpemotesExportName, 'GetPlacementState')
        placementAvailable = ok
        if ok then
            Utils.MbtDebugger('Placement export detected — "Place in world" available')
        else
            print('^3[mbt_emote_menu] rpemotes-reborn placement export not found — update rpemotes for "Place in world"^0')
        end
    end

    SendNUIMessage({
        action  = 'preloadCatalog',
        catalog = emoteCatalog,
        locale  = BuildLocaleStrings(),
        config  = BuildMenuConfig(),
    })
    catalogSentToNui = true

    Utils.MbtDebugger('Received emote catalog: ' .. #emoteCatalog .. ' emotes from ' .. tostring(resourceName) .. ' (exports: ' .. tostring(rpemotesExportName) .. ')')

    if pendingOpen and (GetGameTimer() - pendingOpenAt) <= PENDING_OPEN_TTL_MS then
        pendingOpen = false
        Core.OpenMenu()
    else
        pendingOpen = false
    end
end)

RegisterNetEvent('mbt_emote_menu:receiveEcosystemStatus', function(status)
    ecosystemStatus = status or {}
end)

local CATALOG_RETRY_DELAY_MS = 2500
local CATALOG_MAX_RETRIES = 8

RequestEmoteCatalog = function(attempt)
    attempt = attempt or 1
    TriggerServerEvent('mbt_emote_menu:requestEmoteCatalog')
    SetTimeout(CATALOG_RETRY_DELAY_MS, function()
        if #emoteCatalog > 0 then return end
        if attempt >= CATALOG_MAX_RETRIES then
            Utils.MbtDebugger(('Catalog still empty after %d retries — giving up'):format(CATALOG_MAX_RETRIES))
            return
        end
        Utils.MbtDebugger(('Catalog still empty, retrying (%d/%d)'):format(attempt + 1, CATALOG_MAX_RETRIES))
        RequestEmoteCatalog(attempt + 1)
    end)
end

local function RequestInitialData()
    Core.LoadRecent()
    RequestEmoteCatalog()
    TriggerServerEvent('mbt_emote_menu:requestEcosystemStatus')
    if MBT.JobPermissions and MBT.JobPermissions.Enabled then
        TriggerServerEvent('mbt_emote_menu:requestPlayerJob')
    end
end

AddEventHandler('onResourceStart', function(resourceName)
    if resourceName == GetCurrentResourceName() then
        if NetworkIsPlayerActive(PlayerId()) then
            RequestInitialData()
        end
    end
end)

RegisterNetEvent('playerSpawned', function()
    RequestInitialData()
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName == GetCurrentResourceName() then
        if isOpen then
            SetNuiFocus(false, false)
            isOpen = false
        end
    end
end)
