if not Utils.MbtResourceNameCheck('mbt_emote_menu') then return end

local EmoteData = {}
local rpemotesResource = nil

-------------------------------------------------------------------------------
-- [ AUTO-DETECT RPEMOTES RESOURCE ] --
-------------------------------------------------------------------------------

local function DetectRpemotesResource()
    if MBT.RpemotesResource then
        if GetResourceState(MBT.RpemotesResource) == 'started' then
            return MBT.RpemotesResource
        end
        print('^1[mbt_emote_menu] Configured resource "' .. MBT.RpemotesResource .. '" not found or not started.^0')
    end

    local candidates = { 'rpemotes-reborn', 'rpemotes', 'rp-emotes', 'rp-emotes-reborn' }
    for _, name in ipairs(candidates) do
        if GetResourceState(name) == 'started' then
            Utils.MbtDebugger('Auto-detected rpemotes resource: ' .. name)
            return name
        end
    end

    print('^1[mbt_emote_menu] ERROR: No rpemotes resource found! Make sure rpemotes-reborn is started.^0')
    return nil
end

-------------------------------------------------------------------------------
-- [ LOAD ANIMATION LIST FROM RPEMOTES ] --
-------------------------------------------------------------------------------

local function FormatEmoteName(name)
    if not name then return '' end
    local clean = name:gsub('<[^>]+>', '')
    clean = clean:gsub('(%l)(%u)', '%1 %2')
    clean = clean:gsub('(%a)(%d)', '%1 %2')
    clean = clean:sub(1, 1):upper() .. clean:sub(2)
    return clean
end

local function BuildSandbox()
    local sandbox = {}

    local typesFile = LoadResourceFile(rpemotesResource, 'types.lua')
    if typesFile then
        local typesEnv = setmetatable({}, { __index = _G, __newindex = sandbox })
        local typesFn, typesErr = load(typesFile, '@rpemotes/types.lua', 't', typesEnv)
        if typesFn and not typesErr then
            pcall(typesFn)
        end
    end

    if not sandbox.AnimFlag then
        sandbox.AnimFlag = { MOVING = 51, LOOP = 1, STUCK = 50 }
    end
    if not sandbox.EmoteType then
        sandbox.EmoteType = {
            EXPRESSIONS = 'Expressions',
            WALKS = 'Walks',
            SHARED = 'Shared',
            DANCES = 'Dances',
            ANIMAL_EMOTES = 'AnimalEmotes',
            EXITS = 'Exits',
            EMOTES = 'Emotes',
            PROP_EMOTES = 'PropEmotes',
            EMOJI = 'Emojis',
        }
    end
    if not sandbox.ScenarioType then
        sandbox.ScenarioType = { MALE = 'MaleScenario', SCENARIO = 'Scenario', OBJECT = 'ScenarioObject' }
    end
    if not sandbox.VehicleRequirement then
        sandbox.VehicleRequirement = { NOT_ALLOWED = 'NOT_ALLOWED', REQUIRED = 'REQUIRED' }
    end
    if not sandbox.PlacementState then
        sandbox.PlacementState = {
            NONE = 'None',
            PREVIEWING = 'Previewing',
            WALKING = 'Walking',
            IN_ANIMATION =
            'In Animation'
        }
    end
    if not sandbox.TaskType then
        sandbox.TaskType = { MELEE_UPPERBODY_ANIMS = 131, SCRIPTED_ANIMATIONS = 134, SYNCHRONIZED_SCENE = 135 }
    end

    return sandbox
end

local function LoadInSandbox(code, sandbox, chunkName)
    local env = setmetatable(sandbox, { __index = _G })
    local fn, err = load(code, chunkName or '=(load)', 't', env)
    if not fn then return nil, err end
    return pcall(fn)
end

local function LoadAnimationList()
    if not rpemotesResource then return false end

    local animFile = LoadResourceFile(rpemotesResource, 'client/AnimationList.lua')
    if not animFile then
        print('^1[mbt_emote_menu] Failed to load AnimationList.lua from ' .. rpemotesResource .. '^0')
        return false
    end

    local sandbox = BuildSandbox()

    local success, errOrNil = LoadInSandbox(animFile, sandbox, '@rpemotes/AnimationList.lua')
    if not success then
        print('^1[mbt_emote_menu] Error executing AnimationList.lua: ' .. tostring(errOrNil) .. '^0')
        return false
    end

    local RP = sandbox.RP
    if not RP then
        print('^1[mbt_emote_menu] AnimationList.lua did not produce RP table^0')
        return false
    end

    local customFile = LoadResourceFile(rpemotesResource, 'client/AnimationListCustom.lua')
    if customFile then
        local customSuccess, customErr = LoadInSandbox(customFile, sandbox, '@rpemotes/AnimationListCustom.lua')
        if customSuccess then
            local CustomDP = sandbox.CustomDP
            if CustomDP then
                for emoteType, emoteList in pairs(CustomDP) do
                    if RP[emoteType] then
                        for k, v in pairs(emoteList) do
                            RP[emoteType][k] = v
                        end
                    else
                        RP[emoteType] = emoteList
                    end
                end
                Utils.MbtDebugger('Loaded custom emotes from ' .. rpemotesResource)
            end
        end
    end

    local catalog = {}
    local bannedSet = {}
    for _, name in ipairs(MBT.BannedEmotes or {}) do
        if type(name) == 'string' then bannedSet[name:lower()] = true end
    end

    local categoryMap = {
        Emotes       = 'Emotes',
        PropEmotes   = 'PropEmotes',
        Shared       = 'Shared',
        Dances       = 'Dances',
        AnimalEmotes = 'AnimalEmotes',
        Expressions  = 'Expressions',
        Walks        = 'Walks',
        Emojis       = 'Emojis',
    }

    local bannedCount = 0

    for rpKey, category in pairs(categoryMap) do
        if RP[rpKey] then
            for emoteName, emoteData in pairs(RP[rpKey]) do
                -- Drop banned emotes before any further processing.
                if bannedSet[emoteName:lower()] then
                    bannedCount = bannedCount + 1
                    goto continue
                end

                local label = emoteName
                local hasProp = false
                local isShared = (category == 'Shared')
                local variations = nil
                local animDict = nil
                local animClip = nil
                local scenario = nil
                local animFlag, blendIn, blendOut, duration
                local prop, propBone, propPlace
                local prop2, prop2Bone, prop2Place

                if type(emoteData) == 'table' then
                    -- Skip adult emotes when disabled
                    if not MBT.Features.AdultEmotes and emoteData.AdultAnimation then
                        goto continue
                    end

                    -- Skip abusable emotes when disabled
                    if not MBT.Features.AbusableEmotes then
                        local isAbusable = emoteData.abusable
                        if not isAbusable and emoteData.AnimationOptions then
                            isAbusable = emoteData.AnimationOptions.abusable
                        end
                        if isAbusable then
                            goto continue
                        end
                    end
                    label = emoteData[3] or emoteData.label or nil
                    if label then
                        label = label:gsub('<[^>]+>', '')
                    end
                    if type(emoteData[1]) == 'string' and type(emoteData[2]) == 'string' then
                        animDict = emoteData[1]
                        animClip = emoteData[2]
                    end
                    if type(emoteData.Scenario) == 'string' then
                        scenario = emoteData.Scenario
                    end
                    if emoteData.AnimationOptions then
                        local opts = emoteData.AnimationOptions
                        hasProp = opts.Prop ~= nil
                        if opts.PropTextureVariations then
                            variations = {}
                            for _, v in ipairs(opts.PropTextureVariations) do
                                local cleanName = (v.Name or ''):gsub('<[^>]+>', ''):gsub('%s+$', '')
                                variations[#variations + 1] = { name = cleanName, value = v.Value }
                            end
                        end
                        animFlag = opts.onFootFlag or (opts.EmoteMoving and 51 or 1)
                        blendIn  = opts.BlendInSpeed or 5.0
                        blendOut = opts.BlendOutSpeed or 5.0
                        duration = opts.EmoteDuration or -1
                        if opts.Prop then
                            prop     = opts.Prop
                            propBone = opts.PropBone or 28422
                            if opts.PropPlacement then
                                propPlace = {
                                    opts.PropPlacement[1] or 0.0, opts.PropPlacement[2] or 0.0, opts.PropPlacement[3] or
                                0.0,
                                    opts.PropPlacement[4] or 0.0, opts.PropPlacement[5] or 0.0, opts.PropPlacement[6] or
                                0.0
                                }
                            end
                        end
                        if opts.SecondProp then
                            prop2     = opts.SecondProp
                            prop2Bone = opts.SecondPropBone or 60309
                            if opts.SecondPropPlacement then
                                prop2Place = {
                                    opts.SecondPropPlacement[1] or 0.0, opts.SecondPropPlacement[2] or 0.0, opts
                                .SecondPropPlacement[3] or 0.0,
                                    opts.SecondPropPlacement[4] or 0.0, opts.SecondPropPlacement[5] or 0.0, opts
                                .SecondPropPlacement[6] or 0.0
                                }
                            end
                        end
                    end
                end

                catalog[#catalog + 1] = {
                    name       = emoteName,
                    label      = label or FormatEmoteName(emoteName),
                    category   = category,
                    hasProp    = hasProp,
                    isShared   = isShared,
                    variations = variations,
                    animDict   = animDict,
                    animClip   = animClip,
                    scenario   = scenario,
                    animFlag   = animFlag,
                    blendIn    = blendIn,
                    blendOut   = blendOut,
                    duration   = duration,
                    prop       = prop,
                    propBone   = propBone,
                    propPlace  = propPlace,
                    prop2      = prop2,
                    prop2Bone  = prop2Bone,
                    prop2Place = prop2Place,
                }
                ::continue::
            end
        end
    end

    table.sort(catalog, function(a, b)
        return (a.label or ''):lower() < (b.label or ''):lower()
    end)

    EmoteData = catalog
    if bannedCount > 0 then
        Utils.MbtDebugger(string.format('Loaded %d emotes from %s (filtered %d banned)', #catalog, rpemotesResource, bannedCount))
    else
        Utils.MbtDebugger(string.format('Loaded %d emotes from %s', #catalog, rpemotesResource))
    end
    return true
end

-------------------------------------------------------------------------------
-- [ INITIALIZATION ] --
-------------------------------------------------------------------------------

CreateThread(function()
    rpemotesResource = DetectRpemotesResource()
    if rpemotesResource then
        LoadAnimationList()
    end
    Utils.MbtVersionCheck('MalibuTechTeam/mbt_emote_menu')
end)

-------------------------------------------------------------------------------
-- [ CLIENT REQUESTS ] --
-------------------------------------------------------------------------------

local cachedEcosystemStatus = nil
local lastCatalogRequest = {}
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
    lastCatalogRequest[src] = nil
    lastJobRequest[src] = nil
    lastEcosystemRequest[src] = nil
end)

RegisterNetEvent('mbt_emote_menu:requestEmoteCatalog', function()
    local src = source
    if not src or src <= 0 then return end
    if throttled(lastCatalogRequest, src) then return end
    if #EmoteData == 0 then return end
    TriggerClientEvent('mbt_emote_menu:receiveEmoteCatalog', src, EmoteData, rpemotesResource)
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
    print('^3[mbt_emote_menu] Job Permissions: standalone mode (no framework detected)^0')
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
