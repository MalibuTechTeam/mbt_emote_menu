-------------------------------------------------------------------------------
-- [ OPEN JOIN — SERVER ] --
--
-- Anonymous proximity broadcast of emote invitations. When a client signals
-- that they've played an emote in one of the broadcast categories, we relay a
-- "join in" prompt to every player within Config.Radius of the initiator.
--
-- The initiator's identity is never sent to recipients — the client UI only
-- learns the emote name + label, in line with the privacy-friendly UX the
-- product is positioned around.
-------------------------------------------------------------------------------

if not MBT.Features or MBT.Features.OpenJoin == false then return end

local lastAnnounce = {}

local function getCategorySet()
    local set = {}
    for _, c in ipairs((MBT.OpenJoin and MBT.OpenJoin.BroadcastCategories) or {}) do
        set[c] = true
    end
    return set
end

local function getBannedSet()
    local set = {}
    for _, name in ipairs(MBT.BannedEmotes or {}) do
        if type(name) == 'string' then set[name:lower()] = true end
    end
    return set
end

local categorySet = getCategorySet()
local bannedSet = getBannedSet()

local function findPlayersInRange(originSrc, radius, maxRecipients)
    local originPed = GetPlayerPed(originSrc)
    if not originPed or originPed == 0 then return {} end
    local origin = GetEntityCoords(originPed)
    local candidates = {}
    for _, playerId in ipairs(GetPlayers()) do
        local pid = tonumber(playerId)
        if pid and pid ~= originSrc then
            local ped = GetPlayerPed(pid)
            if ped and ped ~= 0 then
                local coords = GetEntityCoords(ped)
                local dist = #(origin - coords)
                if dist <= radius then
                    candidates[#candidates + 1] = { id = pid, dist = dist }
                end
            end
        end
    end

    if maxRecipients and maxRecipients > 0 and #candidates > maxRecipients then
        table.sort(candidates, function(a, b) return a.dist < b.dist end)
        for i = maxRecipients + 1, #candidates do candidates[i] = nil end
    end

    local out = {}
    for _, c in ipairs(candidates) do out[#out + 1] = c.id end
    return out
end

RegisterNetEvent('mbt_emote_menu:server:announceOpenJoin', function(emoteName, emoteLabel, emoteCategory)
    local src = source
    if not src or src <= 0 then return end

    if type(emoteName) ~= 'string' or type(emoteCategory) ~= 'string' then return end
    emoteName = emoteName:sub(1, 64)
    if emoteName == '' then return end

    if not categorySet[emoteCategory] then return end
    if bannedSet[emoteName:lower()] then return end

    local ok, bag = pcall(function() return Player(src).state end)
    if ok and bag then
        local current = bag.mbtCurrentEmote
        if type(current) == 'table' and type(current.name) == 'string' then
            if current.name ~= emoteName then return end
        end
    end

    local cooldown = (MBT.OpenJoin and MBT.OpenJoin.AnnounceCooldownMs) or 5000
    local now = GetGameTimer()
    local last = lastAnnounce[src]
    if last and (now - last) < cooldown then return end
    lastAnnounce[src] = now

    local radius = (MBT.OpenJoin and MBT.OpenJoin.Radius) or 8.0
    local maxRecipients = MBT.OpenJoin and MBT.OpenJoin.MaxRecipients
    local targets = findPlayersInRange(src, radius, maxRecipients)
    if #targets == 0 then return end

    local label = type(emoteLabel) == 'string' and emoteLabel:sub(1, 64) or emoteName

    for _, targetId in ipairs(targets) do
        TriggerClientEvent('mbt_emote_menu:client:openJoinInvitation', targetId, emoteName, label, emoteCategory)
    end
end)

AddEventHandler('playerDropped', function()
    local src = source
    if not src then return end
    lastAnnounce[src] = nil
    local ok, state = pcall(function() return Player(src).state end)
    if ok and state then
        state:set('mbtCurrentEmote', nil, true)
    end
end)
