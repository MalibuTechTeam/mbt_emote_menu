if not Utils.MbtResourceNameCheck('mbt_emote_menu') then return end

-- The emote catalog is built entirely client-side from rpemotes' GetEmoteCatalog
-- export (see core/client.lua). The server handles job permissions, the
-- ecosystem status, and the ACE-gated admin payload. The startup version check
-- lives in modules/version/server.lua.

-------------------------------------------------------------------------------
-- [ CLIENT REQUESTS — per-source throttle ] --
-------------------------------------------------------------------------------

local cachedEcosystemStatus = nil
local lastJobRequest = {}
local lastEcosystemRequest = {}
local lastAdminRequest = {}
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
    lastAdminRequest[src] = nil
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

-------------------------------------------------------------------------------
-- [ ADMIN PAYLOAD — ACE gated ] --
--
-- The single place that decides who is an admin. Everything admin-only in the
-- UI (the update notice, the owner diagnostics, the scene editor) is unlocked
-- by this one reply.
--
-- An unauthorized request is answered with silence: no event, not even an
-- {authorized = false}. There is nothing for a normal player to intercept,
-- and nothing client-side that has to be trusted to hide it.
-------------------------------------------------------------------------------

-- Brand convention (patterns/admin-command-naming): the admin command is the
-- resource name, and the permission derives from it. FiveM auto-registers
-- 'command.<name>' when the command is registered server-side, so a wildcard
-- admin principal works with no extra server.cfg lines.
local adminCommand = (MBT.Admin and MBT.Admin.Command) or GetCurrentResourceName()
local adminPerm    = (MBT.Admin and MBT.Admin.Permission) or ('command.' .. adminCommand)

--- The single authority on "is this player an admin here".
---@param src number
---@return boolean
function IsMbtEmoteAdmin(src)
    if not src or src <= 0 then return false end
    return IsPlayerAceAllowed(src, adminPerm)
end

RegisterNetEvent('mbt_emote_menu:requestAdminInfo', function()
    local src = source
    if not src or src <= 0 then return end
    if throttled(lastAdminRequest, src) then return end
    if not IsMbtEmoteAdmin(src) then return end

    -- Re-read on every request rather than caching per player: an ACE granted
    -- or revoked at runtime takes effect on the next menu open, not on rejoin.
    if not detectedFramework then DetectFramework() end

    local editorOn = (MBT.Admin.Editor and MBT.Admin.Editor.Enabled) ~= false

    TriggerClientEvent('mbt_emote_menu:receiveAdminInfo', src, {
        update    = MBT.UpdateInfo,
        status    = MBT.UpdateStatus,
        framework = detectedFramework or 'disabled',
        editor    = editorOn,
    })
end)

-- Registered SERVER-side (like mbt_malisling and mbt_elevator) so FiveM
-- auto-registers its ACE. Opens the scene editor for an authorised admin.
RegisterCommand(adminCommand, function(source)
    if source == 0 then return end -- console has no ped to place marks with
    if not IsMbtEmoteAdmin(source) then
        TriggerClientEvent('mbt_emote_menu:adminDenied', source)
        return
    end
    TriggerClientEvent('mbt_emote_menu:editor:openCommand', source)
end, false)

AddEventHandler('onResourceStart', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then return end
    TriggerEvent('chat:addSuggestion', '/' .. adminCommand,
        'Open the MBT Emote Menu scene editor')
end)
