-------------------------------------------------------------------------------
-- [ RP TEXT — Client ]
--
-- Receives /me and /do messages and floats a styled pill above the author's
-- head via the NUI, using the same world-to-screen projection pattern as
-- modules/whatsthat (World3dToScreen2d -> --mbt-x/--mbt-y CSS vars).
--
-- Unlike the standalone mbt_me this supports MULTIPLE simultaneous pills (one
-- or more per player) and never builds HTML — the text is handed to React as
-- data, so a player typing markup cannot inject anything into the NUI.
-------------------------------------------------------------------------------

local cfg = MBT.RpText or {}

local HEAD_BONE   = 31086 -- SKEL_Head — anchor point for the pill
local BASE_OFFSET = cfg.HeadOffset or 0.25 -- metres above the head bone (config-tunable)
local STACK_STEP  = 0.30  -- extra metres per stacked pill on the same player
local DURATION    = cfg.DurationMs or 6500

local channelInfo = {}
for _, ch in ipairs(cfg.Channels or {}) do
    if type(ch) == 'table' and type(ch.id) == 'string' then
        channelInfo[ch.id] = {
            label   = ch.label or ch.id:upper(),
            range   = ch.range or 16.0,
            command = ch.command,
            color   = type(ch.color) == 'string' and ch.color or nil,
        }
    end
end

local bubbles = {}
local seq = 0
local renderRunning = false
local startRender

-------------------------------------------------------------------------------
-- [ NETWORK ] --
-------------------------------------------------------------------------------

RegisterNetEvent('mbt_emote_menu:client:rpText', function(channelId, text, originServerId)
    if not cfg.Enabled then return end
    if type(channelId) ~= 'string' or type(text) ~= 'string' or text == '' then return end

    local info = channelInfo[channelId]
    if not info then return end

    seq = seq + 1
    bubbles[seq] = {
        id        = seq,
        channelId = channelId,
        label     = info.label,
        color     = info.color,
        text      = text,
        serverId  = originServerId,
        range     = info.range,
        expiresAt = GetGameTimer() + DURATION,
    }
    startRender()
end)

-------------------------------------------------------------------------------
-- [ RENDER LOOP ] --
-- Runs per-frame only while at least one pill is alive, then stops itself.
-------------------------------------------------------------------------------

startRender = function()
    if renderRunning then return end
    renderRunning = true

    CreateThread(function()
        while renderRunning do
            local now = GetGameTimer()
            local myCoords = GetEntityCoords(PlayerPedId())

            -- Expire old pills; resolve the author's ped for the survivors.
            local byPed = {}
            local alive = 0
            for id, b in pairs(bubbles) do
                if now >= b.expiresAt then
                    bubbles[id] = nil
                else
                    alive = alive + 1
                    local player = GetPlayerFromServerId(b.serverId)
                    local ped = (player ~= -1) and GetPlayerPed(player) or 0
                    b._ped = (ped ~= 0 and DoesEntityExist(ped)) and ped or nil
                    if b._ped then
                        byPed[b._ped] = byPed[b._ped] or {}
                        local list = byPed[b._ped]
                        list[#list + 1] = b
                    end
                end
            end

            if alive == 0 then
                renderRunning = false
                SendNUIMessage({ action = 'rpTextUpdate', bubbles = {} })
                return
            end

            local payload = {}
            for ped, list in pairs(byPed) do
                table.sort(list, function(a, b) return a.id < b.id end)
                local head = GetPedBoneCoords(ped, HEAD_BONE, 0.0, 0.0, 0.0)
                local dist = #(myCoords - GetEntityCoords(ped))
                for idx, b in ipairs(list) do
                    local z = BASE_OFFSET + (idx - 1) * STACK_STEP
                    local ok, sx, sy = World3dToScreen2d(head.x, head.y, head.z + z)
                    payload[#payload + 1] = {
                        id       = b.id,
                        channel  = b.channelId,
                        label    = b.label,
                        color    = b.color,
                        text     = b.text,
                        x        = sx or 0.5,
                        y        = sy or 0.5,
                        onScreen = (ok and dist <= b.range) and true or false,
                    }
                end
            end

            for _, b in pairs(bubbles) do
                if not b._ped then
                    payload[#payload + 1] = {
                        id = b.id, channel = b.channelId, label = b.label,
                        color = b.color, text = b.text,
                        x = 0.5, y = 0.5, onScreen = false,
                    }
                end
            end

            SendNUIMessage({ action = 'rpTextUpdate', bubbles = payload })
            Wait(0)
        end
    end)
end

-------------------------------------------------------------------------------
-- [ CHAT COMMANDS ] --
-------------------------------------------------------------------------------

if cfg.Enabled then
    for id, info in pairs(channelInfo) do
        if info.command then
            RegisterCommand(info.command, function(_, args)
                local text = table.concat(args or {}, ' ')
                if text == '' then return end
                TriggerServerEvent('mbt_emote_menu:server:rpText', id, text)
            end, false)
        end
    end
end

-------------------------------------------------------------------------------
-- [ RP-TEXT OWNERSHIP HANDSHAKE ] --
-- Permette ad altri resource dell'ecosistema (es. mbt_hud chat in RpTextMode
-- 'auto') di sapere che noi forniamo gia' /me /do e cedere il comando invece
-- di intercettarlo. Ritorna la mappa { command -> true } che possediamo.
-------------------------------------------------------------------------------
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

-------------------------------------------------------------------------------
-- [ CHAT SUGGESTIONS ] --
-------------------------------------------------------------------------------

if cfg.Enabled then
    CreateThread(function()
        for _, info in pairs(channelInfo) do
            if info.command then
                TriggerEvent('chat:addSuggestion', '/' .. info.command,
                    'Roleplay action shown to nearby players', {
                        { name = 'text', help = 'What you are doing' },
                    })
            end
        end
    end)
end

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName == GetCurrentResourceName() then
        bubbles = {}
        renderRunning = false
        SendNUIMessage({ action = 'rpTextUpdate', bubbles = {} })
    end
end)
