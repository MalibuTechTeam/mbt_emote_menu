if GetResourceState('es_extended') ~= 'started' then return end

local ok, ESX = pcall(function() return exports['es_extended']:getSharedObject() end)
if not ok or not ESX then return end

local function buildName(xPlayer)
    if not xPlayer then return nil end

    local first, last
    if xPlayer.get then
        first = xPlayer.get('firstName')
        last  = xPlayer.get('lastName')
    end

    if (not first or not last) and xPlayer.variables then
        first = first or xPlayer.variables.firstName
        last  = last or xPlayer.variables.lastName
    end

    if (not first or not last) and xPlayer.getName then
        local full = xPlayer.getName()
        if full and full ~= '' then return full end
    end

    if first and last then
        return first .. ' ' .. last
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
    local xPlayers = ESX.GetExtendedPlayers and ESX.GetExtendedPlayers() or {}
    local count = 0
    for _, xPlayer in pairs(xPlayers) do
        publishName(xPlayer.source, buildName(xPlayer))
        count = count + 1
    end
    Utils.MbtDebugger('[bridge:esx] published ' .. count .. ' existing character names')
end)

AddEventHandler('esx:playerLoaded', function(src, xPlayer)
    publishName(src, buildName(xPlayer))
end)

AddEventHandler('esx:setJob', function(src)
    local xPlayer = ESX.GetPlayerFromId(src)
    if xPlayer then publishName(src, buildName(xPlayer)) end
end)

Utils.MbtDebugger('[bridge:esx] character-name bridge active')
