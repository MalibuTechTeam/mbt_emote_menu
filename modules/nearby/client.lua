-------------------------------------------------------------------------------
-- [ NEARBY PLAYERS — CLIENT ] --
--
-- Lightweight proximity tracker. Periodically counts how many other players
-- are within Radius and pushes the count to the NUI. The menu shows a
-- dedicated "Nearby" section with shared-emote suggestions when count > 0.
--
-- Cheaper than WhatsThat: no state bag reads, no per-frame screen
-- projection — just one distance check per nearby player every PollMs.
-------------------------------------------------------------------------------

if not MBT.SharedNearby or MBT.SharedNearby.Enabled == false then return end

local config = MBT.SharedNearby
local RADIUS  = config.Radius or 5.0
local POLL_MS = config.PollMs or 1000

local lastCount = -1

local function countNearby()
    local myPed = PlayerPedId()
    if not myPed or myPed == 0 then return 0 end

    local myCoords = GetEntityCoords(myPed)
    local myPlayerId = PlayerId()
    local count = 0

    for _, playerId in ipairs(GetActivePlayers()) do
        if playerId ~= myPlayerId then
            local ped = GetPlayerPed(playerId)
            if ped and ped ~= 0 and DoesEntityExist(ped) then
                local coords = GetEntityCoords(ped)
                if #(coords - myCoords) <= RADIUS then
                    count = count + 1
                end
            end
        end
    end
    return count
end

CreateThread(function()
    while true do
        Wait(POLL_MS)

        local count = countNearby()
        if count ~= lastCount then
            lastCount = count
            SendNUIMessage({ action = 'nearbyCountUpdate', count = count })
        end
    end
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName == GetCurrentResourceName() then
        SendNUIMessage({ action = 'nearbyCountUpdate', count = 0 })
    end
end)
