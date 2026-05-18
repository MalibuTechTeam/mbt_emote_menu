-------------------------------------------------------------------------------
-- [ WHAT'S THAT EMOTE? — CLIENT ] --
--
-- Passive ambient discovery. Polls nearby players every ~100ms and reads
-- their replicated `mbtCurrentEmote` state bag (set by modules/openjoin).
-- When the closest emoting player is within MaxDistance we surface a small
-- floating bubble above their head with the emote label and a hotkey hint —
-- one key press copies the emote on the local player.
--
-- Reads only — never writes to remote players' state. Pure visual discovery.
-------------------------------------------------------------------------------

if not MBT.Features or MBT.Features.WhatsThat == false then
    Utils.MbtDebugger('whatsthat: disabled in config (MBT.Features.WhatsThat = false)')
    return
end

Utils.MbtDebugger('whatsthat module loaded')

local config = MBT.WhatsThat or {}

local MAX_DISTANCE = config.MaxDistance or 5.0
local SCAN_MS      = config.ScanMs or config.PollMs or 100 
local HOTKEY       = (config.Key or 'G'):upper()
local HEAD_OFFSET  = 1.05 

---@type { playerId: integer, name: string, label: string, category: string } | nil
local currentTarget = nil
local listenerActive = false
local startKeyListener

local function tryEmote()
    if not currentTarget then return end
    local target = currentTarget
    currentTarget = nil
    SendNUIMessage({ action = 'whatsthatHide' })

    if not Core or not Core.PlayEmoteRaw then return end
    Core.PlayEmoteRaw(target.name, target.category, 1)
end

RegisterCommand('mbt_try', function() tryEmote() end, false)
TriggerEvent('chat:addSuggestion', '/mbt_try', "Play the emote the nearest emoting player is doing")

RegisterCommand('mbt_whatsthat_action', function() tryEmote() end, false)
RegisterKeyMapping('mbt_whatsthat_action', "Try nearby player's emote (MBT)", 'keyboard', HOTKEY)

startKeyListener = function()
    if listenerActive then return end
    local keyCode = Utils.KeyCode(HOTKEY)
    if not keyCode then return end

    listenerActive = true
    CreateThread(function()
        local wasDown = IsRawKeyDown(keyCode)
        while listenerActive and currentTarget do
            local isDown = IsRawKeyDown(keyCode)
            if isDown and not wasDown then
                tryEmote()
                break
            end
            wasDown = isDown
            Wait(0)
        end
        listenerActive = false
    end)
end

local function findClosestEmotingPlayer(myCoords)
    local myPlayerId = PlayerId()
    local closest = nil
    local closestDist = MAX_DISTANCE + 0.001

    for _, playerId in ipairs(GetActivePlayers()) do
        if playerId ~= myPlayerId then
            local ped = GetPlayerPed(playerId)
            if ped and ped ~= 0 and DoesEntityExist(ped) then
                local coords = GetEntityCoords(ped)
                local dist = #(coords - myCoords)
                local serverId = GetPlayerServerId(playerId)
                local playerEmote = Player(serverId).state and Player(serverId).state.mbtCurrentEmote
                local entityEmote = Entity(ped).state and Entity(ped).state.mbtCurrentEmote
                local emote = playerEmote or entityEmote

                if MBT.Debug then
                    Utils.MbtDebugger(('whatsthat scan: server=%s dist=%.1fm playerBag=%s entityBag=%s'):format(
                        tostring(serverId), dist,
                        tostring(playerEmote and playerEmote.name or 'nil'),
                        tostring(entityEmote and entityEmote.name or 'nil')))
                end

                if dist <= closestDist and type(emote) == 'table' and emote.name then
                    closest = {
                        playerId = playerId,
                        ped = ped,
                        coords = coords,
                        name = emote.name,
                        label = emote.label or emote.name,
                        category = emote.category,
                    }
                    closestDist = dist
                end
            end
        end
    end
    return closest
end

local function clearTarget()
    if not currentTarget then return end
    currentTarget = nil
    listenerActive = false
end

CreateThread(function()
    local tickCounter = 0
    while true do
        Wait(SCAN_MS)
        tickCounter = tickCounter + 1

        if MBT.Debug and tickCounter % 30 == 0 then
            Utils.MbtDebugger(('whatsthat tick #%d: active players=%d')
                :format(tickCounter, #GetActivePlayers()))
        end

        local myPed = PlayerPedId()
        if not myPed or myPed == 0 or IsEntityDead(myPed) or IsPedInAnyVehicle(myPed, false) then
            clearTarget()
        else
            local myCoords = GetEntityCoords(myPed)
            local found = findClosestEmotingPlayer(myCoords)
            if not found then
                clearTarget()
            else
                if not currentTarget or currentTarget.playerId ~= found.playerId or currentTarget.name ~= found.name then
                    if MBT.Debug then
                        Utils.MbtDebugger(('whatsthat: new target %s on player %s'):format(found.label, found.playerId))
                    end
                end
                currentTarget = {
                    playerId = found.playerId,
                    ped = found.ped,
                    name = found.name,
                    label = found.label,
                    category = found.category,
                }
                startKeyListener()
            end
        end
    end
end)

local lastBubbleVisible = false
local lastSx, lastSy = -1, -1
CreateThread(function()
    while true do
        local hasTarget = currentTarget and currentTarget.ped and DoesEntityExist(currentTarget.ped)

        if not hasTarget then
            if lastBubbleVisible then
                SendNUIMessage({ action = 'whatsthatHide' })
                lastBubbleVisible = false
                lastSx, lastSy = -1, -1
            end
        else
            local coords = GetEntityCoords(currentTarget.ped)
            local headWorld = coords + vector3(0.0, 0.0, HEAD_OFFSET)
            local ok, sx, sy = World3dToScreen2d(headWorld.x, headWorld.y, headWorld.z)
            if not ok then
                if lastBubbleVisible then
                    SendNUIMessage({ action = 'whatsthatHide' })
                    lastBubbleVisible = false
                    lastSx, lastSy = -1, -1
                end
            else
                if not lastBubbleVisible then
                    SendNUIMessage({
                        action  = 'whatsthatShow',
                        label   = currentTarget.label,
                        hotKey  = HOTKEY,
                        x       = sx,
                        y       = sy,
                    })
                    lastBubbleVisible = true
                    lastSx, lastSy = sx, sy
                elseif math.abs(sx - lastSx) > 0.0005 or math.abs(sy - lastSy) > 0.0005 then
                    SendNUIMessage({ action = 'whatsthatMove', x = sx, y = sy })
                    lastSx, lastSy = sx, sy
                end
            end
        end

        -- Per-frame only while tracking a bubble; otherwise idle — the
        -- 100ms scan thread above is what surfaces a new target.
        Wait(hasTarget and 0 or 250)
    end
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName == GetCurrentResourceName() then clearTarget() end
end)
