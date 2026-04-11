Core = Core or {}

local previewPed = nil
local previewCam = nil
local previewProps = {}

-------------------------------------------------------------------------------
-- [ INTERNAL HELPERS ] --
-------------------------------------------------------------------------------

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
    previewCam = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
    local camPos = GetOffsetFromEntityInWorldCoords(ped, 0.0, 2.5, 0.35)
    SetCamCoord(previewCam, camPos.x, camPos.y, camPos.z)
    local pedPos = GetEntityCoords(ped)
    PointCamAtCoord(previewCam, pedPos.x, pedPos.y, pedPos.z + 0.3)
    SetCamFov(previewCam, 40.0)
    SetCamActiveWithInterp(previewCam, GetRenderingCam(), 700, 1, 1)
    SetCamActive(previewCam, true)
    RenderScriptCams(true, true, 700, true, true)
end

-------------------------------------------------------------------------------
-- [ PUBLIC API ] --
-------------------------------------------------------------------------------

function Core.StopPreview()
    if previewCam then
        RenderScriptCams(false, true, 600, true, true)
        local camRef = previewCam
        previewCam = nil
        CreateThread(function()
            Wait(650)
            SetCamActive(camRef, false)
            DestroyCam(camRef, false)
        end)
    end

    ClearPreviewProps()

    if previewPed and DoesEntityExist(previewPed) then
        DeleteEntity(previewPed)
        previewPed = nil
    end

    local pp = PlayerPedId()
    if pp and pp ~= 0 then
        SetEntityVisible(pp, true, false)
        SetEntityAlpha(pp, 255, false)
    end
end

-------------------------------------------------------------------------------
-- [ NUI CALLBACKS ] --
-------------------------------------------------------------------------------

RegisterNUICallback('startPreview', function(data, cb)
    if not MBT.Features.PreviewPed then
        cb({}); return
    end

    -- If preview ped already exists and is valid, reuse it (just swap anim + props)
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

    previewPed      = ClonePed(playerPed, false, false, false)

    SetEntityCoordsNoOffset(previewPed, coords.x, coords.y, coords.z, false, false, false)
    SetEntityHeading(previewPed, heading)
    SetEntityCollision(previewPed, false, false)
    SetEntityInvincible(previewPed, true)
    FreezeEntityPosition(previewPed, true)
    SetBlockingOfNonTemporaryEvents(previewPed, true)

    SetEntityVisible(playerPed, false, false)
    SetEntityAlpha(playerPed, 0, false)

    PlayAnimOnPed(previewPed, data)

    AttachPreviewProp(previewPed, data.prop, data.propBone, data.propPlace)
    AttachPreviewProp(previewPed, data.prop2, data.prop2Bone, data.prop2Place)

    CreatePreviewCamera(previewPed)

    Utils.MbtDebugger('Preview started: ' .. tostring(data.name))
    cb({ ok = true })
end)

RegisterNUICallback('stopPreview', function(_, cb)
    Core.StopPreview()
    Utils.MbtDebugger('Preview stopped')
    cb({ ok = true })
end)
