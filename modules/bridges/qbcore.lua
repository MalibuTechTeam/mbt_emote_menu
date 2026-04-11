if GetResourceState('qb-core') ~= 'started' then return end

local ok, QBCore = pcall(function() return exports['qb-core']:GetCoreObject() end)
if not ok or not QBCore then return end

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
    local players = QBCore.Functions.GetQBPlayers and QBCore.Functions.GetQBPlayers() or {}
    local count = 0
    for src, player in pairs(players) do
        publishName(src, buildName(player))
        count = count + 1
    end
    Utils.MbtDebugger('[bridge:qbcore] published ' .. count .. ' existing character names')
end)

RegisterNetEvent('QBCore:Server:PlayerLoaded', function(player)
    if player and player.PlayerData then
        publishName(player.PlayerData.source, buildName(player))
    end
end)

RegisterNetEvent('QBCore:Server:OnPlayerUpdate', function()
    local src = source
    if not src or src <= 0 then return end
    local player = QBCore.Functions.GetPlayer(src)
    if player then publishName(src, buildName(player)) end
end)

Utils.MbtDebugger('[bridge:qbcore] character-name bridge active')
