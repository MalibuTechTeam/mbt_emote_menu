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

local lightCfg = cfg.Lighting or {}
local envCfg    = cfg.Environment or {}

local LIGHT_ENABLED = lightCfg.Enabled ~= false
local ENV_ENABLED   = envCfg.Enabled ~= false

-- Starting points, not the only positions. Each is a real place around the
-- subject measured FROM the camera: front is over the photographer's shoulder,
-- side rakes across the face, rim comes from behind to separate the subject
-- from the background. From any of them the light can be dragged anywhere.
local KEY_PRESETS = {
    front = { az =   8.0, elev = 22.0, dist = 1.9 },
    side  = { az =  68.0, elev = 18.0, dist = 2.1 },
    rim   = { az = 172.0, elev = 30.0, dist = 2.4 },
}

local LIGHT_RANGE     = lightCfg.Range or 5.0
local LIGHT_MIN_DIST  = 0.6
local LIGHT_MAX_DIST  = math.min(4.5, LIGHT_RANGE)
local LIGHT_MIN_ELEV  = -35.0
local LIGHT_MAX_ELEV  = 80.0

-- How far below the ped's feet the lamp may never pass. With no shadow casting
-- a light under the floor glows with no visible source, which is a bug that
-- looks like a feature.
local LIGHT_FLOOR     = 0.20

-- The marker exists only while the light is being moved. There is a capture
-- path we do not control -- the panel tells players to use their own screenshot
-- key, and Lua is never told before that happens -- so the only honest defence
-- is a marker that is not on screen except during a gesture.
local LIGHT_MARK_MS   = 400

-- Deltas arrive from a panel and are therefore not trusted: one message may not
-- move the light further than a person could drag in a frame.
local MAX_DAZ, MAX_DELEV, MAX_DDIST = 180.0, 90.0, 2.0

-- Re-assert the sky on a slow beat. Almost every server runs a weather sync
-- that pushes its own state back every few seconds; once is not enough, and
-- every frame would restart the transition and strobe.
local ENV_REASSERT_MS = 1500

-- Live state
local active        = false
local cam           = nil
local azimuth       = 0.0   -- degrees, world yaw around the ped
local elevation     = 12.0  -- degrees
local distance      = 2.6   -- metres
local fov           = 45.0
local dofOn         = cfg.DofDefault ~= false
local timecycleSet  = false

-- Lighting
local lightOn     = lightCfg.DefaultOn == true
local lightPower  = tonumber(lightCfg.DefaultIntensity) or 3.0  -- 0.5 .. 8
local lightWarm   = tonumber(lightCfg.DefaultWarmth) or 0.0     -- -1 cool .. +1 warm
local lightPreset = lightCfg.DefaultKey or 'front'              -- or 'custom'

local startKey    = KEY_PRESETS[lightPreset] or KEY_PRESETS.front
local lightAz     = startKey.az    -- degrees, offset from the camera azimuth
local lightElev   = startKey.elev  -- degrees above the look point
local lightDist   = startKey.dist  -- metres from the subject

local lightMovedAt = 0    -- when the marker was last earned
local capturing    = false -- a screenshot is being taken; draw nothing extra

-- Hour and sky. nil means "leave the world alone", which is the resting state:
-- an owner should not have their server's own weather quietly overridden the
-- moment a player opens the camera.
local envHour    = nil
local envMinute  = 0
local envWeather = nil

-------------------------------------------------------------------------------
-- [ CAMERA MATH ] --
-------------------------------------------------------------------------------

local function targetCoords()
    local ped = PlayerPedId()
    local c = GetEntityCoords(ped)
    return vector3(c.x, c.y, c.z + TARGET_Z)
end

---Warmth (-1 cool .. +1 warm) to an RGB triplet.
---
---Anchored on three real white points rather than a hue rotation: tungsten,
---daylight, and open shade. A saturated colour cast looks like a filter; these
---read as a lamp.
local function warmthToRgb(w)
    w = math.max(-1.0, math.min(1.0, w or 0.0))

    local r, g, b
    if w >= 0 then
        -- daylight -> tungsten
        r, g, b = 255, 255 - (70 * w), 255 - (140 * w)
    else
        -- daylight -> open shade
        local c = -w
        r, g, b = 255 - (85 * c), 255 - (40 * c), 255
    end

    return math.floor(r), math.floor(g), math.floor(b)
end

---Brings the light back inside what is physically sensible, and does it on the
---INPUT rather than on the computed height.
---
---That distinction is the whole correctness of this function. Clamping the
---final Z would silently change the light's real elevation and distance while
---we went on reporting the numbers that were asked for -- a readout that lies.
---Deriving the elevation limit from the distance keeps the state we report true.
---
---The limit is real and moves: at 4.5 m the light can only drop to -8.3 degrees
---before it would pass under the floor, at 1.9 m it reaches -20, and under
---about 0.65 m nothing constrains it. Low-angle light stays available, and it
---is most available close in, which is where it is most usable anyway.
local function clampLight()
    lightDist = math.max(LIGHT_MIN_DIST, math.min(LIGHT_MAX_DIST, lightDist))

    local ratio = -(TARGET_Z + LIGHT_FLOOR) / lightDist
    ratio = math.max(-1.0, math.min(1.0, ratio))

    local minElev = math.max(LIGHT_MIN_ELEV, math.deg(math.asin(ratio)))
    lightElev = math.max(minElev, math.min(LIGHT_MAX_ELEV, lightElev))

    lightAz = lightAz % 360.0
end

---What Lua actually holds, which is what the panel must display.
local function lightState()
    return {
        on     = lightOn,
        power  = lightPower,
        warmth = lightWarm,
        az     = lightAz,
        elev   = lightElev,
        dist   = lightDist,
        preset = lightPreset,
    }
end

---A single key light, placed relative to the CAMERA.
---
---That is the whole point: `azimuth` is where the photographer is standing, so
---adding the light's own bearing to it keeps the light in the same relationship
---to the shot however far you orbit. A light at fixed world coordinates lights
---the subject from one side of the room and from nowhere on the other.
local function drawKeyLight()
    if not lightOn then return end

    local t = targetCoords()
    local az = math.rad(azimuth + lightAz)
    local elr = math.rad(lightElev)
    local horiz = lightDist * math.cos(elr)

    local lx = t.x + horiz * math.sin(az)
    local ly = t.y + horiz * math.cos(az)
    local lz = t.z + lightDist * math.sin(elr)

    local r, g, b = warmthToRgb(lightWarm)
    DrawLightWithRange(lx, ly, lz, r, g, b, LIGHT_RANGE, lightPower)

    -- The lamp itself, while it is in hand. Dragging something invisible is
    -- guesswork; and it disappears on its own, so it cannot be photographed
    -- except by someone pressing the key mid-gesture.
    if not capturing and (GetGameTimer() - lightMovedAt) < LIGHT_MARK_MS then
        DrawMarker(28, lx, ly, lz, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
            0.13, 0.13, 0.13, r, g, b, 200, false, false, 2, false, nil, nil, false)
    end
end

---Hour and sky, re-applied while photo mode is open.
---
---Both natives are client-side: the sun moves and the sky changes for the
---photographer and for nobody else. That is what makes this safe to expose to
---players rather than to admins.
local function applyEnvironment()
    if envHour then
        NetworkOverrideClockTime(envHour, envMinute, 0)
    end
end

local function clearEnvironment()
    NetworkClearClockTimeOverride()
    ClearOverrideWeather()
    ClearWeatherTypePersist()
    envHour, envWeather = nil, nil
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

---Depth of field. Called every frame, and it has to be.
---
---Configuring the camera is only half of it: GTA will not run the shallow DOF
---pass at all unless SetUseHiDof() is called on the frame it should render.
---Without it every setting below is correct and nothing is blurred, which is
---exactly what "the blur does nothing" looks like.
local function applyDof()
    if not cam or not DoesCamExist(cam) then return end

    if dofOn then
        SetCamUseShallowDofMode(cam, true)
        SetCamNearDof(cam, math.max(0.1, distance - 1.2))
        SetCamFarDof(cam, distance + 2.5)
        SetCamDofStrength(cam, 1.0)
        SetUseHiDof()
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
            drawKeyLight()
            applyEnvironment()
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

    CreateThread(function()
        while active do
            if envWeather then
                SetWeatherTypeNowPersist(envWeather)
            end
            Wait(ENV_REASSERT_MS)
        end
    end)

    SendNUIMessage({
        action    = 'photoModeEntered',
        filters   = cfg.Filters or {},
        dof       = dofOn,
        watermark = cfg.Watermark ~= false,
        discord   = (cfg.Discord and cfg.Discord.Enabled) and true or false,
        -- Sections the owner left switched on. The panel hides a tab entirely
        -- rather than showing controls that do nothing.
        lighting  = LIGHT_ENABLED,
        environment = ENV_ENABLED,
        weathers  = envCfg.Weathers or {},
        light     = lightState(),
        lightRange = { minDist = LIGHT_MIN_DIST, maxDist = LIGHT_MAX_DIST },
    })
    Utils.MbtDebugger('PhotoMode: entered')
end

local function exit()
    if not active then return end

    -- Whatever we borrowed goes back before anything else: an override left
    -- behind would follow the player around for the rest of the session.
    clearEnvironment()
    capturing = false
    lightOn = lightCfg.DefaultOn == true
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

---@return boolean true when `n` is a number that can be used in arithmetic
local function finite(n)
    return type(n) == 'number' and n == n and n ~= math.huge and n ~= -math.huge
end

RegisterNUICallback('photoLight', function(data, cb)
    if active and LIGHT_ENABLED and type(data) == 'table' then
        if data.on ~= nil then lightOn = data.on and true or false end
        if finite(data.power) then lightPower = math.max(0.5, math.min(8.0, data.power)) end
        if finite(data.warmth) then lightWarm = math.max(-1.0, math.min(1.0, data.warmth)) end

        -- A preset is a jump to a known place, so it takes all three at once
        -- and puts the name back on the light.
        local p = type(data.preset) == 'string' and KEY_PRESETS[data.preset]
        if p then
            lightPreset = data.preset
            lightAz, lightElev, lightDist = p.az, p.elev, p.dist
            lightMovedAt = GetGameTimer()
        end

        clampLight()
    end
    cb({ ok = true, light = lightState() })
end)

---Moves the light. Deltas, not absolutes: the panel is reporting a gesture, and
---a gesture is a change rather than a destination.
RegisterNUICallback('photoLightMove', function(data, cb)
    if active and LIGHT_ENABLED and type(data) == 'table' then
        local daz   = finite(data.daz) and math.max(-MAX_DAZ, math.min(MAX_DAZ, data.daz)) or 0.0
        local delev = finite(data.delev) and math.max(-MAX_DELEV, math.min(MAX_DELEV, data.delev)) or 0.0
        local ddist = finite(data.ddist) and math.max(-MAX_DDIST, math.min(MAX_DDIST, data.ddist)) or 0.0

        if daz ~= 0.0 or delev ~= 0.0 or ddist ~= 0.0 then
            lightAz   = lightAz + daz
            lightElev = lightElev + delev
            lightDist = lightDist + ddist
            clampLight()

            -- It is no longer any of the three presets, and the panel must stop
            -- claiming it is.
            lightPreset = 'custom'
            lightMovedAt = GetGameTimer()
        end
    end
    cb({ ok = true, light = lightState() })
end)

RegisterNUICallback('photoTime', function(data, cb)
    if active and ENV_ENABLED and type(data) == 'table' then
        if data.hour == nil then
            -- Back to the server's own clock, rather than to some default hour
            -- of ours: the world we found is the one we give back.
            NetworkClearClockTimeOverride()
            envHour = nil
        else
            envHour = math.max(0, math.min(23, math.floor(tonumber(data.hour) or 12)))
            envMinute = math.max(0, math.min(59, math.floor(tonumber(data.minute) or 0)))
        end
    end
    cb({ ok = true })
end)

RegisterNUICallback('photoWeather', function(data, cb)
    if active and ENV_ENABLED and type(data) == 'table' then
        if type(data.id) ~= 'string' or data.id == '' then
            ClearOverrideWeather()
            ClearWeatherTypePersist()
            envWeather = nil
        else
            -- Uppercase and alphanumeric only: the id reaches a native, and the
            -- panel is not the authority on what a weather type is called.
            local id = data.id:upper():gsub('[^A-Z0-9_]', '')
            if id ~= '' then
                envWeather = id
                SetWeatherTypeNowPersist(id)
            end
        end
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
    capturing = false
    SendNUIMessage({ action = 'photoCaptureResult', ok = ok and true or false, reason = reason })
end)

RegisterNetEvent('mbt_emote_menu:client:photoUploadReady', function(uploadUrl)
    if not active then return end
    if type(uploadUrl) ~= 'string' or uploadUrl == '' then return end

    -- Unconditional on the path we own. The player's own screenshot key is a
    -- path we do not, which is why the marker decays on its own as well.
    capturing = true
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
