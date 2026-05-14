-------------------------------------------------------------------------------
-- [ OPEN JOIN — CLIENT ] --
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
                    LocalPlayer.state:set('mbtCurrentEmote', nil, true)
                    Entity(PlayerPedId()).state:set('mbtCurrentEmote', nil, true)
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

    LocalPlayer.state:set('mbtCurrentEmote', currentLocalEmote, true)
    Entity(PlayerPedId()).state:set('mbtCurrentEmote', currentLocalEmote, true)
    if Utils and Utils.MbtDebugger then
        Utils.MbtDebugger(('openjoin: state bag set name=%s label=%s'):format(emoteName, currentLocalEmote.label))
    end

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

    local radius = ((MBT.OpenJoin and MBT.OpenJoin.Radius) or 8.0) + 2.0
    CreateThread(function()
        Wait(800)
        while currentInvitation and currentInvitation.expiresAt == snapshotExpiry do
            local myPed = PlayerPedId()
            if not myPed or myPed == 0 then break end
            local myCoords = GetEntityCoords(myPed)
            local stillEmoting = false
            for _, playerId in ipairs(GetActivePlayers()) do
                if playerId ~= PlayerId() then
                    local ped = GetPlayerPed(playerId)
                    if ped and ped ~= 0 and DoesEntityExist(ped) then
                        if #(GetEntityCoords(ped) - myCoords) <= radius then
                            local serverId = GetPlayerServerId(playerId)
                            local bag = Player(serverId).state
                            local emote = bag and bag.mbtCurrentEmote
                            if not (type(emote) == 'table' and emote.name) then
                                local ebag = Entity(ped).state
                                emote = ebag and ebag.mbtCurrentEmote
                            end
                            if type(emote) == 'table' and emote.name == emoteName then
                                stillEmoting = true
                                break
                            end
                        end
                    end
                end
            end
            if not stillEmoting then
                hideInvitation()
                break
            end
            Wait(500)
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

RegisterCommand('mbt_join', function()
    joinCurrent()
end, false)
TriggerEvent('chat:addSuggestion', '/mbt_join', 'Join the nearby emote shown in the invitation pill')

RegisterCommand('mbt_openjoin_action', function() joinCurrent() end, false)
RegisterKeyMapping('mbt_openjoin_action', 'Join nearby emote (MBT)', 'keyboard', config.JoinKey or 'Y')

startKeyListener = function()
    if listenerActive then return end
    local keyCode = Utils.KeyCode(config.JoinKey or 'Y')
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

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName == GetCurrentResourceName() then hideInvitation() end
end)
