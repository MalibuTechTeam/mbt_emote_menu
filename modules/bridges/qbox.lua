if GetResourceState('qbx_core') ~= 'started' then return end

local function getPlayer(src)
    local ok, player = pcall(function() return exports.qbx_core:GetPlayer(src) end)
    if ok and player then return player end
    return nil
end

local function getAllPlayers()
    local ok, list = pcall(function() return exports.qbx_core:GetQBPlayers() end)
    if ok and list then return list end
    return {}
end

local function buildName(player)
    if not player or not player.PlayerData then return nil end
    local ci = player.PlayerData.charinfo
    if not ci then return nil end
    if ci.firstname and ci.lastname then
        return ci.firstname .. ' ' .. ci.lastname
    end
    return nil
end

local function publishName(src, name)
    if not src or src <= 0 then return end
    if name and name ~= '' then
        Player(src).state:set('mbt_charname', name, true)
    end
end

CreateThread(function()
    Wait(500)
    local players = getAllPlayers()
    local count = 0
    for src, player in pairs(players) do
        publishName(src, buildName(player))
        count = count + 1
    end
    Utils.MbtDebugger('[bridge:qbox] published ' .. count .. ' existing character names')
end)

RegisterNetEvent('QBCore:Server:PlayerLoaded', function(player)
    if player and player.PlayerData then
        publishName(player.PlayerData.source, buildName(player))
    end
end)

RegisterNetEvent('qbx_core:server:playerLoaded', function(player)
    if player and player.PlayerData then
        publishName(player.PlayerData.source, buildName(player))
    end
end)

Utils.MbtDebugger('[bridge:qbox] character-name bridge active')
