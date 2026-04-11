Core                  = Core or {}

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

RegisterNUICallback('wheelScroll', function(_, cb)
    cb({ ok = true })
end)
