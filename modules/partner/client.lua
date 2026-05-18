Core = Core or {}

-------------------------------------------------------------------------------
-- [ NEARBY PLAYER SEARCH ] --
-------------------------------------------------------------------------------

local function ResolveNearbyName(playerId, serverId)
    local state = Player(serverId).state
    if state then
        local rp = state.mbt_charname
        if type(rp) == 'string' and rp ~= '' then
            return rp
        end
    end
    return GetPlayerName(playerId)
end

RegisterNUICallback('getNearbyPlayers', function(data, cb)
    local playerPed = PlayerPedId()
    local playerCoords = GetEntityCoords(playerPed)
    -- Clamp to a sane ceiling so a modified NUI can't pass a huge radius
    -- and turn this into a server-wide player scanner.
    local maxDist = math.min(tonumber(data.radius) or 10.0, 25.0)
    local nearby = {}

    for _, playerId in ipairs(GetActivePlayers()) do
        if playerId ~= PlayerId() then
            local targetPed = GetPlayerPed(playerId)
            if targetPed and DoesEntityExist(targetPed) then
                local targetCoords = GetEntityCoords(targetPed)
                local dist = #(playerCoords - targetCoords)
                if dist <= maxDist then
                    local serverId = GetPlayerServerId(playerId)
                    nearby[#nearby + 1] = {
                        serverId = serverId,
                        name     = ResolveNearbyName(playerId, serverId),
                        dist     = math.floor(dist * 10) / 10,
                    }
                end
            end
        end
    end

    table.sort(nearby, function(a, b) return a.dist < b.dist end)
    cb({ ok = true, players = nearby })
end)

RegisterNUICallback('sendSharedEmote', function(data, cb)
    local emoteName = Utils.Sanitize(data.emoteName)
    if not emoteName or emoteName == '' then
        cb({ ok = false })
        return
    end
    ExecuteCommand('nearby ' .. emoteName)
    Core.IncrementPlayCount(emoteName)
    cb({ ok = true })
end)

-------------------------------------------------------------------------------
-- [ SHARED EMOTE POPUP (incoming requests from rpemotes) ] --
-------------------------------------------------------------------------------

if MBT.Features.SharedPopup then
    local pendingSharedRequest = nil

    RegisterNetEvent('rpemotes:client:requestEmote', function(emotename, target)
        pendingSharedRequest = {
            emoteName = emotename,
            fromId    = target,
        }

        SendNUIMessage({
            action    = 'sharedEmoteRequest',
            emoteName = emotename,
            fromId    = target,
        })
    end)

    RegisterNUICallback('acceptSharedEmote', function(data, cb)
        if not pendingSharedRequest then
            cb({ ok = false, error = 'no pending request' })
            return
        end

        local req = pendingSharedRequest
        pendingSharedRequest = nil

        TriggerServerEvent('rpemotes:server:confirmEmote', req.fromId, req.emoteName, req.emoteName)

        cb({ ok = true })
    end)

    RegisterNUICallback('declineSharedEmote', function(_, cb)
        pendingSharedRequest = nil
        cb({ ok = true })
    end)
end
