-------------------------------------------------------------------------------
-- [ SCENES & SPOTS — CLIENT ] --
--
-- The player-facing half of what the editor authors.
--
--   spot  (one mark)  -> a prompt when you walk into it; press the key, the
--                        emote plays. No networking involved.
--   scene (many marks)-> a prompt to start it; nearby players get a role, walk
--                        to their mark, ready up, and everyone fires together.
--
-- The scene list itself is public: a spot is a feature of the world and every
-- player needs to know it is there. Only editing is ACE gated, server-side.
-------------------------------------------------------------------------------

local cfg = MBT.VenueSpots or {}

if cfg.Enabled == false then return end

local POLL_MS  = tonumber(cfg.PollMs) or 750
local TRIGGER_KEY = cfg.Key or 'E'
local KEY_CONTROL = 38 -- E

local scenes = {}
local currentSpot = nil     -- the scene we are standing in
local promptVisible = false

-- [sceneId] = { [markIndex] = true }. Mirrored from the server; a client
-- cannot work this out on its own.
local occupancy = {}
local mySeat = nil          -- { sceneId, markIndex } while we hold one

-- Live session state (as a participant, host or not)
local myMark = nil
local myRole = nil
local pendingInvite = nil
local isReady = false

local KEY_CONFIRM = 38   -- E — join / ready
local KEY_LEAVE   = 194  -- Backspace — decline / leave

-- How close you must be to your mark before Ready is accepted. Matched to the
-- server's own tolerance, and now stated in the UI instead of silently
-- refusing.
local READY_RANGE = 2.0

-------------------------------------------------------------------------------
-- [ ELIGIBILITY ] --
-------------------------------------------------------------------------------

---Same shape as openjoin's gate: a prompt is noise while the player is busy,
---driving, dead, or already inside one of our own full-screen modes.
local function canPrompt()
    local ped = PlayerPedId()
    if not ped or ped == 0 then return false end
    if IsEntityDead(ped) then return false end
    if IsPedInAnyVehicle(ped, false) then return false end

    if Core and Core.IsMenuOpen and Core.IsMenuOpen() then return false end
    if Editor and Editor.IsActive and Editor.IsActive() then return false end
    if PhotoMode and PhotoMode.IsActive and PhotoMode.IsActive() then return false end
    if myMark then return false end
    -- Sitting on it already. Offering the seat to the person in it is how you
    -- end up reading "every seat here is taken" over your own animation.
    if mySeat then return false end

    return true
end

-------------------------------------------------------------------------------
-- [ PROMPT ] --
-------------------------------------------------------------------------------

local function hidePrompt()
    if not promptVisible then return end
    promptVisible = false
    currentSpot = nil
    SendNUIMessage({ action = 'venueHide' })
end

---@return boolean true when every mark of this scene is taken
local function allSeatsTaken(scene)
    if scene.type == 'scene' then return false end
    local taken = occupancy[scene.id]
    if not taken then return false end

    for i = 1, #scene.marks do
        if not taken[i] then return false end
    end
    return true
end

---The seat the player actually walked up to: the closest one our mirror of the
---occupancy does not already show as taken.
---
---It is a preference, not a decision. The server owns the answer and will hand
---back something else if this one was claimed in the meantime -- our mirror is
---always a little behind, and that is fine.
---@return number|nil nil when every mark looks taken from here
local function preferredMark(scene)
    local marks = scene.marks or {}
    if #marks < 2 then return 1 end

    local c = GetEntityCoords(PlayerPedId())
    local taken = occupancy[scene.id] or {}
    local best, bestDist = nil, nil

    for i = 1, #marks do
        if not taken[i] then
            local m = marks[i]
            -- Squared distance: the ordering is all we need from it.
            local dx, dy, dz = c.x - m.x, c.y - m.y, c.z - m.z
            local d2 = dx * dx + dy * dy + dz * dz
            if not bestDist or d2 < bestDist then
                best, bestDist = i, d2
            end
        end
    end

    return best
end

local lastPromptOccupied = nil
local lastPromptMark = nil

local function showPrompt(scene)
    local full = allSeatsTaken(scene)

    -- The name of the seat you are standing at, when it has one. A scene is
    -- excluded: its roles are handed out by the server after everyone accepts,
    -- so naming one here would promise something we cannot keep.
    local markName = nil
    if scene.type ~= 'scene' and #(scene.marks or {}) > 1 then
        local i = preferredMark(scene)
        local m = i and scene.marks[i]
        markName = m and m.role or nil
    end

    if promptVisible and currentSpot and currentSpot.id == scene.id
        and lastPromptOccupied == full and lastPromptMark == markName then
        return
    end

    currentSpot = scene
    promptVisible = true
    lastPromptOccupied = full
    lastPromptMark = markName

    SendNUIMessage({
        action   = 'venueShow',
        label    = scene.label,
        mark     = markName,
        key      = TRIGGER_KEY,
        isScene  = scene.type == 'scene',
        occupied = full,
        seats    = (scene.type == 'seats') and #scene.marks or nil,
    })
end

---The nearest scene whose radius contains the player, measured against ANY of
---its marks. A bench of three is one prompt you can reach from any end of it,
---not three prompts fighting over which is closest.
---@return table|nil
local function nearestScene()
    local ped = PlayerPedId()
    local c = GetEntityCoords(ped)
    local best, bestDist = nil, nil

    for i = 1, #scenes do
        local scene = scenes[i]
        local r = scene.radius or 2.5
        local marks = scene.marks or {}

        for j = 1, #marks do
            local m = marks[j]
            -- Squared distance: no square root on a list walked every tick.
            local dx, dy, dz = c.x - m.x, c.y - m.y, c.z - m.z
            local d2 = dx * dx + dy * dy + dz * dz
            if d2 <= r * r and (not bestDist or d2 < bestDist) then
                best, bestDist = scene, d2
            end
        end
    end

    return best
end

-------------------------------------------------------------------------------
-- [ TRIGGERING ] --
-------------------------------------------------------------------------------

local function nearbyServerIds(radius)
    local myPed = PlayerPedId()
    local myCoords = GetEntityCoords(myPed)
    local out = {}

    for _, playerId in ipairs(GetActivePlayers()) do
        if playerId ~= PlayerId() then
            local ped = GetPlayerPed(playerId)
            if ped and DoesEntityExist(ped) then
                if #(GetEntityCoords(ped) - myCoords) <= radius then
                    out[#out + 1] = GetPlayerServerId(playerId)
                end
            end
        end
    end

    return out
end

---Places the ped exactly where the author stood, facing the way they faced.
---Without this the whole editor is pointless: leaning on a bar counter only
---reads as leaning on it from one precise spot and angle, and "play the emote
---wherever the player happens to be" is what every other emote menu already
---does.
---Tells everyone else which way we are facing. Local heading changes on a ped
---in an emote do not replicate; this does.
local function publishHeading(heading)
    TriggerServerEvent('mbt_emote_menu:syncHeading', heading)
end

-- Other players' authored headings, applied locally so the pose reads right
-- from the outside. Mirrors what rpemotes does for its own placement.
AddStateBagChangeHandler('mbtEmoteHeading', nil, function(bagName, _, value)
    local playerId = GetPlayerFromStateBagName(bagName)
    if not playerId or playerId == PlayerId() then return end
    if value == nil then return end

    local ped = GetPlayerPed(playerId)
    if DoesEntityExist(ped) then SetEntityHeading(ped, value) end
end)

---Final alignment. Used on its own for scenes, where everyone is already
---standing on their mark and the countdown has to fire at once, and as the
---last step of a walk for spots.
local function snapToMark(m)
    if cfg.SnapToMark == false then return end
    if type(m) ~= 'table' then return end

    local ped = PlayerPedId()
    if not ped or ped == 0 or IsPedInAnyVehicle(ped, false) then return end

    SetEntityCoordsNoOffset(ped, m.x, m.y, m.z, false, false, false)
    SetEntityHeading(ped, m.heading or GetEntityHeading(ped))
    publishHeading(m.heading)
end

-- Approach timings. Together these are the difference between a character
-- that arrives somewhere and one that teleports and snaps: about three
-- quarters of a second of deliberate movement before the pose takes over.
local function anyMovementPressed()
    return IsControlJustPressed(0, 32) or IsControlJustPressed(0, 33)
        or IsControlJustPressed(0, 34) or IsControlJustPressed(0, 35)
end

---Walks to the mark and puts the ped on it.
---
---A port of rpemotes' walkPedToPlacementPosition (client/Placement.lua), kept
---deliberately faithful: same exit distance, same abandon conditions, same
---order of operations, no clearing of tasks and no turn animation. It is what
---players already see every time they place an emote, and matching it exactly
---is worth more than improving on it -- six attempts at improving on it each
---fixed one thing and introduced another.
---
---Three deviations, all because a mark stores less than a placement does:
---  * ours can be switched off entirely by config;
---  * ours refuses to run in a vehicle, where a spot makes no sense;
---  * their SetEntityRotation restores a stored pitch and roll, and we have
---    only a heading, so ours flattens both -- which is what you want on a
---    slope anyway.
---
---Abandoned if the player takes control back, ends up too far out, or it takes
---too long: their input wins over ours.
---@return boolean arrived
local function walkToMark(m)
    if cfg.SnapToMark == false then return true end
    if type(m) ~= 'table' then return false end

    local ped = PlayerPedId()
    if not ped or ped == 0 or IsPedInAnyVehicle(ped, false) then return false end

    local target = vector3(m.x, m.y, m.z)
    local heading = m.heading or GetEntityHeading(ped)
    local timeout = GetGameTimer() + 5000
    local interrupted = false

    -- The seventh argument is the heading to arrive on, so the ped turns while
    -- walking rather than pivoting at the end.
    TaskGoStraightToCoord(ped, m.x, m.y, m.z, 1, -1, heading, 0)

    -- One metre, theirs. Short of the mark and still walking: the reposition
    -- that follows lands inside the stride instead of on a ped that has already
    -- stopped and is waiting for it. Standing within a metre to begin with
    -- falls out here immediately, which is also what theirs does.
    while timeout > GetGameTimer()
        and GetScriptTaskStatus(ped, 'SCRIPT_TASK_GO_STRAIGHT_TO_COORD') ~= 7
        and #(GetEntityCoords(ped) - target) > 1
        and not interrupted do
        interrupted = anyMovementPressed()
        Wait(0)
    end

    local ped2 = PlayerPedId()

    if interrupted or #(GetEntityCoords(ped2) - target) > 1.5 or GetGameTimer() > timeout then
        ClearPedTasks(ped2)
        return false
    end

    SetEntityCoordsNoOffset(ped2, m.x, m.y, m.z, false, false, false)
    SetEntityRotation(ped2, 0.0, 0.0, heading, 2, false)
    SetEntityHeading(ped2, heading)

    publishHeading(heading)
    return true
end

---Holds the ped still for one frame after the pose starts.
---
---Repositioning it can otherwise drop it before the animation takes hold, and
---rpemotes does exactly this after its own placement. The guard is theirs too:
---a ped some other script froze must stay frozen when we let go.
local function steadyAfterPose()
    local ped = PlayerPedId()
    if IsEntityPositionFrozen(ped) then return end

    FreezeEntityPosition(ped, true)
    CreateThread(function()
        Wait(0)
        FreezeEntityPosition(PlayerPedId(), false)
    end)
end

local function releaseSeat()
    if not mySeat then return end
    mySeat = nil
    TriggerServerEvent('mbt_emote_menu:scenes:release')
end

---Sits us on `markIndex` of `scene`: walk there, turn, hold, perform. The seat
---is already ours by the time this runs — the server said so.
local function takeSeat(scene, markIndex)
    local m = scene.marks[markIndex]
    if not m or not m.emote then
        releaseSeat()
        return
    end

    CreateThread(function()
        if not walkToMark(m) then
            -- Never arrived, so the seat is not ours to hold.
            releaseSeat()
            return
        end

        if not (Core and Core.PlayEmoteRaw) then
            releaseSeat()
            return
        end
        Core.PlayEmoteRaw(m.emote, m.category or 'Emotes', 1)
        steadyAfterPose()

        -- Free it again when the pose ends or when we wander off. The server
        -- covers the third case, disconnecting, which nobody can report.
        Wait(1500)
        while mySeat do
            local performing = Utils.SafeExport(Core._rpemotesExportName, 'IsPlayerInAnim')
            local away = #(GetEntityCoords(PlayerPedId()) - vector3(m.x, m.y, m.z)) > 3.0
            if not performing or away then break end
            Wait(1000)
        end

        publishHeading(nil)
        releaseSeat()
    end)
end

RegisterNetEvent('mbt_emote_menu:scenes:occupancy', function(sceneId, marks)
    if type(sceneId) ~= 'string' then return end
    occupancy[sceneId] = marks or {}
end)

RegisterNetEvent('mbt_emote_menu:scenes:claimed', function(sceneId, markIndex)
    local scene
    for i = 1, #scenes do
        if scenes[i].id == sceneId then scene = scenes[i] break end
    end
    if not scene then return end

    if not markIndex then
        SendNUIMessage({ action = 'sceneFull' })
        return
    end

    mySeat = { sceneId = sceneId, markIndex = markIndex }
    takeSeat(scene, markIndex)
end)

local function trigger(scene)
    if not scene then return end

    if scene.type ~= 'scene' then
        -- A spot is entirely local: no server hop, no session, no waiting.
        -- Ask which seat is free. A spot is just a one-seat version of this,
        -- so both go the same way and neither can double-book.
        hidePrompt()
        TriggerServerEvent('mbt_emote_menu:scenes:claim', scene.id, #scene.marks, preferredMark(scene))
        return
    end

    -- A scene needs other people. Offer everyone in range; the server decides
    -- who actually fits and validates that each one is really near the marks.
    TriggerServerEvent('mbt_emote_menu:scenes:start', scene, nearbyServerIds(25.0))
    hidePrompt()
end

-------------------------------------------------------------------------------
-- [ PROXIMITY LOOP ] --
-------------------------------------------------------------------------------

CreateThread(function()
    while true do
        if #scenes == 0 or not canPrompt() then
            hidePrompt()
            Wait(1000)
        else
            local scene = nearestScene()
            if scene then
                showPrompt(scene)
            else
                hidePrompt()
            end
            Wait(POLL_MS)
        end
    end
end)

-- Key handling runs on its own tick only while something is asking for input,
-- so there is no per-frame cost anywhere else.
CreateThread(function()
    while true do
        if promptVisible or pendingInvite or myMark then
            if promptVisible and IsControlJustPressed(0, KEY_CONTROL) then
                trigger(currentSpot)

            elseif pendingInvite then
                if IsControlJustPressed(0, KEY_CONFIRM) then
                    TriggerServerEvent('mbt_emote_menu:scenes:accept')
                    pendingInvite = nil
                elseif IsControlJustPressed(0, KEY_LEAVE) then
                    TriggerServerEvent('mbt_emote_menu:scenes:decline')
                    pendingInvite = nil
                    SendNUIMessage({ action = 'sceneEnded', reason = 'declined' })
                end

            elseif myMark then
                if IsControlJustPressed(0, KEY_CONFIRM) then
                    local c = GetEntityCoords(PlayerPedId())
                    local dx, dy = c.x - myMark.x, c.y - myMark.y
                    if (dx * dx + dy * dy) > (READY_RANGE * READY_RANGE) then
                        -- Say it. The old build refused and showed nothing,
                        -- which reads as a broken button.
                        SendNUIMessage({ action = 'sceneTooFar' })
                    else
                        isReady = not isReady
                        TriggerServerEvent('mbt_emote_menu:scenes:ready', isReady)
                        SendNUIMessage({ action = 'sceneReadyState', ready = isReady })
                    end
                elseif IsControlJustPressed(0, KEY_LEAVE) then
                    TriggerServerEvent('mbt_emote_menu:scenes:cancel')
                    TriggerServerEvent('mbt_emote_menu:scenes:decline')
                    myMark, myRole, isReady = nil, nil, false
                    SendNUIMessage({ action = 'sceneEnded', reason = 'you-left' })
                end
            end

            Wait(0)
        else
            Wait(200)
        end
    end
end)

-------------------------------------------------------------------------------
-- [ FINDING YOUR MARK ] --
--
-- A ring on the ground is useless at twenty metres, behind a wall, or behind
-- the camera — which is most of the time between being given a role and
-- reaching it. The ring stays as the final target; the HUD carries the
-- direction and the distance until you can see it.
--
-- The screen position is computed here and handed to the NUI, the same way the
-- What's That bubble tracks a player.
-------------------------------------------------------------------------------

CreateThread(function()
    while true do
        if myMark then
            DrawMarker(1, myMark.x, myMark.y, myMark.z - 0.98, 0.0, 0.0, 0.0,
                0.0, 0.0, 0.0, 0.7, 0.7, 0.35, 0, 230, 118, 190,
                false, false, 2, false, nil, nil, false)
            Wait(0)
        else
            Wait(400)
        end
    end
end)

CreateThread(function()
    while true do
        if not myMark then
            Wait(400)
        else
            local c = GetEntityCoords(PlayerPedId())
            local dist = #(vector3(myMark.x, myMark.y, myMark.z) - c)
            local onScreen, sx, sy = World3dToScreen2d(myMark.x, myMark.y, myMark.z + 0.9)

            -- Heading from the player to the mark, expressed relative to where
            -- the camera is looking, so the arrow points the way you must turn.
            local camHeading = GetGameplayCamRot(2).z
            local toMark = math.deg(math.atan(myMark.y - c.y, myMark.x - c.x)) - 90.0
            local relative = ((toMark - camHeading) + 540.0) % 360.0 - 180.0

            SendNUIMessage({
                action   = 'sceneMark',
                onScreen = onScreen and true or false,
                x        = sx,
                y        = sy,
                dist     = math.floor(dist + 0.5),
                inRange  = dist <= READY_RANGE,
                bearing  = relative,
            })

            Wait(80)
        end
    end
end)

-------------------------------------------------------------------------------
-- [ SESSION EVENTS ] --
-------------------------------------------------------------------------------

RegisterNetEvent('mbt_emote_menu:scenes:sync', function(list)
    scenes = type(list) == 'table' and list or {}
    Utils.MbtDebugger(('Scenes: %d loaded'):format(#scenes))

    -- Handed to the UI so an admin can review and delete what they authored.
    -- Nothing gated here: the list is public by design, and the delete path is
    -- ACE checked server-side regardless of what the UI chooses to show.
    SendNUIMessage({ action = 'scenesList', scenes = scenes })
end)

RegisterNetEvent('mbt_emote_menu:scenes:invite', function(data)
    if type(data) ~= 'table' then return end
    if myMark then return end

    pendingInvite = data
    SendNUIMessage({
        action    = 'sceneInvite',
        label     = data.label,
        role      = data.role,
        timeoutMs = data.timeoutMs or 30000,
    })
end)

RegisterNetEvent('mbt_emote_menu:scenes:assigned', function(data)
    if type(data) ~= 'table' or type(data.mark) ~= 'table' then return end

    pendingInvite = nil
    myMark = data.mark
    myRole = data.role
    isReady = false

    SendNUIMessage({
        action = 'sceneAssigned',
        role   = data.role,
        label  = data.label,
        host   = data.host and true or false,
    })
end)

-- The role on the invitation had already gone; say so rather than swapping it
-- underneath the player.
RegisterNetEvent('mbt_emote_menu:scenes:reassigned', function()
    SendNUIMessage({ action = 'sceneReassigned' })
end)

RegisterNetEvent('mbt_emote_menu:scenes:progress', function(data)
    if type(data) ~= 'table' then return end
    SendNUIMessage({
        action  = 'sceneProgress',
        roles   = data.roles or 0,
        players = data.players or 0,
        ready   = data.ready or 0,
        pending = data.pending or 0,
    })
end)

RegisterNetEvent('mbt_emote_menu:scenes:countdown', function(n)
    SendNUIMessage({ action = 'sceneCountdown', value = tonumber(n) or 0 })
end)

RegisterNetEvent('mbt_emote_menu:scenes:execute', function(emote, category)
    myRole, isReady = nil, false
    -- Snapped, not walked: Ready already refused anyone more than two metres
    -- out, so this is a small correction, and walking after "3, 2, 1" would
    -- break the simultaneity that a staged scene exists for.
    snapToMark(myMark)

    myMark = nil
    SendNUIMessage({ action = 'sceneEnded' })

    if type(emote) ~= 'string' then return end
    if Core and Core.PlayEmoteRaw then
        Core.PlayEmoteRaw(emote, type(category) == 'string' and category or 'Emotes', 1)
        -- Same reason as the spot path: the snap can drop the ped before the
        -- animation takes hold.
        steadyAfterPose()
    end
end)

RegisterNetEvent('mbt_emote_menu:scenes:ended', function(reason)
    publishHeading(nil)
    myMark, myRole, isReady = nil, nil, false
    pendingInvite = nil
    -- The server always says why. The old UI threw the reason away, so a
    -- timeout, a cancellation and the host leaving all looked identical: the
    -- card simply vanished.
    SendNUIMessage({ action = 'sceneEnded', reason = reason })
end)

-------------------------------------------------------------------------------
-- [ INIT ] --
-------------------------------------------------------------------------------

local function requestScenes()
    TriggerServerEvent('mbt_emote_menu:scenes:request')
    TriggerServerEvent('mbt_emote_menu:scenes:occupancyRequest')
end

AddEventHandler('onResourceStart', function(resourceName)
    if resourceName == GetCurrentResourceName() and NetworkIsPlayerActive(PlayerId()) then
        requestScenes()
    end
end)

RegisterNetEvent('playerSpawned', function()
    requestScenes()
end)
