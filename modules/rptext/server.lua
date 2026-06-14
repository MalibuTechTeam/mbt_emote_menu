local cfg = MBT.RpText or {}

local channels = {}
for _, ch in ipairs(cfg.Channels or {}) do
    if type(ch) == 'table' and type(ch.id) == 'string' then
        channels[ch.id] = ch
    end
end

-- RP-text ownership handshake (mirror del client). Server-side cosi' che i
-- resource che gate-ano lato server (es. mbt_hud chat ACL) possano interrogarlo
-- in modo coerente. Ritorna { command -> true } che possediamo.
exports('ProvidesRpText', function()
    local owned = {}
    if cfg.Enabled then
        for _, ch in ipairs(cfg.Channels or {}) do
            if type(ch) == 'table' and type(ch.command) == 'string' then
                owned[ch.command] = true
            end
        end
    end
    return owned
end)

local lastUse = {}

local function clampChars(text, maxChars)
    local len = utf8.len(text)
    if not len then return text:sub(1, maxChars) end -- invalid utf8 fallback
    if len <= maxChars then return text end
    local byteEnd = utf8.offset(text, maxChars + 1)
    return byteEnd and text:sub(1, byteEnd - 1) or text:sub(1, maxChars)
end

local function sanitize(text, maxChars)
    if type(text) ~= 'string' then return nil end
    text = text:gsub('%c', ' '):gsub('%s+', ' ')
    text = text:match('^%s*(.-)%s*$')
    if not text or text == '' then return nil end
    return clampChars(text, maxChars)
end

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

RegisterNetEvent('mbt_emote_menu:server:rpText', function(channelId, text)
    if not cfg.Enabled then return end

    local src = source
    if not src or src <= 0 then return end
    if type(channelId) ~= 'string' then return end

    local ch = channels[channelId]
    if not ch then return end

    text = sanitize(text, cfg.MaxLength or 110)
    if not text then return end

    local now = GetGameTimer()
    local throttle = cfg.ThrottleMs or 1000
    if lastUse[src] and (now - lastUse[src]) < throttle then return end
    lastUse[src] = now

    local targets = findRecipientsInRange(src, ch.range or 16.0)
    for i = 1, #targets do
        TriggerClientEvent('mbt_emote_menu:client:rpText', targets[i], channelId, text, src)
    end
end)

AddEventHandler('playerDropped', function()
    local src = source
    if src then lastUse[src] = nil end
end)
