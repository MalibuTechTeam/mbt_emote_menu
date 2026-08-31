-------------------------------------------------------------------------------
-- [ SCENE SESSIONS — SERVER ] --
--
-- Runs a multi-actor scene: invite, assign roles, wait for everyone to stand
-- on their mark, count down, fire.
--
-- This exists because modules/partner has no server side at all — it hands its
-- two-player case to rpemotes (ExecuteCommand('nearby ...') and
-- rpemotes:server:confirmEmote). Nothing there generalises to N players with
-- N different emotes, so the invite/ready/countdown flow is ours.
--
-- No synchronised clock is involved, and none is needed: the poses are static
-- holds, not beats. A countdown relayed from here lands within normal network
-- jitter, which for "everyone strikes a pose" is imperceptible.
-------------------------------------------------------------------------------

local sessions = {}          -- [hostSrc] = session
local playerSession = {}     -- [src] = hostSrc

local INVITE_TTL_MS   = 30000
local READY_TTL_MS    = 60000
local COUNTDOWN_FROM  = 3
local JOIN_RADIUS     = 30.0

-------------------------------------------------------------------------------
-- [ HELPERS ] --
-------------------------------------------------------------------------------

local function playerCoords(src)
    local ped = GetPlayerPed(src)
    if not ped or ped == 0 then return nil end
    return GetEntityCoords(ped)
end

local function withinScene(src, scene)
    local c = playerCoords(src)
    if not c then return false end
    local m = scene.marks[1]
    if not m then return false end
    local dx, dy, dz = c.x - m.x, c.y - m.y, c.z - m.z
    return (dx * dx + dy * dy + dz * dz) <= (JOIN_RADIUS * JOIN_RADIUS)
end

local function clearSession(hostSrc, reason)
    local session = sessions[hostSrc]
    if not session then return end

    for src in pairs(session.members) do
        playerSession[src] = nil
        TriggerClientEvent('mbt_emote_menu:scenes:ended', src, reason)
    end

    sessions[hostSrc] = nil
end

---Roles = marks the author drew. Players = people who accepted. Ready = people
---standing on their mark. Three different numbers that the old single counter
---blurred into one.
local function broadcastProgress(session)
    local players, ready = 0, 0
    for _ in pairs(session.assigned) do players = players + 1 end
    for _ in pairs(session.ready) do ready = ready + 1 end

    local pending = 0
    for src in pairs(session.members) do
        if not session.assigned[src] then pending = pending + 1 end
    end

    for member in pairs(session.members) do
        TriggerClientEvent('mbt_emote_menu:scenes:progress', member, {
            roles   = #session.scene.marks,
            players = players,
            ready   = ready,
            pending = pending,
            expiresAt = session.expiresAt,
        })
    end
end

local function everyoneReady(session)
    local any = false
    for src, mark in pairs(session.assigned) do
        any = true
        if not session.ready[src] then return false end
        if not mark then return false end
    end
    return any
end

local function startCountdown(hostSrc)
    local session = sessions[hostSrc]
    if not session or session.state ~= 'gathering' then return end
    session.state = 'countdown'

    -- Close the invitations that are still open. They were told about a scene
    -- that is now starting without them; counting them down and then playing
    -- nothing is the worst of both.
    for src in pairs(session.members) do
        if not session.assigned[src] then
            session.members[src] = nil
            playerSession[src] = nil
            TriggerClientEvent('mbt_emote_menu:scenes:ended', src, 'started-without-you')
        end
    end

    CreateThread(function()
        for n = COUNTDOWN_FROM, 1, -1 do
            local live = sessions[hostSrc]
            if not live or live.state ~= 'countdown' then return end

            for src in pairs(live.assigned) do
                TriggerClientEvent('mbt_emote_menu:scenes:countdown', src, n)
            end
            Wait(1000)
        end

        local live = sessions[hostSrc]
        if not live or live.state ~= 'countdown' then return end

        for src, markIndex in pairs(live.assigned) do
            local mark = live.scene.marks[markIndex]
            if mark then
                TriggerClientEvent('mbt_emote_menu:scenes:execute', src, mark.emote, mark.category)
            end
        end

        clearSession(hostSrc, 'done')
    end)
end

-------------------------------------------------------------------------------
-- [ EVENTS ] --
-------------------------------------------------------------------------------

-------------------------------------------------------------------------------
-- [ SEAT OCCUPANCY ] --
--
-- Who is sitting where. Server-side because it is shared: a client cannot see
-- whether someone across the bar already took the stool, and two players
-- clipping into the same chair is the visible failure.
--
-- A seat comes free three ways, and all three are needed. The pose ending and
-- the player walking off are reported by the client, because only it knows.
-- Disconnecting is reported by nobody, so the server has to notice — without
-- it a crash leaves the stool taken until the next restart.
-------------------------------------------------------------------------------

local occupied = {}     -- [sceneId] = { [markIndex] = src }
local seatOf = {}       -- [src] = { sceneId, markIndex }

local function broadcastOccupancy(sceneId)
    TriggerClientEvent('mbt_emote_menu:scenes:occupancy', -1, sceneId, occupied[sceneId] or {})
end

local function releaseSeat(src, silent)
    local seat = seatOf[src]
    if not seat then return end

    local marks = occupied[seat.sceneId]
    if marks and marks[seat.markIndex] == src then
        marks[seat.markIndex] = nil
    end
    seatOf[src] = nil

    if not silent then broadcastOccupancy(seat.sceneId) end
end

---Hands out the first free mark, or nothing when they are all taken.
RegisterNetEvent('mbt_emote_menu:scenes:claim', function(sceneId, markCount, preferred)
    local src = source
    if not src or src <= 0 then return end
    if type(sceneId) ~= 'string' or type(markCount) ~= 'number' then return end
    if markCount < 1 or markCount > 64 then return end

    -- Leaving one seat to take another is normal; holding two is not.
    releaseSeat(src, true)

    occupied[sceneId] = occupied[sceneId] or {}
    local marks = occupied[sceneId]

    ---@return boolean true when nobody is sitting on `i` any more
    local function isFree(i)
        local holder = marks[i]
        return holder == nil or GetPlayerName(holder) == nil
    end

    local function give(i)
        marks[i] = src
        seatOf[src] = { sceneId = sceneId, markIndex = i }
        TriggerClientEvent('mbt_emote_menu:scenes:claimed', src, sceneId, i)
        broadcastOccupancy(sceneId)
    end

    -- The client says which seat it walked up to. Honour it when it is free:
    -- taking the first free index instead is how everyone ends up on the same
    -- end of a bench, walking past the seat they were already standing at.
    preferred = tonumber(preferred)
    if preferred and preferred >= 1 and preferred <= markCount
        and preferred == math.floor(preferred) and isFree(preferred) then
        give(preferred)
        return
    end

    -- Someone got there first, or the client did not ask for one.
    for i = 1, markCount do
        if isFree(i) then
            give(i)
            return
        end
    end

    TriggerClientEvent('mbt_emote_menu:scenes:claimed', src, sceneId, nil)
end)

RegisterNetEvent('mbt_emote_menu:scenes:release', function()
    local src = source
    if src and src > 0 then releaseSeat(src) end
end)

RegisterNetEvent('mbt_emote_menu:scenes:occupancyRequest', function()
    local src = source
    if not src or src <= 0 then return end
    for sceneId, marks in pairs(occupied) do
        TriggerClientEvent('mbt_emote_menu:scenes:occupancy', src, sceneId, marks)
    end
end)

-- Heading replication.
--
-- SetEntityHeading on a ped that is playing an emote is local: the player who
-- set it sees the right facing and nobody else does. That makes an authored
-- heading worthless — a "lean on the counter" spot would read as leaning on
-- nothing to every observer, which is everyone except the person doing it.
--
-- A replicated state bag is how rpemotes solves the same problem
-- (client/Placement.lua:476-491). Ours is a separate key so the two never
-- fight over the same value.
RegisterNetEvent('mbt_emote_menu:syncHeading', function(heading)
    local src = source
    if not src or src <= 0 then return end
    if heading ~= nil and type(heading) ~= 'number' then return end
    Player(src).state:set('mbtEmoteHeading', heading, true)
end)

RegisterNetEvent('mbt_emote_menu:scenes:start', function(scene, targets)
    local src = source
    if not src or src <= 0 then return end
    if sessions[src] or playerSession[src] then return end

    -- The scene definition is echoed back by the client that already received
    -- it from the editor broadcast, so re-check the shape rather than the
    -- contents: a forged scene can only ever hurt the forger's own session,
    -- and every emote still goes through rpemotes' own execution path.
    if type(scene) ~= 'table' or type(scene.marks) ~= 'table' then return end
    if #scene.marks < 2 then return end
    if not withinScene(src, scene) then return end

    if type(targets) ~= 'table' then targets = {} end

    local session = {
        scene    = scene,
        host     = src,
        assigned = { [src] = 1 },
        ready    = {},
        members  = { [src] = true },
        offered  = {},
        state    = 'gathering',
        expiresAt = GetGameTimer() + READY_TTL_MS,
    }

    sessions[src] = session
    playerSession[src] = src

    local nextMark = 2
    for i = 1, #targets do
        local target = tonumber(targets[i])
        if target and target ~= src and not playerSession[target] and nextMark <= #scene.marks then
            if withinScene(target, scene) then
                session.members[target] = true
                playerSession[target] = src
                session.offered[target] = nextMark

                local mark = scene.marks[nextMark]
                TriggerClientEvent('mbt_emote_menu:scenes:invite', target, {
                    host      = src,
                    label     = scene.label,
                    role      = mark.role,
                    markIndex = nextMark,
                    mark      = mark,
                    timeoutMs = INVITE_TTL_MS,
                })
                nextMark = nextMark + 1
            end
        end
    end

    TriggerClientEvent('mbt_emote_menu:scenes:assigned', src, {
        markIndex = 1,
        mark      = scene.marks[1],
        role      = scene.marks[1].role,
        label     = scene.label,
        host      = true,
    })

    broadcastProgress(session)

    SetTimeout(READY_TTL_MS + 500, function()
        if sessions[src] and sessions[src].state ~= 'countdown' then
            clearSession(src, 'timeout')
        end
    end)
end)

RegisterNetEvent('mbt_emote_menu:scenes:accept', function()
    local src = source
    local hostSrc = playerSession[src]
    local session = hostSrc and sessions[hostSrc]
    if not session or session.state ~= 'gathering' then return end
    if session.assigned[src] then return end

    local function markFree(i)
        for _, taken in pairs(session.assigned) do
            if taken == i then return false end
        end
        return true
    end

    local function give(i)
        session.assigned[src] = i
        local mark = session.scene.marks[i]
        TriggerClientEvent('mbt_emote_menu:scenes:assigned', src, {
            markIndex = i,
            mark      = mark,
            role      = mark.role,
            label     = session.scene.label,
            host      = false,
        })
        broadcastProgress(session)
    end

    -- Honour the role the invitation advertised. Accepting a card that says
    -- "Bride" and being handed "Officiant" is a different scene from the one
    -- the player agreed to.
    local offered = session.offered[src]
    if offered and session.scene.marks[offered] and markFree(offered) then
        give(offered)
        return
    end

    -- Only if that role went to someone else: take the lowest free one, and
    -- say so rather than swapping silently.
    for i = 2, #session.scene.marks do
        if markFree(i) then
            TriggerClientEvent('mbt_emote_menu:scenes:reassigned', src)
            give(i)
            return
        end
    end

    -- Nothing left at all.
    TriggerClientEvent('mbt_emote_menu:scenes:ended', src, 'role-taken')
    session.members[src] = nil
    playerSession[src] = nil
end)

RegisterNetEvent('mbt_emote_menu:scenes:decline', function()
    local src = source
    local hostSrc = playerSession[src]
    local session = hostSrc and sessions[hostSrc]
    if not session then return end

    session.assigned[src] = nil
    session.ready[src] = nil
    session.members[src] = nil
    session.offered[src] = nil
    playerSession[src] = nil
    broadcastProgress(session)
end)

RegisterNetEvent('mbt_emote_menu:scenes:ready', function(isReady)
    local src = source
    local hostSrc = playerSession[src]
    local session = hostSrc and sessions[hostSrc]
    if not session or session.state ~= 'gathering' then return end
    if not session.assigned[src] then return end

    session.ready[src] = isReady and true or nil
    broadcastProgress(session)

    if everyoneReady(session) then
        startCountdown(hostSrc)
    end
end)

RegisterNetEvent('mbt_emote_menu:scenes:cancel', function()
    local src = source
    if sessions[src] then
        clearSession(src, 'cancelled')
    end
end)

AddEventHandler('playerDropped', function()
    local src = source
    releaseSeat(src)

    if sessions[src] then
        clearSession(src, 'host-left')
        return
    end

    local hostSrc = playerSession[src]
    local session = hostSrc and sessions[hostSrc]
    if session then
        session.assigned[src] = nil
        session.ready[src] = nil
        session.members[src] = nil
        session.offered[src] = nil
        playerSession[src] = nil
        broadcastProgress(session)
    end
end)
