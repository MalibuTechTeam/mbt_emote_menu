-------------------------------------------------------------------------------
-- [ OPEN JOIN — CLIENT ] --
--
-- Two halves:
--  1. Outgoing announce: hooked by Core.PlayEmoteRaw — when the local player
--     plays an emote in a broadcast category, we ask the server to notify
--     nearby players.
--  2. Incoming invitation: when another nearby player plays a broadcast
--     emote, the server tells us; we surface a small NUI pill that the
--     player can confirm with the configured key to play the same emote.
--
-- Player-level opt-out is persisted via KVP so it survives reconnects.
-------------------------------------------------------------------------------

OpenJoin = OpenJoin or {}

if not MBT.Features or MBT.Features.OpenJoin == false then
    function OpenJoin.MaybeAnnounce(_, _, _) end
    return
end

local config = MBT.OpenJoin or {}

local categorySet = {}
for _, c in ipairs(config.BroadcastCategories or {}) do
    categorySet[c] = true
end

local OPT_OUT_KVP = 'mbt_openjoin_optout'
local optedOut = (GetResourceKvpString(OPT_OUT_KVP) == '1')
local suppressImmediateAnnounce = false
local currentLocalEmote = nil
local heartbeatActive = false
local currentInvitation = nil
local listenerActive = false
local startKeyListener

-------------------------------------------------------------------------------
-- [ OUTGOING ANNOUNCE ] --
-------------------------------------------------------------------------------

local function broadcast(name, label, category)
    TriggerServerEvent('mbt_emote_menu:server:announceOpenJoin', name, label or name, category)
end

local function startHeartbeat()
    if heartbeatActive then return end
    heartbeatActive = true
    local interval = config.HeartbeatMs or 4000
    CreateThread(function()
        while heartbeatActive and currentLocalEmote do
            Wait(interval)
            if not currentLocalEmote then break end
            if Utils and Utils.SafeExport and Core and Core._rpemotesExportName then
                local inAnim, ok = Utils.SafeExport(Core._rpemotesExportName, 'IsPlayerInAnim')
                if ok and not inAnim then
                    currentLocalEmote = nil
                    break
                end
            end

            broadcast(currentLocalEmote.name, currentLocalEmote.label, currentLocalEmote.category)
        end
        heartbeatActive = false
    end)
end

function OpenJoin.MaybeAnnounce(emoteName, emoteLabel, emoteCategory)
    if not emoteName or not emoteCategory then return end
    if not categorySet[emoteCategory] then return end

    currentLocalEmote = {
        name = emoteName,
        label = emoteLabel or emoteName,
        category = emoteCategory,
    }

    if suppressImmediateAnnounce then
        suppressImmediateAnnounce = false
    else
        broadcast(emoteName, emoteLabel or emoteName, emoteCategory)
    end

    startHeartbeat()
end

-------------------------------------------------------------------------------
-- [ INCOMING INVITATION ] --
-------------------------------------------------------------------------------

local function localPlayerCanReceive()
    if optedOut then return false end
    local ped = PlayerPedId()
    if not ped or ped == 0 then return false end
    if IsEntityDead(ped) then return false end
    if IsPedInAnyVehicle(ped, false) then return false end
    return true
end

local function hideInvitation()
    if not currentInvitation then return end
    currentInvitation = nil
    listenerActive = false
    SendNUIMessage({ action = 'openJoinHide' })
end

RegisterNetEvent('mbt_emote_menu:client:openJoinInvitation', function(emoteName, emoteLabel, emoteCategory)
    if not localPlayerCanReceive() then return end
    if type(emoteName) ~= 'string' or type(emoteCategory) ~= 'string' then return end
    if currentLocalEmote and currentLocalEmote.name == emoteName then return end

    local timeoutMs = config.PopupTimeoutMs or 5000
    currentInvitation = {
        name = emoteName,
        label = emoteLabel or emoteName,
        category = emoteCategory,
        expiresAt = GetGameTimer() + timeoutMs,
    }

    SendNUIMessage({
        action  = 'openJoinShow',
        label   = currentInvitation.label,
        joinKey = config.JoinKey or 'Y',
        position = config.Position or 'bottom-center',
        timeoutMs = timeoutMs,
    })

    startKeyListener()

    local snapshotExpiry = currentInvitation.expiresAt
    SetTimeout(timeoutMs + 80, function()
        if currentInvitation and currentInvitation.expiresAt == snapshotExpiry then
            hideInvitation()
        end
    end)
end)

-------------------------------------------------------------------------------
-- [ JOIN ACTION ] --
-------------------------------------------------------------------------------

local function joinCurrent()
    if not currentInvitation then return end
    local inv = currentInvitation
    hideInvitation()

    if not Core or not Core.PlayEmoteRaw then return end

    suppressImmediateAnnounce = true
    Core.PlayEmoteRaw(inv.name, inv.category, 1)
end

-- Chat fallback — always works regardless of key conflicts or key-binding state.
RegisterCommand('mbt_join', function()
    joinCurrent()
end, false)
TriggerEvent('chat:addSuggestion', '/mbt_join', 'Join the nearby emote shown in the invitation pill')

RegisterCommand('mbt_openjoin_action', function() joinCurrent() end, false)
RegisterKeyMapping('mbt_openjoin_action', 'Join nearby emote (MBT)', 'keyboard', config.JoinKey or 'Y')

-- Windows Virtual Key codes (same set IsRawKeyDown expects).
local KEY_CODES = {
    A = 0x41, B = 0x42, C = 0x43, D = 0x44, E = 0x45, F = 0x46, G = 0x47,
    H = 0x48, I = 0x49, J = 0x4A, K = 0x4B, L = 0x4C, M = 0x4D, N = 0x4E,
    O = 0x4F, P = 0x50, Q = 0x51, R = 0x52, S = 0x53, T = 0x54, U = 0x55,
    V = 0x56, W = 0x57, X = 0x58, Y = 0x59, Z = 0x5A,
    ['0'] = 0x30, ['1'] = 0x31, ['2'] = 0x32, ['3'] = 0x33, ['4'] = 0x34,
    ['5'] = 0x35, ['6'] = 0x36, ['7'] = 0x37, ['8'] = 0x38, ['9'] = 0x39,
    F1 = 0x70, F2 = 0x71, F3 = 0x72, F4 = 0x73, F5 = 0x74, F6 = 0x75,
    F7 = 0x76, F8 = 0x77, F9 = 0x78, F10 = 0x79, F11 = 0x7A, F12 = 0x7B,
}

startKeyListener = function()
    if listenerActive then return end
    local keyName = (config.JoinKey or 'Y'):upper()
    local keyCode = KEY_CODES[keyName]
    if not keyCode then return end 

    listenerActive = true
    CreateThread(function()
        local wasDown = IsRawKeyDown(keyCode)
        while listenerActive and currentInvitation do
            local isDown = IsRawKeyDown(keyCode)
            if isDown and not wasDown then
                joinCurrent()
                break
            end
            wasDown = isDown
            Wait(0)
        end
        listenerActive = false
    end)
end

-------------------------------------------------------------------------------
-- [ PLAYER OPT-OUT ] --
-------------------------------------------------------------------------------

RegisterCommand('mbt_openjoin', function(_, args)
    local arg = (args[1] or ''):lower()
    if arg == 'off' or arg == 'mute' then
        optedOut = true
        SetResourceKvp(OPT_OUT_KVP, '1')
        hideInvitation()
        print('^3[mbt_emote_menu]^0 OpenJoin: opted out (use /mbt_openjoin on to re-enable)')
    elseif arg == 'on' or arg == 'unmute' then
        optedOut = false
        DeleteResourceKvp(OPT_OUT_KVP)
        print('^2[mbt_emote_menu]^0 OpenJoin: opted in')
    elseif arg == 'status' or arg == '' then
        print(('^3[mbt_emote_menu]^0 OpenJoin status: %s'):format(optedOut and 'opted out' or 'opted in'))
    else
        print('^1[mbt_emote_menu]^0 usage: /mbt_openjoin on|off|status')
    end
end, false)

-- Stop showing the pill if the resource stops mid-invitation.
AddEventHandler('onResourceStop', function(resourceName)
    if resourceName == GetCurrentResourceName() then hideInvitation() end
end)
