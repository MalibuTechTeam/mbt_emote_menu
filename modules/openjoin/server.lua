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

local categorySet = getCategorySet()

local function findPlayersInRange(originSrc, radius)
    local origin = GetEntityCoords(GetPlayerPed(originSrc))
    local out = {}
    for _, playerId in ipairs(GetPlayers()) do
        local pid = tonumber(playerId)
        if pid and pid ~= originSrc then
            local ped = GetPlayerPed(pid)
            if ped and ped ~= 0 then
                local coords = GetEntityCoords(ped)
                if #(origin - coords) <= radius then
                    out[#out + 1] = pid
                end
            end
        end
    end
    return out
end

RegisterNetEvent('mbt_emote_menu:server:announceOpenJoin', function(emoteName, emoteLabel, emoteCategory)
    local src = source
    if not src or src <= 0 then return end

    if type(emoteName) ~= 'string' or type(emoteCategory) ~= 'string' then return end
    if not categorySet[emoteCategory] then return end

    local cooldown = (MBT.OpenJoin and MBT.OpenJoin.AnnounceCooldownMs) or 5000
    local now = GetGameTimer()
    local last = lastAnnounce[src]
    if last and (now - last) < cooldown then return end
    lastAnnounce[src] = now

    local radius = (MBT.OpenJoin and MBT.OpenJoin.Radius) or 8.0
    local targets = findPlayersInRange(src, radius)
    if #targets == 0 then return end

    local label = type(emoteLabel) == 'string' and emoteLabel:sub(1, 64) or emoteName

    for _, targetId in ipairs(targets) do
        TriggerClientEvent('mbt_emote_menu:client:openJoinInvitation', targetId, emoteName, label, emoteCategory)
    end
end)

AddEventHandler('playerDropped', function()
    local src = source
    if src then lastAnnounce[src] = nil end
end)
