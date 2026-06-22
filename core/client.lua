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

    -- Single path: rpemotes' Execute export plays every type (shared, expressions,
    -- walks, emojis, props). The boot capability gate guarantees it exists.
    local routed, exportOk = Utils.SafeExport(rpemotesExportName, 'Execute', safeName, safeType, variation)
    if not (exportOk and routed ~= false) then return end

    -- Execute plays it; we mirror walk/expression state for the NUI banner.
    if safeType == 'Walks' then
        activeWalkStyle = safeName
        SendNUIMessage({ action = 'activeStylesUpdate', activeWalk = activeWalkStyle, activeExpr = activeExpression })
    elseif safeType == 'Expressions' then
        activeExpression = safeName
        SendNUIMessage({ action = 'activeStylesUpdate', activeWalk = activeWalkStyle, activeExpr = activeExpression })
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
    -- Emote wheel (radial)
    'wheel_hint_radial',
    -- Photo Mode
    'tooltip_photo_mode', 'photo_exit', 'photo_dof', 'photo_dof_label',
    'photo_grid', 'photo_grid_label', 'photo_send', 'photo_send_confirm',
    'photo_sending', 'photo_sent', 'photo_send_error', 'photo_capture_hint',
    -- Personas
    'persona_title', 'persona_delete_q', 'persona_delete', 'persona_default_hint',
    'persona_switch_hint', 'persona_name_placeholder', 'persona_new', 'cancel',
    -- Settings popover ("...")
    'settings_title', 'settings_appearance', 'settings_behavior', 'settings_data',
    'settings_layout', 'settings_layout_default', 'settings_layout_cinematic',
    'settings_position', 'settings_position_left', 'settings_position_right',
    'settings_performance', 'settings_performance_hint', 'settings_closeonplay',
    'settings_language', 'settings_wheel', 'settings_wheel_radial',
    'settings_wheel_linear', 'settings_accent',
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

-- Languages offered in the per-player settings popover (must have a locales/ file).
local SUPPORTED_LANGS = {
    { code = 'en', label = 'English' },
    { code = 'it', label = 'Italiano' },
    { code = 'es', label = 'Espanol' },
    { code = 'fr', label = 'Francais' },
    { code = 'de', label = 'Deutsch' },
    { code = 'pt', label = 'Portugues' },
}

-- Curated accent presets offered to players (hex without '#'). Brand-safe on
-- purpose: no free picker. The owner can lock this with Theme.AllowAccentChange.
local ACCENT_PRESETS = {
    { hex = '00e676', label = 'Emerald' },
    { hex = '38bdf8', label = 'Sky' },
    { hex = 'a855f7', label = 'Violet' },
    { hex = 'fbbf24', label = 'Amber' },
    { hex = 'fb7185', label = 'Rose' },
}

local function isAccentPreset(hex)
    for _, p in ipairs(ACCENT_PRESETS) do if p.hex == hex then return true end end
    return false
end

local function BuildMenuConfig()
    local features = {}
    for k, v in pairs(MBT.Features or {}) do features[k] = v end
    features.EmotePlacement = (MBT.Features.EmotePlacement ~= false) and placementAvailable
    features.PhotoMode = (MBT.PhotoMode and MBT.PhotoMode.Enabled) and true or false

    -- Player prefs override the config defaults where allowed.
    local prefs = (Core.GetPrefs and Core.GetPrefs()) or {}
    local allowLayoutSwitch = MBT.Menu.AllowLayoutSwitch ~= false
    local allowAccentChange = (MBT.Theme and MBT.Theme.AllowAccentChange) ~= false
    local closeOnPlay = MBT.Menu.CloseOnPlay
    if prefs.closeOnPlay ~= nil then closeOnPlay = prefs.closeOnPlay end

    local wheelMode = prefs.wheelMode
    if wheelMode ~= 'linear' and wheelMode ~= 'radial' then
        wheelMode = (MBT.EmoteWheel and MBT.EmoteWheel.Mode == 'linear') and 'linear' or 'radial'
    end

    -- Theme is copied so a player accent never mutates the shared config table.
    local theme = {}
    for k, v in pairs(MBT.Theme or {}) do theme[k] = v end
    if allowAccentChange and type(prefs.accent) == 'string' and isAccentPreset(prefs.accent) then
        theme.Accent = prefs.accent
    end

    return {
        layout            = (allowLayoutSwitch and prefs.layout) or MBT.Menu.Layout or 'default',
        allowLayoutSwitch = allowLayoutSwitch,
        position          = prefs.position or MBT.Menu.Position,
        closeOnPlay       = closeOnPlay,
        performanceMode   = prefs.performanceMode == true,
        wheelMode         = wheelMode,
        language          = MBT.Language,
        languages         = SUPPORTED_LANGS,
        accents           = ACCENT_PRESETS,
        allowAccentChange = allowAccentChange,
        watermark         = MBT.Menu.Watermark,
        rememberState     = MBT.Menu.RememberState,
        debug             = MBT.Debug or false,
        theme             = theme,
        categories        = BuildLocalizedCategories(),
        features          = features,
        ecosystem         = ecosystemStatus,
    }
end

-- Validators for player-settable prefs. Anything not here is rejected.
local PREF_VALIDATORS = {
    layout          = function(v) return (v == 'default' or v == 'cinematic') and MBT.Menu.AllowLayoutSwitch ~= false end,
    position        = function(v) return v == 'left' or v == 'right' end,
    performanceMode = function(v) return type(v) == 'boolean' end,
    closeOnPlay     = function(v) return type(v) == 'boolean' end,
    wheelMode       = function(v) return v == 'radial' or v == 'linear' end,
    language        = function(v)
        if type(v) ~= 'string' then return false end
        for _, l in ipairs(SUPPORTED_LANGS) do if l.code == v then return true end end
        return false
    end,
    accent          = function(v)
        if (MBT.Theme and MBT.Theme.AllowAccentChange) == false then return false end
        return type(v) == 'string' and isAccentPreset(v)
    end,
}

RegisterNUICallback('savePref', function(data, cb)
    local validate = PREF_VALIDATORS[data.key]
    if not validate or not validate(data.value) then
        cb({ ok = false })
        return
    end

    if data.key == 'language' then MBT.Language = data.value end
    Core.SetPref(data.key, data.value)

    -- Lua is the source of truth: hand back a freshly merged config + locale so
    -- the UI just re-applies (layout class, position, language strings, etc).
    cb({ ok = true, config = BuildMenuConfig(), locale = BuildLocaleStrings() })
end)

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
        personas       = (MBT.Features.Personas and Core.GetPersonas) and Core.GetPersonas() or nil,
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

    local prefs = (Core.GetPrefs and Core.GetPrefs()) or {}
    local closeOnPlay = MBT.Menu.CloseOnPlay
    if prefs.closeOnPlay ~= nil then closeOnPlay = prefs.closeOnPlay end
    if closeOnPlay then
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
    local wheelMode = (MBT.EmoteWheel.Mode == 'linear') and 'linear' or 'radial'
    local POINTER_SENS = MBT.EmoteWheel.PointerSensitivity or 2.8
    local POINTER_DEADZONE = 0.28
    local TWO_PI = math.pi * 2

    -- Player pref overrides the config default; read at open so a change in
    -- the settings popover takes effect on the next wheel without a restart.
    local function effectiveWheelMode()
        local pref = Core.GetPrefs and Core.GetPrefs().wheelMode
        if pref == 'linear' or pref == 'radial' then return pref end
        return (MBT.EmoteWheel.Mode == 'linear') and 'linear' or 'radial'
    end

    RegisterCommand('+' .. wheelCmdName, function()
        if isOpen or wheelOpen then return end
        wheelOpen = true
        wheelIndex = 1
        wheelMode = effectiveWheelMode()

        SendNUIMessage({
            action   = 'openWheel',
            slots    = Core.GetWheelSlots(),
            index    = wheelIndex,
            maxSlots = maxSlots,
            mode     = wheelMode,
        })

        CreateThread(function()
            local px, py = 0.0, 0.0
            while wheelOpen do
                DisableControlAction(0, 16, true) -- scroll down
                DisableControlAction(0, 17, true) -- scroll up

                if wheelMode == 'radial' then
                    DisableControlAction(0, 1, true) -- look LR
                    DisableControlAction(0, 2, true) -- look UD
                    px = px + GetDisabledControlNormal(0, 1) * POINTER_SENS
                    py = py + GetDisabledControlNormal(0, 2) * POINTER_SENS
                    local mag = math.sqrt(px * px + py * py)
                    if mag > 1.0 then px, py, mag = px / mag, py / mag, 1.0 end

                    local activePtr = mag >= POINTER_DEADZONE
                    if activePtr then
                        local ang = math.atan(px, -py)
                        if ang < 0 then ang = ang + TWO_PI end
                        local sector = math.floor((ang / TWO_PI) * maxSlots + 0.5) % maxSlots + 1
                        if sector ~= wheelIndex then
                            wheelIndex = sector
                            SendNUIMessage({ action = 'wheelIndex', index = wheelIndex })
                        end
                    end

                    SendNUIMessage({ action = 'wheelPointer', x = px, y = py, active = activePtr })
                end

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
            -- Only the positioning phase counts as "placing". Once the player
            -- confirms (state -> 'In Animation') or cancels ('None'), end the
            -- overlay so it doesn't linger over the playing emote.
            local active = (state == 'Previewing' or state == 'Walking')

            if active and not lastActive then
                SendNUIMessage({ action = 'placementStarted' })
                lastActive = true
            elseif not active and lastActive then
                SendNUIMessage({ action = 'placementEnded' })
                lastActive = false
            end

            -- Tight poll while positioning so the overlay clears the instant
            -- the player confirms (state -> 'In Animation'); idle poll otherwise.
            Wait(active and 50 or 500)
        else
            Wait(2000)
        end
    end
end)

-------------------------------------------------------------------------------
-- [ INITIALIZATION ] --
-------------------------------------------------------------------------------

RegisterNetEvent('mbt_emote_menu:receiveEcosystemStatus', function(status)
    ecosystemStatus = status or {}
end)

local CATALOG_RETRY_DELAY_MS = 500
local CATALOG_MAX_RETRIES = 10

local function DetectRpemotesClient()
    if MBT.RpemotesResource and GetResourceState(MBT.RpemotesResource) == 'started' then
        return MBT.RpemotesResource
    end

    for _, name in ipairs({ 'rpemotes-reborn', 'rpemotes', 'rp-emotes', 'rp-emotes-reborn' }) do
        if GetResourceState(name) == 'started' then return name end
    end
end

local function ConfigureRpemotesClient(resourceName)
    if not resourceName then return false end

    rpemotesResource = resourceName
    local provided = GetResourceMetadata(resourceName, 'provide', 0)
    rpemotesExportName = (provided and provided ~= '') and provided or resourceName
    Core._rpemotesExportName = rpemotesExportName
    return true
end

-- Search keyword tokens built from each entry (prop/anim discoverability,
-- e.g. searching "radio" finds prop-radio emotes).
local KW_NOISE = {
    anim = true, prop = true, hand = true, male = true, female = true,
    base = true, clip = true, idle = true, loop = true, pose = true,
    miss = true, scenario = true, world = true, human = true, stand = true,
    holding = true, ['for'] = true, the = true, and_ = true,
}

local function BuildClientKeywords(...)
    local seen, out = {}, {}
    for i = 1, select('#', ...) do
        local s = select(i, ...)
        if type(s) == 'string' then
            for tok in s:gmatch('[%a%d]+') do
                tok = tok:lower()
                if #tok >= 3 and not KW_NOISE[tok] and not seen[tok] then
                    seen[tok] = true
                    out[#out + 1] = tok
                end
            end
        end
    end
    return table.concat(out, ' ')
end

local function FormatEmoteName(name)
    name = tostring(name or ''):gsub('_', ' ')
    return name:gsub('^%l', string.upper)
end

-- rpemotes' GetEmoteCatalog hands back its raw internal entries (dict/anim/
-- label/AnimationOptions/...). We map each one into the NUI view model here.
-- Prop variation `value` is normalised to the one-based selector Execute expects.
local function MapRawEmote(raw)
    if raw.emoji then
        return {
            name = raw.name,
            label = type(raw.label) == 'string' and raw.label or FormatEmoteName(raw.name),
            category = 'Emojis',
            isEmoji = true,
            emoji = raw.emoji,
        }
    end

    local label = raw.label
    if type(label) == 'string' then label = label:gsub('<[^>]+>', '') else label = FormatEmoteName(raw.name) end

    local opts = raw.AnimationOptions
    local hasProp, variations, animFlag, blendIn, blendOut, duration
    local prop, propBone, propPlace, prop2, prop2Bone, prop2Place

    if type(opts) == 'table' then
        hasProp = opts.Prop ~= nil
        if opts.PropTextureVariations then
            variations = {}
            for i, v in ipairs(opts.PropTextureVariations) do
                local clean = (v.Name or ''):gsub('<[^>]+>', ''):gsub('%s+$', '')
                variations[i] = { name = clean, value = i, textureValue = v.Value }
            end
        end
        animFlag = opts.onFootFlag or (opts.EmoteMoving and 51 or 1)
        blendIn  = opts.BlendInSpeed or 5.0
        blendOut = opts.BlendOutSpeed or 5.0
        duration = opts.EmoteDuration or -1
        if opts.Prop then
            prop, propBone = opts.Prop, opts.PropBone or 28422
            local pp = opts.PropPlacement
            if pp then propPlace = { pp[1] or 0.0, pp[2] or 0.0, pp[3] or 0.0, pp[4] or 0.0, pp[5] or 0.0, pp[6] or 0.0 } end
        end
        if opts.SecondProp then
            prop2, prop2Bone = opts.SecondProp, opts.SecondPropBone or 60309
            local sp = opts.SecondPropPlacement
            if sp then prop2Place = { sp[1] or 0.0, sp[2] or 0.0, sp[3] or 0.0, sp[4] or 0.0, sp[5] or 0.0, sp[6] or 0.0 } end
        end
    end

    return {
        name       = raw.name,
        label      = label,
        keywords   = BuildClientKeywords(raw.name, label, prop, prop2, raw.anim, raw.dict),
        category   = raw.emoteType,
        hasProp    = hasProp,
        isShared   = raw.emoteType == 'Shared',
        variations = variations,
        animDict   = raw.dict,
        animClip   = raw.anim,
        scenario   = raw.scenario,
        animFlag   = animFlag,
        blendIn    = blendIn,
        blendOut   = blendOut,
        duration   = duration,
        prop       = prop,
        propBone   = propBone,
        propPlace  = propPlace,
        prop2      = prop2,
        prop2Bone  = prop2Bone,
        prop2Place = prop2Place,
    }
end

local function ApplyExportCatalog(entries)
    if type(entries) ~= 'table' or #entries == 0 then
        return false
    end

    local banned = {}
    for _, n in ipairs(MBT.BannedEmotes or {}) do
        if type(n) == 'string' then banned[n:lower()] = true end
    end

    local catalog, emojiCount = {}, 0
    for _, raw in ipairs(entries) do
        if type(raw) == 'table' and raw.name and not banned[tostring(raw.name):lower()] then
            local entry = MapRawEmote(raw)
            catalog[#catalog + 1] = entry
            if entry.isEmoji then emojiCount = emojiCount + 1 end
        end
    end
    table.sort(catalog, function(a, b) return (a.label or ''):lower() < (b.label or ''):lower() end)

    emoteCatalog = catalog
    catalogSentToNui = false
    emoteLabelByName = {}
    for _, entry in ipairs(emoteCatalog) do
        if entry.name then emoteLabelByName[entry.name] = entry.label or entry.name end
    end

    if MBT.Features.EmotePlacement ~= false then
        local _, ok = Utils.SafeExport(rpemotesExportName, 'GetPlacementState')
        placementAvailable = ok
    end

    SendNUIMessage({
        action = 'preloadCatalog',
        catalog = emoteCatalog,
        locale = BuildLocaleStrings(),
        config = BuildMenuConfig(),
    })
    catalogSentToNui = true

    Utils.MbtDebugger(('[catalog] Loaded %d entries (%d emojis)'):format(#emoteCatalog, emojiCount))

    if pendingOpen and (GetGameTimer() - pendingOpenAt) <= PENDING_OPEN_TTL_MS then
        pendingOpen = false
        Core.OpenMenu()
    end
    return true
end

local function TryExportCatalog()
    if not ConfigureRpemotesClient(DetectRpemotesClient()) then return false end
    local payload, ok = Utils.SafeExport(rpemotesExportName, 'GetEmoteCatalog')
    return ok and ApplyExportCatalog(payload)
end

-- Minimum rpemotes-reborn version that ships the GetEmoteCatalog / Execute exports.
local RPEMOTES_MIN_VERSION = '2.1.2'

RequestEmoteCatalog = function(attempt)
    attempt = attempt or 1

    local rpRes = DetectRpemotesClient()
    if rpRes then
        local ok, ver = Utils.CheckResourceVersion(rpRes, RPEMOTES_MIN_VERSION)
        -- Hard-stop only on a KNOWN-too-old version. If the version is unreadable
        -- ('unknown'), let the export itself be the gate (it either works or it
        -- doesn't), so a fork/odd manifest with working exports isn't locked out.
        if not ok and ver ~= 'unknown' then
            print(('^1[mbt_emote_menu] requires rpemotes-reborn %s+ (found %s: %s). Update rpemotes-reborn. Menu disabled.^0')
                :format(RPEMOTES_MIN_VERSION, rpRes, ver))
            return
        end
        if TryExportCatalog() then return end
    end

    -- rpemotes not started yet, or export still converting: keep polling.
    SetTimeout(CATALOG_RETRY_DELAY_MS, function()
        if #emoteCatalog > 0 then return end
        if attempt >= CATALOG_MAX_RETRIES then
            print(('^1[mbt_emote_menu] rpemotes-reborn %s+ export not found after retries. Is it started?^0')
                :format(RPEMOTES_MIN_VERSION))
            return
        end
        RequestEmoteCatalog(attempt + 1)
    end)
end

-- Recover from start-order and live restarts: when rpemotes (re)starts, refetch
-- the catalog. Covers mbt booting before rpemotes (5s retry window may lapse) and
-- a hot `restart rpemotes-reborn` while the menu is already loaded.
AddEventHandler('onResourceStart', function(res)
    if res == MBT.RpemotesResource or res == 'rpemotes-reborn' or res == 'rpemotes'
        or res == 'rp-emotes' or res == 'rp-emotes-reborn' then
        emoteCatalog = {}
        catalogSentToNui = false
        SetTimeout(1000, RequestEmoteCatalog) -- let rpemotes convert its list first
    end
end)

RegisterCommand('mbt_emote_source', function()
    print(('^5[mbt_emote_menu] resource=%s exports=%s entries=%d^0')
        :format(tostring(rpemotesResource), tostring(rpemotesExportName), #emoteCatalog))
end, false)

RegisterCommand('mbt_emote_reload', function()
    emoteCatalog = {}
    catalogSentToNui = false
    print('^5[mbt_emote_menu] Reloading catalog from rpemotes export...^0')
    RequestEmoteCatalog()
end, false)

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
