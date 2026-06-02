PhotoMode = PhotoMode or {}

local cfg = MBT.PhotoMode or {}

if not cfg.Enabled then
    function PhotoMode.IsActive() return false end
    return
end

local ORBIT_SENS = cfg.OrbitSensitivity or 0.45
local ZOOM_SENS  = cfg.ZoomSensitivity or 0.30
local MIN_DIST   = cfg.MinDistance or 0.7
local MAX_DIST   = cfg.MaxDistance or 7.0
local MIN_ELEV   = -25.0
local MAX_ELEV   = 80.0
local MIN_FOV    = 18.0
local MAX_FOV    = 70.0
local TARGET_Z   = 0.45 -- look point above ped root (~chest height)

-- filter id -> { timecycle, strength }
local filters = {}
for _, f in ipairs(cfg.Filters or {}) do
    if type(f) == 'table' and type(f.id) == 'string' then
        filters[f.id] = { timecycle = f.timecycle, strength = f.strength or 1.0 }
    end
end

-- Live state
local active        = false
local cam           = nil
local azimuth       = 0.0   -- degrees, world yaw around the ped
local elevation     = 12.0  -- degrees
local distance      = 2.6   -- metres
local fov           = 45.0
local dofOn         = cfg.DofDefault ~= false
local timecycleSet  = false

-------------------------------------------------------------------------------
-- [ CAMERA MATH ] --
-------------------------------------------------------------------------------

local function targetCoords()
    local ped = PlayerPedId()
    local c = GetEntityCoords(ped)
    return vector3(c.x, c.y, c.z + TARGET_Z)
end

local function applyCamera()
    if not cam or not DoesCamExist(cam) then return end
    local t = targetCoords()
    local azr = math.rad(azimuth)
    local elr = math.rad(elevation)
    local horiz = distance * math.cos(elr)
    local camX = t.x + horiz * math.sin(azr)
    local camY = t.y + horiz * math.cos(azr)
    local camZ = t.z + distance * math.sin(elr)
    SetCamCoord(cam, camX, camY, camZ)
    PointCamAtCoord(cam, t.x, t.y, t.z)
    SetCamFov(cam, fov)
end

local function applyDof()
    if not cam or not DoesCamExist(cam) then return end
    if dofOn then
        SetCamUseShallowDofMode(cam, true)
        SetCamNearDof(cam, math.max(0.1, distance - 1.2))
        SetCamFarDof(cam, distance + 2.5)
        SetCamDofStrength(cam, 1.0)
    else
        SetCamUseShallowDofMode(cam, false)
    end
end

-------------------------------------------------------------------------------
-- [ FILTERS ] --
-------------------------------------------------------------------------------

local function clearFilter()
    if timecycleSet then
        ClearTimecycleModifier()
        timecycleSet = false
    end
end

local function applyFilter(id)
    clearFilter()
    local f = filters[id]
    if f and f.timecycle then
        SetTimecycleModifier(f.timecycle)
        SetTimecycleModifierStrength(f.strength or 1.0)
        timecycleSet = true
    end
end

-------------------------------------------------------------------------------
-- [ ENTER / EXIT ] --
-------------------------------------------------------------------------------

function PhotoMode.IsActive() return active end

local function enter()
    if active then return end
    active = true

    if Core and Core.IsMenuOpen and Core.IsMenuOpen() then
        Core.CloseMenu()
    end

    local ped = PlayerPedId()
    azimuth   = GetEntityHeading(ped)
    elevation = 12.0
    distance  = 2.6
    fov       = 45.0
    dofOn     = cfg.DofDefault ~= false

    local t = targetCoords()
    cam = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
    applyCamera()
    SetCamActiveWithInterp(cam, GetRenderingCam(), 600, 1, 1)
    SetCamActive(cam, true)
    RenderScriptCams(true, true, 600, true, true)
    applyDof()
    SetNuiFocus(true, true)

    CreateThread(function()
        while active do
            applyCamera()
            applyDof()
            HideHudAndRadarThisFrame()
            -- Block movement / attack / weapon-wheel; allow the NUI cursor.
            DisableControlAction(0, 24, true)  -- attack
            DisableControlAction(0, 25, true)  -- aim
            DisableControlAction(0, 30, true)  -- move LR
            DisableControlAction(0, 31, true)  -- move UD
            DisableControlAction(0, 21, true)  -- sprint
            DisableControlAction(0, 22, true)  -- jump
            DisableControlAction(0, 36, true)  -- duck
            DisableControlAction(0, 37, true)  -- weapon wheel
            DisablePlayerFiring(PlayerId(), true)
            Wait(0)
        end
    end)

    SendNUIMessage({
        action    = 'photoModeEntered',
        filters   = cfg.Filters or {},
        dof       = dofOn,
        watermark = cfg.Watermark ~= false,
        discord   = (cfg.Discord and cfg.Discord.Enabled) and true or false,
    })
    Utils.MbtDebugger('PhotoMode: entered')
end

local function exit()
    if not active then return end
    active = false

    clearFilter()
    if cam and DoesCamExist(cam) then
        RenderScriptCams(false, true, 500, true, true)
        local camRef = cam
        cam = nil
        CreateThread(function()
            Wait(550)
            if DoesCamExist(camRef) then
                SetCamActive(camRef, false)
                DestroyCam(camRef, false)
            end
        end)
    end
    cam = nil

    SendNUIMessage({ action = 'photoModeExited' })
    SetNuiFocus(false, false)
    Utils.MbtDebugger('PhotoMode: exited')
end

PhotoMode.Exit = exit

-------------------------------------------------------------------------------
-- [ NUI CALLBACKS ] --
-------------------------------------------------------------------------------

RegisterNUICallback('enterPhotoMode', function(_, cb)
    enter()
    cb({ ok = true })
end)

RegisterNUICallback('exitPhotoMode', function(_, cb)
    exit()
    cb({ ok = true })
end)

RegisterNUICallback('photoOrbit', function(data, cb)
    if active then
        azimuth   = azimuth - (tonumber(data.dx) or 0) * ORBIT_SENS
        elevation = math.max(MIN_ELEV, math.min(MAX_ELEV,
            elevation + (tonumber(data.dy) or 0) * ORBIT_SENS))
    end
    cb({ ok = true })
end)

RegisterNUICallback('photoZoom', function(data, cb)
    if active then
        distance = math.max(MIN_DIST, math.min(MAX_DIST,
            distance - (tonumber(data.delta) or 0) * ZOOM_SENS))
    end
    cb({ ok = true })
end)

RegisterNUICallback('photoFov', function(data, cb)
    if active then
        fov = math.max(MIN_FOV, math.min(MAX_FOV, tonumber(data.fov) or fov))
    end
    cb({ ok = true })
end)

RegisterNUICallback('photoToggleDof', function(data, cb)
    if active then
        if data.on ~= nil then dofOn = data.on and true or false else dofOn = not dofOn end
        applyDof()
    end
    cb({ ok = true, dof = dofOn })
end)

RegisterNUICallback('photoFilter', function(data, cb)
    if active and type(data.id) == 'string' then
        applyFilter(data.id)
    end
    cb({ ok = true })
end)

RegisterNUICallback('photoCapture', function(_, cb)
    cb({ ok = true })
    if not active then return end

    if GetResourceState('screenshot-basic') ~= 'started' then
        SendNUIMessage({ action = 'photoCaptureResult', ok = false, reason = 'no-screenshot-basic' })
        return
    end

    TriggerServerEvent('mbt_emote_menu:server:photoUploadRequest')
end)

RegisterNetEvent('mbt_emote_menu:client:photoUploadResult', function(ok, reason)
    SendNUIMessage({ action = 'photoCaptureResult', ok = ok and true or false, reason = reason })
end)

RegisterNetEvent('mbt_emote_menu:client:photoUploadReady', function(uploadUrl)
    if not active then return end
    if type(uploadUrl) ~= 'string' or uploadUrl == '' then return end

    SendNUIMessage({ action = 'photoPrepareCapture' })
    CreateThread(function()
        Wait(90)
        exports['screenshot-basic']:requestScreenshotUpload(
            uploadUrl, 'files[0]', { encoding = 'jpg', quality = 0.85 },
            function(data)
                local ok, messageId = true, nil
                if type(data) == 'string' and data ~= '' then
                    local good, decoded = pcall(json.decode, data)
                    if good and type(decoded) == 'table' then
                        if decoded.id then
                            messageId = tostring(decoded.id)
                        elseif decoded.code ~= nil or decoded.message ~= nil then
                            ok = false
                        end
                    end
                end
                SendNUIMessage({
                    action = 'photoCaptureResult',
                    ok     = ok,
                    reason = ok and 'ok' or 'discord-error',
                })

                if ok and messageId then
                    local c = GetEntityCoords(PlayerPedId())
                    local street = GetStreetNameFromHashKey(GetStreetNameAtCoord(c.x, c.y, c.z)) or ''
                    local zone = GetLabelText(GetNameOfZone(c.x, c.y, c.z)) or ''
                    local area = street
                    if zone ~= '' and zone ~= 'NULL' and zone ~= area then
                        area = (area ~= '') and (area .. ', ' .. zone) or zone
                    end
                    local gameTime = ('%02d:%02d'):format(GetClockHours(), GetClockMinutes())
                    TriggerServerEvent('mbt_emote_menu:server:photoEnrich', messageId, area, gameTime)
                end
            end)
    end)
end)

-------------------------------------------------------------------------------
-- [ SAFETY ] --
-------------------------------------------------------------------------------

CreateThread(function()
    while true do
        Wait(500)
        if active then
            local ped = PlayerPedId()
            if not ped or ped == 0 or IsEntityDead(ped) then exit() end
        end
    end
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName == GetCurrentResourceName() and active then exit() end
end)
