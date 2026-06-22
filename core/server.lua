if not Utils.MbtResourceNameCheck('mbt_emote_menu') then return end

-- The emote catalog is built entirely client-side from rpemotes' GetEmoteCatalog
-- export (see core/client.lua). The server only handles job permissions and the
-- ecosystem status, plus the startup version check.

-------------------------------------------------------------------------------
-- [ INITIALIZATION ] --
-------------------------------------------------------------------------------

CreateThread(function()
    Utils.MbtVersionCheck('MalibuTechTeam/mbt_emote_menu')
end)

-------------------------------------------------------------------------------
-- [ CLIENT REQUESTS — per-source throttle ] --
-------------------------------------------------------------------------------

local cachedEcosystemStatus = nil
local lastJobRequest = {}
local lastEcosystemRequest = {}
local THROTTLE_MS = 2000

local function throttled(tbl, src)
    local now = GetGameTimer()
    local last = tbl[src]
    if last and (now - last) < THROTTLE_MS then return true end
    tbl[src] = now
    return false
end

AddEventHandler('playerDropped', function()
    local src = source
    lastJobRequest[src] = nil
    lastEcosystemRequest[src] = nil
end)

-------------------------------------------------------------------------------
-- [ JOB PERMISSIONS – server-side job detection ] --
-------------------------------------------------------------------------------

local frameworkObj = nil
local detectedFramework = nil

local function DetectFramework()
    if not MBT.JobPermissions or not MBT.JobPermissions.Enabled then return nil end

    local choice = MBT.JobPermissions.Framework or 'auto'

    if choice == 'esx' or (choice == 'auto') then
        local ok, esx = pcall(function() return exports['es_extended']:getSharedObject() end)
        if ok and esx then
            frameworkObj = esx
            detectedFramework = 'esx'
            Utils.MbtDebugger('Job Permissions: using ESX')
            return 'esx'
        end
    end

    if choice == 'qbox' or (choice == 'auto') then
        local ok, qbx = pcall(function() return exports['qbx_core']:GetCoreObject() end)
        if ok and qbx then
            frameworkObj = qbx
            detectedFramework = 'qbox'
            Utils.MbtDebugger('Job Permissions: using QBox')
            return 'qbox'
        end
    end

    if choice == 'qbcore' or (choice == 'auto') then
        local ok, qb = pcall(function() return exports['qb-core']:GetCoreObject() end)
        if ok and qb then
            frameworkObj = qb
            detectedFramework = 'qbcore'
            Utils.MbtDebugger('Job Permissions: using QBCore')
            return 'qbcore'
        end
    end

    detectedFramework = 'standalone'
    Utils.MbtDebugger('Job Permissions: standalone mode (no framework detected)')
    return 'standalone'
end

local function GetPlayerJob(src)
    if not detectedFramework then DetectFramework() end

    if detectedFramework == 'esx' and frameworkObj then
        local xPlayer = frameworkObj.GetPlayerFromId(src)
        if xPlayer then
            local job = xPlayer.getJob()
            return job and job.name or nil
        end
    elseif detectedFramework == 'qbox' and frameworkObj then
        local player = frameworkObj.Functions.GetPlayer(src)
        if player then
            return player.PlayerData and player.PlayerData.job and player.PlayerData.job.name or nil
        end
    elseif detectedFramework == 'qbcore' and frameworkObj then
        local player = frameworkObj.Functions.GetPlayer(src)
        if player then
            return player.PlayerData and player.PlayerData.job and player.PlayerData.job.name or nil
        end
    end

    return nil
end

RegisterNetEvent('mbt_emote_menu:requestPlayerJob', function()
    local src = source
    if not src or src <= 0 then return end
    if throttled(lastJobRequest, src) then return end

    local jobName = GetPlayerJob(src)
    TriggerClientEvent('mbt_emote_menu:receivePlayerJob', src, jobName, MBT.JobPermissions.Emotes or {})
end)

-------------------------------------------------------------------------------
-- [ ECOSYSTEM STATUS ] --
-------------------------------------------------------------------------------

AddEventHandler('onResourceStart', function(resourceName)
    if resourceName == 'mbt_meta_clothes' or resourceName == 'mbt_wearable_props' then
        cachedEcosystemStatus = nil
    end
end)
AddEventHandler('onResourceStop', function(resourceName)
    if resourceName == 'mbt_meta_clothes' or resourceName == 'mbt_wearable_props' then
        cachedEcosystemStatus = nil
    end
end)

RegisterNetEvent('mbt_emote_menu:requestEcosystemStatus', function()
    local src = source
    if not src or src <= 0 then return end
    if throttled(lastEcosystemRequest, src) then return end
    if not cachedEcosystemStatus then
        cachedEcosystemStatus = {
            metaClothes   = MBT.Ecosystem.MetaClothes and GetResourceState('mbt_meta_clothes') == 'started',
            wearableProps = MBT.Ecosystem.WearableProps and GetResourceState('mbt_wearable_props') == 'started',
        }
    end
    TriggerClientEvent('mbt_emote_menu:receiveEcosystemStatus', src, cachedEcosystemStatus)
end)
