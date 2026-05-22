-------------------------------------------------------------------------------
-- [ EMOJI REACTIONS — Server ]
--
-- Validates emoji reaction requests, throttles them per player, and relays the
-- resolved glyph only to players within range of the initiator.
--
-- The emoji char is resolved server-side from MBT.Emoji.List, so a tampered
-- client can never broadcast arbitrary text above another player's head — it
-- can only pick a valid emoji id. Recipients are filtered by distance (same
-- pattern as modules/openjoin) so the event never travels across the whole
-- map to players who'd cull it client-side anyway.
--
-- Self-contained port of the standalone mbt_emoji resource (no ox_lib).
-------------------------------------------------------------------------------

local cfg = MBT.Emoji or {}

-- id -> char lookup, built once from config.
local emojiChars = {}
for _, e in ipairs(cfg.List or {}) do
    if type(e) == 'table' and type(e.id) == 'string' and type(e.char) == 'string' then
        emojiChars[e.id] = e.char
    end
end

-- Per-source throttle timestamps (server uptime ms).
local lastPlay = {}

--- Server-side list of players within `radius` of the initiator, INCLUDING
--- the initiator (they see their own emoji overhead). Returns server ids.
--- Relies on OneSync for server-side entity coords (declared in fxmanifest).
local function findRecipientsInRange(originSrc, radius)
    local originPed = GetPlayerPed(originSrc)
    if not originPed or originPed == 0 then return {} end

    local origin = GetEntityCoords(originPed)
    local out = { originSrc }

    for _, playerId in ipairs(GetPlayers()) do
        local pid = tonumber(playerId)
        if pid and pid ~= originSrc then
            local ped = GetPlayerPed(pid)
            if ped and ped ~= 0 then
                if #(origin - GetEntityCoords(ped)) <= radius then
                    out[#out + 1] = pid
                end
            end
        end
    end

    return out
end

RegisterNetEvent('mbt_emote_menu:server:playEmoji', function(id)
    if not cfg.Enabled then return end

    local src = source
    if not src or src <= 0 then return end
    if type(id) ~= 'string' then return end

    local char = emojiChars[id]
    if not char then return end -- unknown / tampered id

    local now = GetGameTimer()
    local throttle = cfg.ThrottleMs or 1500
    local last = lastPlay[src]
    if last and (now - last) < throttle then return end
    lastPlay[src] = now

    local radius = cfg.MaxDistance or 60.0
    local targets = findRecipientsInRange(src, radius)
    for i = 1, #targets do
        TriggerClientEvent('mbt_emote_menu:client:showEmoji', targets[i], char, src)
    end
end)

AddEventHandler('playerDropped', function()
    local src = source
    if src then lastPlay[src] = nil end
end)
