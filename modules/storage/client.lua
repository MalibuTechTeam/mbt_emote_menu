Core                  = Core or {}

-------------------------------------------------------------------------------
-- [ PLAYER PREFERENCES ] --
-------------------------------------------------------------------------------
-- Per-player UI settings shown in the menu's "..." settings popover. The
-- config.lua values are the defaults; saved prefs override them where the
-- owner allows it (see Core.SavePref in core/client.lua).

local prefsKVP    = 'mbt_emote_menu_prefs'
local cachedPrefs = nil

function Core.GetPrefs()
    if not cachedPrefs then cachedPrefs = Utils.LoadKvpJson(prefsKVP) or {} end
    return cachedPrefs
end

function Core.SetPref(key, value)
    local prefs = Core.GetPrefs()
    prefs[key] = value
    Utils.SaveKvpJson(prefsKVP, prefs)
    return prefs
end

-- Apply a saved language override before the menu ever builds its strings.
-- An unknown code is harmless: Translate() falls back to English.
do
    local savedLang = Core.GetPrefs().language
    if type(savedLang) == 'string' and savedLang ~= '' then
        MBT.Language = savedLang
    end
end

-------------------------------------------------------------------------------
-- [ FAVORITES ] --
-------------------------------------------------------------------------------

local favoritesKVP    = 'mbt_emote_menu_favorites'
local favOrderKVP     = 'mbt_emote_menu_fav_order'
local cachedFavorites = nil
local cachedFavOrder  = nil

local function LoadFavorites()
    cachedFavorites = Utils.LoadKvpJson(favoritesKVP) or {}
    cachedFavOrder  = Utils.LoadKvpJson(favOrderKVP) or {}
end

function Core.GetFavorites()
    if not cachedFavorites then LoadFavorites() end
    return cachedFavorites
end

function Core.GetFavOrder()
    if not cachedFavOrder then LoadFavorites() end
    return cachedFavOrder
end

function Core.ToggleFavorite(emoteName, emoteData)
    if not cachedFavorites then LoadFavorites() end
    if cachedFavorites[emoteName] then
        cachedFavorites[emoteName] = nil
        for i, name in ipairs(cachedFavOrder) do
            if name == emoteName then
                table.remove(cachedFavOrder, i)
                break
            end
        end
        Utils.MbtDebugger('Removed favorite: ' .. emoteName)
    else
        cachedFavorites[emoteName] = emoteData or true
        cachedFavOrder[#cachedFavOrder + 1] = emoteName
        Utils.MbtDebugger('Added favorite: ' .. emoteName)
    end
    Utils.SaveKvpJson(favoritesKVP, cachedFavorites)
    Utils.SaveKvpJson(favOrderKVP, cachedFavOrder)
end

function Core.SetFavOrder(newOrder)
    cachedFavOrder = newOrder
    Utils.SaveKvpJson(favOrderKVP, cachedFavOrder)
end

function Core.ImportFavorites(newFavs)
    cachedFavorites = newFavs
    cachedFavOrder = {}
    for name, _ in pairs(newFavs) do
        cachedFavOrder[#cachedFavOrder + 1] = name
    end
    table.sort(cachedFavOrder)
    Utils.SaveKvpJson(favoritesKVP, cachedFavorites)
    Utils.SaveKvpJson(favOrderKVP, cachedFavOrder)
    Utils.MbtDebugger('Imported favorites')
    return cachedFavorites, cachedFavOrder
end

-------------------------------------------------------------------------------
-- [ PLAY COUNTS ] --
-------------------------------------------------------------------------------

local playCountsKVP = 'mbt_emote_menu_playcounts'
local cachedPlayCounts = nil

function Core.GetPlayCounts()
    if not cachedPlayCounts then cachedPlayCounts = Utils.LoadKvpJson(playCountsKVP) or {} end
    return cachedPlayCounts
end

function Core.IncrementPlayCount(emoteName)
    if not cachedPlayCounts then cachedPlayCounts = Utils.LoadKvpJson(playCountsKVP) or {} end
    cachedPlayCounts[emoteName] = (cachedPlayCounts[emoteName] or 0) + 1
    Utils.SaveKvpJson(playCountsKVP, cachedPlayCounts)
end

-------------------------------------------------------------------------------
-- [ CUSTOM LISTS ] --
-------------------------------------------------------------------------------

local customListsKVP = 'mbt_emote_menu_lists'
local cachedCustomLists = nil

function Core.GetCustomLists()
    if not cachedCustomLists then cachedCustomLists = Utils.LoadKvpJson(customListsKVP) or {} end
    return cachedCustomLists
end

function Core.SaveCustomLists(lists)
    cachedCustomLists = lists or {}
    Utils.SaveKvpJson(customListsKVP, cachedCustomLists)
    Utils.MbtDebugger('Saved custom lists: ' .. #cachedCustomLists .. ' lists')
end

-------------------------------------------------------------------------------
-- [ RECENT EMOTES ] --
-------------------------------------------------------------------------------

local recentKVP = 'mbt_emote_menu_recent'
Core._recentEmotes = {}

function Core.AddRecent(emoteData)
    for i, v in ipairs(Core._recentEmotes) do
        if v.name == emoteData.name then
            table.remove(Core._recentEmotes, i)
            break
        end
    end
    local entry = {}
    for k, v in pairs(emoteData) do
        entry[k] = v
    end
    table.insert(Core._recentEmotes, 1, entry)
    while #Core._recentEmotes > (MBT.Features.MaxRecent or 12) do
        table.remove(Core._recentEmotes)
    end
    Utils.SaveKvpJson(recentKVP, Core._recentEmotes)
end

function Core.LoadRecent()
    Core._recentEmotes = Utils.LoadKvpJson(recentKVP) or {}
end

-------------------------------------------------------------------------------
-- [ KEYBINDS ] --
-------------------------------------------------------------------------------

local keybindKVP = 'mbt_emote_menu_binds'
local cachedKeybinds = nil

function Core.GetKeybinds()
    if not cachedKeybinds then cachedKeybinds = Utils.LoadKvpJson(keybindKVP) or {} end
    return cachedKeybinds
end

function Core.SetKeybind(slot, emoteData)
    if not cachedKeybinds then cachedKeybinds = Utils.LoadKvpJson(keybindKVP) or {} end
    cachedKeybinds[tostring(slot)] = emoteData
    Utils.SaveKvpJson(keybindKVP, cachedKeybinds)
    if Core._scheduleSyncActivePersona then Core._scheduleSyncActivePersona() end
    Utils.MbtDebugger('Set keybind slot ' .. tostring(slot) .. ' = ' .. (emoteData and emoteData.name or 'nil'))
end

-------------------------------------------------------------------------------
-- [ EMOTE WHEEL SLOTS ] --
-------------------------------------------------------------------------------

local wheelKVP = 'mbt_emote_menu_wheel'
local cachedWheelSlots = nil

function Core.GetWheelSlots()
    if not cachedWheelSlots then cachedWheelSlots = Utils.LoadKvpJson(wheelKVP) or {} end
    return cachedWheelSlots
end

function Core.SetWheelSlot(slot, emoteData)
    if not cachedWheelSlots then cachedWheelSlots = Utils.LoadKvpJson(wheelKVP) or {} end
    cachedWheelSlots[tostring(slot)] = emoteData
    Utils.SaveKvpJson(wheelKVP, cachedWheelSlots)
    if Core._scheduleSyncActivePersona then Core._scheduleSyncActivePersona() end
    Utils.MbtDebugger('Wheel slot ' .. tostring(slot) .. ' = ' .. (emoteData and emoteData.name or 'nil'))
end

-------------------------------------------------------------------------------
-- [ NUI CALLBACKS (storage-related) ] --
-------------------------------------------------------------------------------

RegisterNUICallback('toggleFavorite', function(data, cb)
    local name = data.name
    if type(name) ~= 'string' or name == '' then
        cb({ ok = false })
        return
    end
    Core.ToggleFavorite(name, data.emote)
    cb({ ok = true, favorites = Core.GetFavorites(), favOrder = Core.GetFavOrder() })
end)

RegisterNUICallback('reorderFavorites', function(data, cb)
    local newOrder = data.order
    if type(newOrder) ~= 'table' then
        cb({ ok = false })
        return
    end
    Core.SetFavOrder(newOrder)
    Utils.MbtDebugger('Reordered favorites: ' .. #newOrder .. ' items')
    cb({ ok = true })
end)

RegisterNUICallback('importFavorites', function(data, cb)
    local newFavs = data.favorites
    if type(newFavs) ~= 'table' then
        cb({ ok = false })
        return
    end
    local favorites, favOrder = Core.ImportFavorites(newFavs)
    cb({ ok = true, favorites = favorites, favOrder = favOrder })
end)

RegisterNUICallback('setKeybind', function(data, cb)
    local slot = tonumber(data.slot)
    if not slot or slot < 1 or slot > 6 then
        cb({ ok = false })
        return
    end
    if data.emote ~= nil and type(data.emote) ~= 'table' then
        cb({ ok = false })
        return
    end
    Core.SetKeybind(slot, data.emote)
    cb({ ok = true })
end)

RegisterNUICallback('getCustomLists', function(_, cb)
    cb({ ok = true, lists = Core.GetCustomLists() })
end)

RegisterNUICallback('saveCustomLists', function(data, cb)
    if type(data.lists) ~= 'table' or #data.lists > 64 then
        cb({ ok = false })
        return
    end
    Core.SaveCustomLists(data.lists)
    cb({ ok = true })
end)

RegisterNUICallback('setWheelSlot', function(data, cb)
    local slot = tonumber(data.slot)
    local maxSlots = (MBT.EmoteWheel and MBT.EmoteWheel.Slots) or 8
    if not slot or slot < 1 or slot > maxSlots then
        cb({ ok = false })
        return
    end
    if data.emote ~= nil and type(data.emote) ~= 'table' then
        cb({ ok = false })
        return
    end
    Core.SetWheelSlot(slot, data.emote)
    cb({ ok = true })
end)

RegisterNUICallback('getWheelSlots', function(_, cb)
    cb({ ok = true, slots = Core.GetWheelSlots() })
end)

-------------------------------------------------------------------------------
-- [ PERSONAS / LOADOUTS ] --
-------------------------------------------------------------------------------

if MBT.Features.Personas then
    local personasKVP = 'mbt_emote_menu_personas'
    local cachedPersonas = nil
    local MAX_PERSONAS = (MBT.Personas and MBT.Personas.Max) or 10
    local personaSeq = 0

    local function deepcopy(t)
        if type(t) ~= 'table' then return t end
        local out = {}
        for k, v in pairs(t) do out[k] = (type(v) == 'table') and deepcopy(v) or v end
        return out
    end

    local function newId()
        personaSeq = personaSeq + 1
        return ('persona_%d_%d'):format(GetGameTimer(), personaSeq)
    end

    local function LoadPersonas()
        cachedPersonas = Utils.LoadKvpJson(personasKVP)
        if type(cachedPersonas) ~= 'table' or type(cachedPersonas.personas) ~= 'table'
            or #cachedPersonas.personas == 0 then
            cachedPersonas = {
                activeId = 'default',
                personas = {
                    {
                        id    = 'default',
                        name  = 'Default',
                        binds = deepcopy(Core.GetKeybinds()),
                        wheel = deepcopy(Core.GetWheelSlots()),
                    },
                },
            }
            Utils.SaveKvpJson(personasKVP, cachedPersonas)
        end
        return cachedPersonas
    end

    local function byId(id)
        if not cachedPersonas then LoadPersonas() end
        for _, p in ipairs(cachedPersonas.personas) do
            if p.id == id then return p end
        end
        return nil
    end

    function Core.GetPersonas()
        if not cachedPersonas then LoadPersonas() end
        local list = {}
        for _, p in ipairs(cachedPersonas.personas) do
            list[#list + 1] = { id = p.id, name = p.name, locked = (p.id == 'default') }
        end
        return { activeId = cachedPersonas.activeId, personas = list, max = MAX_PERSONAS }
    end

    function Core.GetActivePersona()
        if not cachedPersonas then LoadPersonas() end
        return byId(cachedPersonas.activeId) or cachedPersonas.personas[1]
    end

    function Core.SyncActivePersona()
        if not cachedPersonas then return end
        local p = byId(cachedPersonas.activeId)
        if not p then return end
        p.binds = deepcopy(cachedKeybinds or {})
        p.wheel = deepcopy(cachedWheelSlots or {})
        Utils.SaveKvpJson(personasKVP, cachedPersonas)
    end

    local syncScheduled = false
    function Core._scheduleSyncActivePersona()
        if syncScheduled then return end
        syncScheduled = true
        SetTimeout(500, function()
            syncScheduled = false
            Core.SyncActivePersona()
        end)
    end

    function Core.SwitchPersona(id)
        local p = byId(id)
        if not p then return nil end
        cachedPersonas.activeId = id
        cachedKeybinds   = deepcopy(p.binds or {})
        cachedWheelSlots = deepcopy(p.wheel or {})
        Utils.SaveKvpJson(keybindKVP, cachedKeybinds)
        Utils.SaveKvpJson(wheelKVP, cachedWheelSlots)
        Utils.SaveKvpJson(personasKVP, cachedPersonas)
        return { binds = cachedKeybinds, wheel = cachedWheelSlots, activeId = id }
    end

    function Core.CreatePersona(name)
        if not cachedPersonas then LoadPersonas() end
        if #cachedPersonas.personas >= MAX_PERSONAS then return nil, 'max' end
        local id = newId()
        local clean = (type(name) == 'string' and name:gsub('^%s*(.-)%s*$', '%1') or '')
        if clean == '' then clean = 'Persona ' .. (#cachedPersonas.personas + 1) end
        cachedPersonas.personas[#cachedPersonas.personas + 1] = {
            id    = id,
            name  = clean:sub(1, 24),
            binds = deepcopy(Core.GetKeybinds()),
            wheel = deepcopy(Core.GetWheelSlots()),
        }
        cachedPersonas.activeId = id
        Utils.SaveKvpJson(personasKVP, cachedPersonas)
        return { id = id, name = clean:sub(1, 24) }
    end

    function Core.RenamePersona(id, name)
        local p = byId(id)
        if not p then return false end
        local clean = (type(name) == 'string' and name:gsub('^%s*(.-)%s*$', '%1') or '')
        if clean == '' then return false end
        p.name = clean:sub(1, 24)
        Utils.SaveKvpJson(personasKVP, cachedPersonas)
        return true
    end

    function Core.DeletePersona(id)
        if not cachedPersonas then LoadPersonas() end
        if id == 'default' then return false end
        if #cachedPersonas.personas <= 1 then return false end
        local idx
        for i, p in ipairs(cachedPersonas.personas) do
            if p.id == id then idx = i break end
        end
        if not idx then return false end
        table.remove(cachedPersonas.personas, idx)
        if cachedPersonas.activeId == id then
            local fallback = byId('default') or cachedPersonas.personas[1]
            Core.SwitchPersona(fallback.id)
        else
            Utils.SaveKvpJson(personasKVP, cachedPersonas)
        end
        return true
    end

    ---------------------------------------------------------------------------
    -- NUI callbacks
    ---------------------------------------------------------------------------

    RegisterNUICallback('getPersonas', function(_, cb)
        cb({ ok = true, data = Core.GetPersonas() })
    end)

    RegisterNUICallback('switchPersona', function(data, cb)
        local r = Core.SwitchPersona(data.id)
        if r then
            cb({ ok = true, binds = r.binds, wheel = r.wheel, activeId = r.activeId })
        else
            cb({ ok = false })
        end
    end)

    RegisterNUICallback('createPersona', function(data, cb)
        local p, err = Core.CreatePersona(data.name)
        if p then
            cb({ ok = true, persona = p, data = Core.GetPersonas() })
        else
            cb({ ok = false, error = err })
        end
    end)

    RegisterNUICallback('renamePersona', function(data, cb)
        local ok = Core.RenamePersona(data.id, data.name)
        cb({ ok = ok and true or false, data = Core.GetPersonas() })
    end)

    RegisterNUICallback('deletePersona', function(data, cb)
        local ok = Core.DeletePersona(data.id)
        cb({
            ok       = ok and true or false,
            data     = Core.GetPersonas(),
            binds    = Core.GetKeybinds(),
            wheel    = Core.GetWheelSlots(),
        })
    end)

    AddEventHandler('onResourceStop', function(res)
        if res == GetCurrentResourceName() and Core.SyncActivePersona then
            Core.SyncActivePersona()
        end
    end)
end
