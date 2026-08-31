-------------------------------------------------------------------------------
-- [ SCENE EDITOR — CLIENT ] --
--
-- The authoring side. The admin walks to where an actor belongs, faces the way
-- that actor should face, and presses one key. That is the mark: we take
-- GetEntityCoords and GetEntityHeading, which for "stand here, look that way"
-- is exact by construction.
--
-- Deliberately NOT built on rpemotes' placement. StartNewPlacement positions an
-- emote to *perform*, and GetPlacementState only ever returns a state string —
-- there is no way to ask it where the player put something.
--
-- TWO PHASES, never a mode toggle:
--
--   placing  the menu is CLOSED. The player owns the controls; a thin bar
--            names the keys. Nothing on screen is clickable, and nothing on
--            screen pretends to be.
--   review   the menu is OPEN, showing the editor view in place of the browse
--            view. Same shell, same header, same cards, same focus handling.
--
-- FiveM's SetNuiFocus is all-or-nothing: while it is on, game controls do not
-- reach the player, so a partially interactive overlay is impossible. Rather
-- than expose that as a key the admin must remember, the tool names the two
-- activities and switches between them itself.
--
-- The editor never calls SetNuiFocus. Core.OpenMenu and Core.CloseMenu own it,
-- and every focus bug this feature had came from a second place trying to.
--
-- Nothing here activates until the server has confirmed the ACE.
-------------------------------------------------------------------------------

Editor = Editor or {}

local unlocked = false     -- server said this player holds the ACE
local poseIndex = 0        -- mark currently being positioned, 0 when none
local active = false       -- editor running at all
local phase = 'placing'    -- 'placing' | 'review'
local working = nil        -- the scene being authored
local selected = 0         -- index of the highlighted mark
local dirty = false        -- unsaved changes exist
local previewing = false   -- the ped is standing on the mark performing it

local LABEL_FAR  = 60.0    -- metres: stop drawing the marker entirely

-- [id] = scene. Our own mirror of the server broadcast: the scenes module
-- returns early when VenueSpots is disabled, and an admin must still be able
-- to author on such a server. It is also what makes "go to this scene" safe --
-- the destination is looked up here, never taken from the panel's payload.
local known = {}

-- modules/scenes returns early when VenueSpots is disabled, taking the panel's
-- scene list with it. When that happens the editor forwards the list itself,
-- so authoring still shows you what you have authored.
local scenesModuleActive = not (MBT.VenueSpots and MBT.VenueSpots.Enabled == false)

local POS_PUSH_MS = 250    -- how often the hub is told where the admin is
local GOTO_BACK   = 1.6    -- metres to stand off a mark, facing it

-------------------------------------------------------------------------------
-- [ STATE ] --
-------------------------------------------------------------------------------

function Editor.IsActive() return active end
function Editor.IsUnlocked() return unlocked end

local function pushState()
    SendNUIMessage({
        action   = 'editorState',
        active   = active,
        phase    = phase,
        scene    = working,
        selected = selected,
        dirty    = dirty,
        previewing = previewing,
    })
end

local function newScene()
    return { id = nil, label = '', type = 'seats', marks = {}, radius = 2.5 }
end

---Review IS the menu, open, showing the editor view instead of the browse
---view. Placing is the menu closed, because the player needs the game's
---controls back.
---
---Nothing here touches SetNuiFocus any more: Core.OpenMenu and Core.CloseMenu
---already own it, and every focus bug this feature had came from a second
---place trying to own it too.
local function setPhase(next)
    phase = next
    pushState()

    if next == 'review' then
        if Core and Core.OpenMenu and not Core.IsMenuOpen() then
            Core.OpenMenu()

            -- OpenMenu refuses silently while the catalog is still loading or
            -- the player cannot emote. Landing in review with no menu would
            -- leave the editor invisible and unusable.
            if not Core.IsMenuOpen() then
                phase = 'placing'
                pushState()
                MBT.Notification({
                    description = MBT.Locale['editor_pick_unavailable'] or 'Cannot open the menu right now',
                })
                return
            end
        end
    else
        if Core and Core.IsMenuOpen and Core.IsMenuOpen() then Core.CloseMenu() end
    end
end

-------------------------------------------------------------------------------
-- [ MARKER RENDERING ] --
-------------------------------------------------------------------------------

---A bobbing arrow over one mark, and the only thing the editor puts in the
---world besides the rings themselves.
---
---It replaces the name that used to float here. Names belong in the panel,
---where they are set in the panel's own type and can be edited where they are
---read; what the panel cannot do is tell you WHICH ring in front of you is the
---row you just selected. That is all this does.
local function drawPointer(x, y, z, r, g, b, a)
    -- Bobbing so it reads as a pointer rather than as set dressing that
    -- happens to be hovering.
    local bob = math.sin(GetGameTimer() / 320.0) * 0.05

    DrawMarker(2, x, y, z + 1.28 + bob, 0.0, 0.0, 0.0, 180.0, 0.0, 0.0,
        0.19, 0.19, 0.19, r, g, b, a, false, false, 2, false, nil, nil, false)
end

---A ring on the ground with a chevron on its edge, not a cylinder plus a
---detached arrow: the facing has to read as part of the mark rather than as a
---second object floating near it.
local function drawMarks()
    if not working then return end

    local cam = GetGameplayCamCoord()

    for i = 1, #working.marks do
        local m = working.marks[i]
        local dist = #(vector3(m.x, m.y, m.z) - cam)

        -- An actor that has never been positioned has no place in the world
        -- yet; drawing it would put a ring at the map origin.
        if m.placed and dist <= LABEL_FAR then
            local isSel = (i == selected)
            local complete = m.emote ~= nil

            -- The pose ped is standing on this one, performing it. A ring
            -- under its feet as well is a second symbol for something you can
            -- already see.
            if previewing and i == poseIndex then goto continue end

            -- Selected: brand green. Incomplete: warning amber, because a mark
            -- with no emote cannot be saved and should say so in the world,
            -- not only in the list. Otherwise: muted.
            local r, g, b, a
            if isSel then
                r, g, b, a = 0, 230, 118, 220
            elseif not complete then
                r, g, b, a = 251, 140, 0, 190
            else
                r, g, b, a = 200, 200, 210, 140
            end

            -- Flat disc: reads as a mark to stand on, not a column to walk into.
            DrawMarker(25, m.x, m.y, m.z - 0.97, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                0.75, 0.75, 0.75, r, g, b, a, false, false, 2, false, nil, nil, false)

            if isSel then
                DrawMarker(25, m.x, m.y, m.z - 0.96, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                    1.05, 1.05, 1.05, r, g, b, 90, false, false, 2, false, nil, nil, false)
            end

            -- Chevron on the ring's edge, pointing where the actor looks.
            local rad = math.rad(m.heading)
            DrawMarker(20,
                m.x + math.sin(-rad) * 0.62, m.y + math.cos(-rad) * 0.62, m.z - 0.72,
                0.0, 0.0, 0.0, 180.0, 0.0, m.heading,
                0.22, 0.22, 0.22, r, g, b, a, false, false, 2, false, nil, nil, false)

            -- Only the selected one is pointed at. An arrow over every mark
            -- is the clutter the captions were, in another shape.
            if isSel then drawPointer(m.x, m.y, m.z, r, g, b, 225) end
        end

        ::continue::
    end
end

-------------------------------------------------------------------------------
-- [ MARK EDITING ] --
-------------------------------------------------------------------------------

local function markLimit()
    return (MBT.Admin and MBT.Admin.Editor and MBT.Admin.Editor.MaxMarks) or 12
end

local function removeSelected()
    if not working or not working.marks[selected] then return end
    table.remove(working.marks, selected)
    selected = math.min(selected, #working.marks)
    dirty = true
    pushState()
end

-------------------------------------------------------------------------------
-- [ POSITIONING ] --
--
-- A clone of you stands where the actor will stand, performing its emote,
-- while you keep your own body and walk around it. That is the technique
-- rpemotes uses for its own placement, and the reason theirs is smooth: the
-- thing being moved is a puppet, not the player, so nothing fights the
-- animation task.
--
-- Ours rather than theirs because this is the feature that sells the script:
-- our keys, our help text, and the context that matters while composing a
-- scene — which actor this is, its role, and the marks already placed.
--
-- The ped machinery is Core.CreatePosePed / MovePosePed / DestroyPosePed in
-- modules/preview, which already clones a ped and performs a catalog entry on
-- it. A second copy of that would drift from it.
-------------------------------------------------------------------------------

local posePed = nil        -- { ped, props } while positioning
local posePos = nil        -- position being edited
local poseHeading = 0.0

local MOVE_STEP     = 0.08 -- metres per tap
local MOVE_SPEED    = 1.20 -- metres per second while held
local HOLD_AFTER_MS = 250

-- Degrees per wheel notch. The wheel is a discrete control: a notch registers
-- as pressed for a frame or two, so a degrees-per-second rate worked out to
-- roughly one degree per notch and turning an actor around took a minute.
local ROTATE_PER_NOTCH = 15.0

-- Left shift covers ground fast, for the moment you realise the actor belongs
-- on the other side of the room.
local FAST_MULTIPLIER = 4.0
local KEY_FAST = 21

local KEY_CONFIRM = 38     -- E
local KEY_CANCEL  = 194    -- Backspace
local KEY_LEFT, KEY_RIGHT, KEY_UP, KEY_DOWN = 174, 175, 172, 173
local KEY_WHEEL_UP, KEY_WHEEL_DOWN = 15, 14
local KEY_RISE, KEY_SINK = 10, 11   -- Page Up / Page Down

-- A quarter of the floor-plan step: height is matching a step or a chair seat,
-- not crossing a room, and the whole useful range is a few centimetres.
local LIFT_RATIO = 0.25

local heldAt = {}

---Tap for one exact step, hold for continuous travel scaled by frame time, so
---every machine covers the same ground.
local function tapOrGlide(control, step, perSecond, apply)
    if IsControlJustPressed(0, control) then
        heldAt[control] = GetGameTimer()
        apply(step)
    elseif IsControlPressed(0, control) then
        local since = heldAt[control]
        if since and (GetGameTimer() - since) >= HOLD_AFTER_MS then
            apply(perSecond * GetFrameTime())
        end
    else
        heldAt[control] = nil
    end
end

---Moves the actor. `dz` is metres of height, and it is the admin's call.
---
---Nothing here works out where the ground is, and three attempts at it are why:
---the terrain query cannot see a deck built over dirt, and a ray that can is
---still wrong wherever the geometry has a gap in it. A height that corrects
---itself to the wrong answer is worse than one that stays put, because it
---undoes what the admin just did and leaves them nothing to do about it.
---
---The reading that is never wrong is already in the tool: the actor is born at
---the admin's feet, and those are on the real surface whatever it is made of.
---A slide keeps that height, and PageUp / PageDown change it when the admin
---can see that it needs changing.
local function movePose(dx, dy, dz, dh)
    if not posePos then return end

    if dh ~= 0 then poseHeading = (poseHeading + dh) % 360.0 end

    if dx ~= 0 or dy ~= 0 or dz ~= 0 then
        -- Camera relative, so "forward" means away from you whichever way the
        -- actor itself happens to face.
        local rad = math.rad(GetGameplayCamRot(2).z)
        posePos = vector3(
            posePos.x + (dy * -math.sin(rad)) + (dx * math.cos(rad)),
            posePos.y + (dy * math.cos(rad)) + (dx * math.sin(rad)),
            posePos.z + dz)
    end

    Core.MovePosePed(posePed, posePos, poseHeading)
end

local function endPositioning(commit)
    local m = working and working.marks[poseIndex]

    if commit and posePos and m then
        m.x, m.y, m.z = posePos.x, posePos.y, posePos.z
        m.heading = poseHeading
        m.placed = true
        dirty = true
    elseif m and not m.placed then
        -- Backing out of the first positioning of a new actor removes it: an
        -- actor that was never placed anywhere is not a thing to keep.
        table.remove(working.marks, poseIndex)
        selected = math.min(selected, #working.marks)
    end

    Core.DestroyPosePed(posePed)
    posePed, posePos, poseIndex, previewing = nil, nil, 0, false
    heldAt = {}
    setPhase('review')
end

---@param markIndex number
local function startPositioning(markIndex)
    local m = working and working.marks[markIndex]
    if not m or not m.emote then return end

    local data = Core.GetEmoteByName and Core.GetEmoteByName(m.emote)
    if not data then
        MBT.Notification({
            description = MBT.Locale['editor_no_pose'] or 'That emote is not in the catalog',
        })
        setPhase('review')
        return
    end

    -- An actor already placed starts where it is, so repositioning does not
    -- throw away the work; a new one starts at your feet.
    -- Neither of these gets probed. A stored mark is the author's decision, and
    -- a new actor starts where the admin is standing -- whose own feet are
    -- already on whatever surface they are on.
    if m.placed then
        posePos = vector3(m.x, m.y, m.z)
        poseHeading = m.heading
    else
        local ped = PlayerPedId()
        posePos, poseHeading = GetEntityCoords(ped), GetEntityHeading(ped)
    end

    posePed = Core.CreatePosePed(data, posePos, poseHeading)
    if not posePed then
        MBT.Notification({
            description = MBT.Locale['editor_no_pose'] or 'Could not build the preview',
        })
        setPhase('review')
        return
    end

    poseIndex = markIndex
    previewing = true
    m.placed = true
    pushState()

    CreateThread(function()
        while previewing and active and posePed do
            -- Which actor this is, and what it is doing, are both on the
            -- placing bar. Here we only point at the one in hand.
            drawPointer(posePos.x, posePos.y, posePos.z, 0, 230, 118, 235)

            if not (Core and Core.IsMenuOpen and Core.IsMenuOpen()) then
                if IsControlJustPressed(0, KEY_CONFIRM) then
                    endPositioning(true)
                    return
                elseif IsControlJustPressed(0, KEY_CANCEL) then
                    endPositioning(false)
                    return
                end

                local fast = IsControlPressed(0, KEY_FAST) and FAST_MULTIPLIER or 1.0
                local step, speed = MOVE_STEP * fast, MOVE_SPEED * fast

                tapOrGlide(KEY_LEFT,  step, speed, function(d) movePose(-d, 0, 0, 0) end)
                tapOrGlide(KEY_RIGHT, step, speed, function(d) movePose(d, 0, 0, 0) end)
                tapOrGlide(KEY_UP,    step, speed, function(d) movePose(0, d, 0, 0) end)
                tapOrGlide(KEY_DOWN,  step, speed, function(d) movePose(0, -d, 0, 0) end)

                local lift, liftSpeed = step * LIFT_RATIO, speed * LIFT_RATIO
                tapOrGlide(KEY_RISE, lift, liftSpeed, function(d) movePose(0, 0, d, 0) end)
                tapOrGlide(KEY_SINK, lift, liftSpeed, function(d) movePose(0, 0, -d, 0) end)

                -- The wheel would otherwise switch weapons underneath us.
                DisableControlAction(0, KEY_WHEEL_UP, true)
                DisableControlAction(0, KEY_WHEEL_DOWN, true)
                DisableControlAction(0, 37, true)

                if IsDisabledControlJustPressed(0, KEY_WHEEL_UP) then
                    movePose(0, 0, 0, ROTATE_PER_NOTCH * fast)
                elseif IsDisabledControlJustPressed(0, KEY_WHEEL_DOWN) then
                    movePose(0, 0, 0, -ROTATE_PER_NOTCH * fast)
                end
            end

            Wait(0)
        end
    end)
end

RegisterNUICallback('editorAssignEmote', function(data, cb)
    if not active or not working then
        cb({ ok = false })
        return
    end

    local m = working.marks[selected]
    if not m then
        cb({ ok = false })
        return
    end

    local name = Utils.Sanitize(data.name)
    if not name or name == '' then
        cb({ ok = false })
        return
    end

    m.emote    = name
    m.category = Utils.Sanitize(data.category) or 'Emotes'
    m.label    = type(data.label) == 'string' and data.label or nil
    dirty = true

    -- Straight into positioning: the pose is the thing that needs judging, and
    -- rpemotes' own placement is where you judge it — against the actual chair
    -- or counter, with the controls it already built for exactly this.
    setPhase('placing')
    startPositioning(selected)
    cb({ ok = true })
end)

-------------------------------------------------------------------------------
-- [ ENTER / EXIT ] --
-------------------------------------------------------------------------------

local function enter(scene)
    if active or not unlocked then return end
    active = true
    -- No scene means the hub: the list of what exists, and the state of the
    -- install. A scene is opened or created from there.
    working = scene
    selected = working and #working.marks or 0
    dirty = false

    -- Ask for the list rather than assume someone else already did: this is
    -- the screen that shows it, so this is where it is needed.
    TriggerServerEvent('mbt_emote_menu:scenes:request')

    -- Everything starts in review now: an existing scene has something to look
    -- at, and a new one needs its first actor chosen before there is anything
    -- to position.
    setPhase('review')
    Utils.MbtDebugger('Editor: entered')

    CreateThread(function()
        while active do
            drawMarks()

            Wait(0)
        end
    end)
end

local function exit()
    if not active then return end

    -- Leaving mid-positioning would otherwise strand a cloned ped, its props
    -- and its animation in the world for the rest of the session.
    Core.DestroyPosePed(posePed)
    posePed, posePos, poseIndex = nil, nil, 0

    previewing = false
    active = false
    working = nil
    selected = 0
    dirty = false
    phase = 'placing'

    if Core and Core.IsMenuOpen and Core.IsMenuOpen() then Core.CloseMenu() end
    pushState()
    Utils.MbtDebugger('Editor: exited')
end

Editor.Exit = exit

-------------------------------------------------------------------------------
-- [ NUI CALLBACKS ] --
-------------------------------------------------------------------------------

RegisterNUICallback('editorOpen', function(data, cb)
    if not unlocked then
        cb({ ok = false, error = 'not authorised' })
        return
    end

    local row = nil
    if type(data) == 'table' and type(data.scene) == 'table' then
        -- Prefer our mirror of the server list over the payload: the panel
        -- says which scene, it does not get to say what is in it.
        local id = data.scene.id
        row = (type(id) == 'string' and known[id]) or data.scene
    end

    local scene = nil
    if row then
        -- Work on a copy, so cancelling really cancels.
        scene = json.decode(json.encode(row))
        for _, m in ipairs(scene.marks or {}) do m.placed = true end
    end

    if active then
        -- Already running: this is the hub handing over to one of its rows.
        -- enter() would refuse, and refusing is right -- a second session on
        -- top of the first is exactly what that guard exists to stop.
        working = scene
        selected = scene and #scene.marks or 0
        dirty = false
        pushState()
    else
        enter(scene)
    end

    cb({ ok = true })
end)

--- Start a scene from the hub.
RegisterNUICallback('editorNewScene', function(_, cb)
    if not active then
        cb({ ok = false })
        return
    end
    working = newScene()
    selected = 0
    dirty = false
    pushState()
    cb({ ok = true })
end)

--- Back to the hub without leaving the editor.
RegisterNUICallback('editorCloseScene', function(_, cb)
    if not active then
        cb({ ok = false })
        return
    end
    working = nil
    selected = 0
    dirty = false
    pushState()
    cb({ ok = true })
end)

--- "Place another actor" and "Move this actor" both hand the world back; the
--- flag decides which one the next E means.
RegisterNUICallback('editorPlaceMode', function(data, cb)
    if not active or not working then
        cb({ ok = false })
        return
    end

    local replace = (type(data) == 'table' and data.replace == true) or false

    if replace then
        -- Reposition an existing actor: straight to placement if it has an
        -- emote, otherwise it needs one before there is anything to position.
        if working.marks[selected] and working.marks[selected].emote then
            setPhase('placing')
            startPositioning(selected)
        else
            SendNUIMessage({ action = 'editorOpenPicker' })
        end
        cb({ ok = true })
        return
    end

    if #working.marks >= markLimit() then
        MBT.Notification({ description = MBT.Locale['editor_limit'] or 'Actor limit reached' })
        cb({ ok = false })
        return
    end

    -- The actor is created empty and immediately sent to the picker: choosing
    -- the emote is the first real decision, and the pose that follows is the
    -- only thing worth looking at. There is no intermediate ring to position.
    working.marks[#working.marks + 1] = {
        x = 0.0, y = 0.0, z = 0.0,
        heading  = 0.0,
        emote    = nil,
        category = 'Emotes',
        role     = nil,
    }
    selected = #working.marks
    dirty = true
    pushState()

    SendNUIMessage({ action = 'editorOpenPicker' })
    cb({ ok = true })
end)

RegisterNUICallback('editorSetField', function(data, cb)
    if not active or not working then
        cb({ ok = false })
        return
    end

    if data.field == 'label' and type(data.value) == 'string' then
        working.label = data.value
        dirty = true
    elseif data.field == 'kind' then
        -- Only meaningful with several actors: one is always a spot.
        working.type = (data.value == 'scene') and 'scene' or 'seats'
        dirty = true
        pushState()
    elseif data.field == 'radius' then
        working.radius = tonumber(data.value) or working.radius
        dirty = true
    elseif data.field == 'role' then
        local m = working.marks[tonumber(data.index) or selected]
        if m then
            m.role = (type(data.value) == 'string' and data.value ~= '') and data.value or nil
            dirty = true
        end
    end

    cb({ ok = true })
end)

RegisterNUICallback('editorSelectMark', function(data, cb)
    local index = tonumber(data.index)
    if active and working and working.marks[index] then
        selected = index
        pushState()
    end
    cb({ ok = true })
end)

RegisterNUICallback('editorRemoveMark', function(data, cb)
    local index = type(data) == 'table' and tonumber(data.index)
    if index and active and working and working.marks[index] then
        selected = index
    end
    removeSelected()
    cb({ ok = true })
end)

-- "Reposition this actor": hand it back to rpemotes' placement, which is also
-- where you look at the pose. There is no separate preview any more — placing
-- and previewing were always the same act.
RegisterNUICallback('editorPreview', function(data, cb)
    local index = type(data) == 'table' and tonumber(data.index)
    if index and active and working and working.marks[index] then
        selected = index
    end

    if active and working and working.marks[selected] then
        setPhase('placing')
        startPositioning(selected)
    end
    cb({ ok = true })
end)

RegisterNUICallback('editorSave', function(_, cb)
    if not active or not working then
        cb({ ok = false })
        return
    end

    -- The server validates all of this again. These checks only spare the
    -- admin a round trip for the mistakes that are easy to make.
    if not working.label or working.label == '' then
        cb({ ok = false, error = MBT.Locale['editor_err_name'] or 'Give the scene a name' })
        return
    end

    if #working.marks == 0 then
        cb({ ok = false, error = MBT.Locale['editor_err_empty'] or 'Place at least one actor' })
        return
    end

    for i = 1, #working.marks do
        if not working.marks[i].emote then
            cb({
                ok = false,
                error = (MBT.Locale['editor_err_emote'] or 'Actor %s has no emote'):format(i),
            })
            return
        end
    end

    TriggerServerEvent('mbt_emote_menu:editor:save', working)
    cb({ ok = true })
end)

RegisterNUICallback('editorDelete', function(data, cb)
    if not unlocked then
        cb({ ok = false })
        return
    end
    TriggerServerEvent('mbt_emote_menu:editor:delete', data.id)
    cb({ ok = true })
end)

--- Put the admin in front of a scene, looking at it.
---
--- The id is all the panel gets to choose. Coordinates come from our mirror of
--- the server list, so a modified panel cannot name a destination of its own.
RegisterNUICallback('editorGoto', function(data, cb)
    if not unlocked or not active then
        cb({ ok = false })
        return
    end

    local scene = type(data) == 'table' and type(data.id) == 'string' and known[data.id]
    local m = scene and scene.marks and scene.marks[1]

    if not m or type(m.x) ~= 'number' or type(m.y) ~= 'number' or type(m.z) ~= 'number' then
        MBT.Notification({ description = MBT.Locale['editor_goto_missing'] or 'That scene is gone' })
        cb({ ok = false })
        return
    end

    local ped = PlayerPedId()
    local veh = GetVehiclePedIsIn(ped, false)
    -- Teleport the vehicle when the admin is driving it; teleporting only the
    -- ped out of a moving car is how you end up under the map.
    local entity = (veh ~= 0 and GetPedInVehicleSeat(veh, -1) == ped) and veh or ped

    -- Stand off the mark and face it. Landing exactly on it would put the
    -- admin inside the pose they came to look at.
    local rad = math.rad(m.heading or 0.0)
    local x = m.x - math.sin(rad) * GOTO_BACK
    local y = m.y + math.cos(rad) * GOTO_BACK

    RequestCollisionAtCoord(x, y, m.z)
    SetEntityCoords(entity, x, y, m.z, false, false, false, false)
    SetEntityHeading(entity, ((m.heading or 0.0) + 180.0) % 360.0)

    CreateThread(function()
        -- Falling through an unstreamed world is the classic teleport bug.
        -- Hold still until the map underneath exists, and give up after three
        -- seconds rather than leave the admin frozen.
        local deadline = GetGameTimer() + 3000
        FreezeEntityPosition(entity, true)

        while GetGameTimer() < deadline and not HasCollisionLoadedAroundEntity(entity) do
            RequestCollisionAtCoord(x, y, m.z)
            Wait(0)
        end

        FreezeEntityPosition(entity, false)
    end)

    Utils.MbtDebugger(('Editor: went to %s'):format(scene.label or scene.id))
    cb({ ok = true })
end)

RegisterNUICallback('editorExit', function(_, cb)
    -- The inspector arms a confirm when there are unsaved changes; this is the
    -- backstop so no path can drop the work silently.
    exit()
    cb({ ok = true })
end)

-------------------------------------------------------------------------------
-- [ SERVER REPLIES ] --
-------------------------------------------------------------------------------

RegisterNetEvent('mbt_emote_menu:receiveAdminInfo', function(info)
    -- The editor only ever unlocks from a server reply; no client-side path
    -- sets this true.
    unlocked = type(info) == 'table' and info.editor == true
end)

-- /mbt_emote_menu. The server checked the ACE before sending this, so it is an
-- authorisation in its own right: an admin who never opened the menu has no
-- adminInfo yet and should still get the editor.
RegisterNetEvent('mbt_emote_menu:editor:openCommand', function()
    unlocked = true
    if active then return end
    enter(nil)
end)

RegisterNetEvent('mbt_emote_menu:scenes:sync', function(list)
    known = {}
    if type(list) ~= 'table' then return end

    for _, scene in ipairs(list) do
        if type(scene) == 'table' and type(scene.id) == 'string' then
            known[scene.id] = scene
        end
    end

    if not scenesModuleActive then
        SendNUIMessage({ action = 'scenesList', scenes = list })
    end
end)

RegisterNetEvent('mbt_emote_menu:adminDenied', function()
    MBT.Notification({ description = MBT.Locale['admin_no_perm'] or 'You are not allowed to do that' })
end)

RegisterNetEvent('mbt_emote_menu:editor:result', function(ok, detail, kind)
    -- Deleting is done FROM the hub, so it ends with you back in the hub. The
    -- list refreshes itself off the broadcast that follows.
    if kind == 'delete' then
        MBT.Notification({
            description = ok
                and (MBT.Locale['editor_deleted'] or 'Scene deleted')
                or ((MBT.Locale['editor_delete_failed'] or 'Delete rejected') ..
                    (detail and (': ' .. tostring(detail)) or '')),
        })
        return
    end

    if ok then
        MBT.Notification({ description = MBT.Locale['editor_saved'] or 'Scene saved' })
        exit()
    else
        MBT.Notification({
            description = (MBT.Locale['editor_save_failed'] or 'Save rejected') ..
                (detail and (': ' .. tostring(detail)) or ''),
        })
    end
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

-- While the hub is listing scenes, it shows how far each one is, which needs
-- to know where the admin is standing. A walking pace is enough -- this is a
-- distance in metres, not a crosshair -- and it stops the moment a scene is
-- opened, because inside one the number means nothing.
CreateThread(function()
    local pushing = false

    while true do
        if active and phase == 'review' and not working then
            local c = GetEntityCoords(PlayerPedId())
            SendNUIMessage({ action = 'editorPos', x = c.x, y = c.y, z = c.z })
            pushing = true
            Wait(POS_PUSH_MS)
        else
            -- Clear it rather than leave the last position behind: a stale one
            -- would sort the list by where the admin used to be.
            if pushing then
                SendNUIMessage({ action = 'editorPos' })
                pushing = false
            end
            Wait(400)
        end
    end
end)

-- Panic exit. IsRawKeyDown reads the keyboard below NUI focus (the same native
-- openjoin uses for its hotkey), so this still works when the panel itself is
-- unresponsive. An editor you can enter but not leave is worse than one that
-- does nothing.
CreateThread(function()
    local F9 = Utils.KeyCode('F9')
    local wasDown = false

    while true do
        Wait(100)
        if active and F9 then
            local isDown = IsRawKeyDown(F9)
            if isDown and not wasDown then
                exit()
                MBT.Notification({ description = MBT.Locale['editor_force_exit'] or 'Scene editor closed' })
            end
            wasDown = isDown
        else
            wasDown = false
        end
    end
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName == GetCurrentResourceName() then
        Core.DestroyPosePed(posePed)
        if active then SetNuiFocus(false, false) end
    end
end)
