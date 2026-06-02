local cfg = MBT.PhotoMode or {}
local dc  = cfg.Discord or {}

if not cfg.Enabled or not dc.Enabled then return end

local MBT_LOGO = 'https://raw.githubusercontent.com/MalibuTechTeam/mbt_emote_menu/main/.github/release-assets/mbt-logo.png'
local lastSend = {}

-- Append ?wait=true so Discord returns the created message, letting the client
-- confirm success. Respects a webhook URL that already has a query string.
local function withWait(url)
    if url:find('?', 1, true) then return url .. '&wait=true' end
    return url .. '?wait=true'
end

RegisterNetEvent('mbt_emote_menu:server:photoUploadRequest', function()
    local src = source
    if not src or src <= 0 then return end

    if type(dc.WebhookUrl) ~= 'string' or dc.WebhookUrl == '' then
        TriggerClientEvent('mbt_emote_menu:client:photoUploadResult', src, false, 'not-configured')
        return
    end

    local now = GetGameTimer()
    local throttle = dc.ThrottleMs or 30000
    if lastSend[src] and (now - lastSend[src]) < throttle then
        TriggerClientEvent('mbt_emote_menu:client:photoUploadResult', src, false, 'throttled')
        return
    end
    lastSend[src] = now

    TriggerClientEvent('mbt_emote_menu:client:photoUploadReady', src, withWait(dc.WebhookUrl))
end)

RegisterNetEvent('mbt_emote_menu:server:photoEnrich', function(messageId, area, gameTime)
    local src = source
    if not src or src <= 0 then return end
    if type(dc.WebhookUrl) ~= 'string' or dc.WebhookUrl == '' then return end
    if type(messageId) ~= 'string' or not messageId:match('^%d+$') then return end

    local style = dc.Style or 'embed'
    if style == 'image' then return end

    local playerName
    local okState, state = pcall(function() return Player(src).state end)
    if okState and state and type(state.mbt_charname) == 'string' and state.mbt_charname ~= '' then
        playerName = state.mbt_charname
    else
        playerName = GetPlayerName(src) or ('player ' .. src)
    end

    local fields = {}
    if type(area) == 'string' and area ~= '' and area ~= 'NULL' then
        fields[#fields + 1] = { name = 'Location', value = area:sub(1, 120), inline = true }
    end
    if type(gameTime) == 'string' and gameTime:match('^%d%d?:%d%d$') then
        fields[#fields + 1] = { name = 'In-game time', value = gameTime, inline = true }
    end

    local embed = {
        author    = { name = '📸 ' .. playerName:sub(1, 80) },
        color     = 0x00E676,
        fields    = fields,
        footer    = { text = ('MBT Photo Mode · #%d'):format(src) },
        timestamp = os.date('!%Y-%m-%dT%H:%M:%S.000Z'),
    }
    if type(cfg.Caption) == 'string' and cfg.Caption ~= '' then
        embed.description = cfg.Caption:sub(1, 200)
    end
    if type(cfg.LogoUrl) == 'string' and cfg.LogoUrl:match('^https?://') then
        embed.thumbnail = { url = cfg.LogoUrl }
    end
    embed.footer.icon_url = MBT_LOGO
    local patchUrl = dc.WebhookUrl:gsub('%?.*$', '') .. '/messages/' .. messageId
    local body = json.encode({ embeds = { embed } })

    PerformHttpRequest(patchUrl, function() end, 'PATCH', body,
        { ['Content-Type'] = 'application/json' })
end)

AddEventHandler('playerDropped', function()
    local src = source
    if src then lastSend[src] = nil end
end)
