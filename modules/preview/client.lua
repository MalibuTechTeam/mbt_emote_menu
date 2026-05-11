Core = Core or {}

local previewPed   = nil
local previewCam   = nil
local previewProps = {}
local timecycleActive = false
local playerHidden = false
local CAM_DISTANCE       = 2.4
local CAM_HEIGHT_OFFSET  = 0.35
local CAM_LOOK_OFFSET_Z  = 0.30
local CAM_FOV_START      = 55.0
local CAM_FOV_END         = 40.0
local CAM_FOV_ANIM_MS    = 600
local TRANSITION_IN_MS   = 700
local TRANSITION_OUT_MS  = 500
local TIMECYCLE_NAME     = 'cinema'
local TIMECYCLE_STRENGTH = 0.40

-------------------------------------------------------------------------------
-- [ INTERNAL HELPERS ] --
-------------------------------------------------------------------------------

local function easeInOutCubic(t)
    if t < 0.5 then return 4 * t * t * t end
    local v = -2 * t + 2
    return 1 - (v * v * v) / 2
end

local function ClearPreviewProps()
    for _, propEnt in ipairs(previewProps) do
        if DoesEntityExist(propEnt) then
            DetachEntity(propEnt, true, true)
            DeleteEntity(propEnt)
        end
    end
    previewProps = {}
end

local function AttachPreviewProp(ped, propName, boneId, placement)
    if not propName then return end
    CreateThread(function()
        local p        = placement or {}
        local propHash = GetHashKey(propName)
        if Utils.RequestModel(propHash, 3000) then
            local coords  = GetEntityCoords(ped)
            local propEnt = CreateObject(propHash, coords.x, coords.y, coords.z + 0.2, false, false, false)
            SetEntityInvincible(propEnt, true)
            SetEntityCollision(propEnt, false, false)
            AttachEntityToEntity(
                propEnt, ped,
                GetPedBoneIndex(ped, boneId or 28422),
                p[1] or 0.0, p[2] or 0.0, p[3] or 0.0,
                p[4] or 0.0, p[5] or 0.0, p[6] or 0.0,
                true, true, false, true, 1, true)
            SetModelAsNoLongerNeeded(propHash)
            previewProps[#previewProps + 1] = propEnt
        end
    end)
end

local function PlayAnimOnPed(ped, data)
    local animDict = data.animDict
    local animClip = data.animClip
    local scenario = data.scenario
    local animFlag = data.animFlag or 1
    local blendIn  = data.blendIn or 4.0
    local blendOut = data.blendOut or 4.0
    local duration = data.duration or -1

    ClearPedTasks(ped)
    Wait(50)

    if animDict and animClip then
        if Utils.RequestAnimDict(animDict, 3000) then
            TaskPlayAnim(ped, animDict, animClip, blendIn, blendOut, duration, animFlag, 0.0, false, false, false)
        end
    elseif scenario then
        TaskStartScenarioInPlace(ped, scenario, 0, true)
    end
end

local function CreatePreviewCamera(ped)
    local pedPos  = GetEntityCoords(ped)
    local heading = GetEntityHeading(ped)
    local rad     = math.rad(heading)
    local camX    = pedPos.x - math.sin(rad) * CAM_DISTANCE
    local camY    = pedPos.y + math.cos(rad) * CAM_DISTANCE
    local camZ    = pedPos.z + CAM_HEIGHT_OFFSET

    previewCam = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
    SetCamCoord(previewCam, camX, camY, camZ)
    PointCamAtCoord(previewCam, pedPos.x, pedPos.y, pedPos.z + CAM_LOOK_OFFSET_Z)
    SetCamFov(previewCam, CAM_FOV_START)
    SetCamActiveWithInterp(previewCam, GetRenderingCam(), TRANSITION_IN_MS, 1, 1)
    SetCamActive(previewCam, true)
    RenderScriptCams(true, true, TRANSITION_IN_MS, true, true)

    CreateThread(function()
        local started = GetGameTimer()
        local camRef  = previewCam
        while previewCam == camRef and DoesCamExist(camRef) do
            local elapsed = GetGameTimer() - started
            if elapsed >= CAM_FOV_ANIM_MS then
                SetCamFov(camRef, CAM_FOV_END)
                return
            end
            local t = elapsed / CAM_FOV_ANIM_MS
            local eased = easeInOutCubic(t)
            SetCamFov(camRef, CAM_FOV_START + (CAM_FOV_END - CAM_FOV_START) * eased)
            Wait(0)
        end
    end)
end

local function DestroyPreviewCamera()
    if not previewCam then return end
    local camRef = previewCam
    previewCam = nil
    RenderScriptCams(false, true, TRANSITION_OUT_MS, true, true)
    CreateThread(function()
        Wait(TRANSITION_OUT_MS + 50)
        if DoesCamExist(camRef) then
            SetCamActive(camRef, false)
            DestroyCam(camRef, false)
        end
    end)
end

local function ApplyTimecycle()
    if timecycleActive then return end
    SetTimecycleModifier(TIMECYCLE_NAME)
    SetTimecycleModifierStrength(TIMECYCLE_STRENGTH)
    timecycleActive = true
end

local function ClearTimecycle()
    if not timecycleActive then return end
    ClearTimecycleModifier()
    timecycleActive = false
end

-------------------------------------------------------------------------------
-- [ PUBLIC API ] --
-------------------------------------------------------------------------------

function Core.StopPreview()
    SendNUIMessage({ action = 'previewVignette', visible = false })
    DestroyPreviewCamera()
    ClearTimecycle()
    ClearPreviewProps()

    if previewPed and DoesEntityExist(previewPed) then
        DeleteEntity(previewPed)
    end
    previewPed = nil

    if playerHidden then
        playerHidden = false
    end
end

-------------------------------------------------------------------------------
-- [ NUI CALLBACKS ] --
-------------------------------------------------------------------------------

RegisterNUICallback('startPreview', function(data, cb)
    if not MBT.Features.PreviewPed then
        cb({}); return
    end

    if previewPed and DoesEntityExist(previewPed) then
        ClearPreviewProps()
        AttachPreviewProp(previewPed, data.prop, data.propBone, data.propPlace)
        AttachPreviewProp(previewPed, data.prop2, data.prop2Bone, data.prop2Place)
        PlayAnimOnPed(previewPed, data)
        Utils.MbtDebugger('Preview swapped: ' .. tostring(data.name))
        cb({ ok = true })
        return
    end

    local playerPed = PlayerPedId()
    local coords    = GetEntityCoords(playerPed)
    local heading   = GetEntityHeading(playerPed)

    previewPed = ClonePed(playerPed, false, false, false)
    SetEntityCoordsNoOffset(previewPed, coords.x, coords.y, coords.z, false, false, false)
    SetEntityHeading(previewPed, heading)
    SetEntityCollision(previewPed, false, false)
    SetEntityInvincible(previewPed, true)
    FreezeEntityPosition(previewPed, true)
    SetBlockingOfNonTemporaryEvents(previewPed, true)
    NetworkSetEntityInvisibleToNetwork(previewPed, true)
    SetEntityLocallyVisible(previewPed)
    playerHidden = true
    CreateThread(function()
        while playerHidden do
            SetEntityLocallyInvisible(PlayerPedId())
            Wait(0)
        end
    end)

    PlayAnimOnPed(previewPed, data)
    AttachPreviewProp(previewPed, data.prop, data.propBone, data.propPlace)
    AttachPreviewProp(previewPed, data.prop2, data.prop2Bone, data.prop2Place)

    CreatePreviewCamera(previewPed)
    ApplyTimecycle()
    SendNUIMessage({ action = 'previewVignette', visible = true })

    Utils.MbtDebugger('Preview started: ' .. tostring(data.name))
    cb({ ok = true })
end)

RegisterNUICallback('stopPreview', function(_, cb)
    Core.StopPreview()
    Utils.MbtDebugger('Preview stopped')
    cb({ ok = true })
end)
