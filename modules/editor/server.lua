-------------------------------------------------------------------------------
-- [ SCENE EDITOR — SERVER ] --
--
-- Owns the scene store: loads it at boot, validates every write, persists it
-- through modules/editor/database.lua and pushes the result to everyone.
--
-- Read is public and write is ACE gated, and that asymmetry is deliberate:
-- every player needs the scene list to see a spot prompt in the world, but
-- only an admin may change it. The ACE says *who* may write; the validation
-- below says *what* may be written. A trusted player is still an untrusted
-- source of coordinates, so both run.
--
-- Storage is MySQL, one row per scene (modules/editor/database.lua). It is not
-- a file: a resource folder is the wrong place for owner data, because hosts
-- that redeploy resources on restart would wipe it silently.
-------------------------------------------------------------------------------

local cfg = (MBT.Admin and MBT.Admin.Editor) or {}

local MAX_MARKS  = tonumber(cfg.MaxMarks) or 12
local MAX_SCENES = tonumber(cfg.MaxScenes) or 200
local MAX_LABEL  = 48
local MAX_ROLE   = 24
local MAX_COORD  = 20000.0 -- comfortably outside the playable map
local MIN_RADIUS = 0.5
local MAX_RADIUS = 15.0

local scenes = {}
local lastEditorWrite = {}
local WRITE_THROTTLE_MS = 500

-------------------------------------------------------------------------------
-- [ VALIDATION ] --
-------------------------------------------------------------------------------

local function isFiniteNumber(v)
    -- NaN is the only value that differs from itself; the comparisons catch
    -- both infinities. A NaN coordinate would draw a marker nowhere and poison
    -- every distance check that later reads it.
    return type(v) == 'number' and v == v and v > -math.huge and v < math.huge
end

local function cleanCoord(v)
    if not isFiniteNumber(v) then return nil end
    if v < -MAX_COORD or v > MAX_COORD then return nil end
    return v + 0.0
end

---Strips control characters and clamps length.
---@return string|nil
local function cleanText(v, maxLen)
    if type(v) ~= 'string' then return nil end
    local out = v:gsub('%c', '')
    out = out:gsub('^%s+', '')
    out = out:gsub('%s+$', '')
    if out == '' then return nil end
    if #out > maxLen then out = out:sub(1, maxLen) end
    return out
end

---Emote and category names only ever come from the catalog, so they are held
---to the character set rpemotes itself uses.
---@return string|nil
local function cleanIdent(v)
    if type(v) ~= 'string' then return nil end
    local out = v:gsub('[^%w_%-]', '')
    if out == '' or #out > 64 then return nil end
    return out
end

local function validateMark(raw)
    if type(raw) ~= 'table' then return nil end

    local x = cleanCoord(raw.x)
    local y = cleanCoord(raw.y)
    local z = cleanCoord(raw.z)
    if not x or not y or not z then return nil end

    local heading = raw.heading
    if not isFiniteNumber(heading) then heading = 0.0 end
    heading = (heading + 0.0) % 360.0

    local emote = cleanIdent(raw.emote)
    if not emote then return nil end

    return {
        x = x, y = y, z = z,
        heading  = heading,
        emote    = emote,
        category = cleanIdent(raw.category) or 'Emotes',
        label    = cleanText(raw.label, MAX_LABEL),
        role     = cleanText(raw.role, MAX_ROLE),
    }
end

---@return table|nil scene, string|nil err
local function validateScene(raw)
    if type(raw) ~= 'table' then return nil, 'not a table' end

    local label = cleanText(raw.label, MAX_LABEL)
    if not label then return nil, 'missing label' end
    if type(raw.marks) ~= 'table' then return nil, 'missing marks' end

    local marks = {}
    for i = 1, #raw.marks do
        if #marks >= MAX_MARKS then return nil, 'too many marks' end
        local mark = validateMark(raw.marks[i])
        if not mark then return nil, ('invalid mark #%d'):format(i) end
        marks[#marks + 1] = mark
    end
    if #marks == 0 then return nil, 'no valid marks' end

    local radius = raw.radius
    if not isFiniteNumber(radius) then radius = 2.5 end
    radius = math.max(MIN_RADIUS, math.min(MAX_RADIUS, radius + 0.0))

    -- One mark can only be a spot. With several, the author decides whether
    -- they are interchangeable seats or the distinct roles of a scene — the
    -- two behave nothing alike and cannot be inferred from the count.
    local kind = 'spot'
    if #marks > 1 then
        kind = (raw.type == 'scene') and 'scene' or 'seats'
    end

    return {
        id     = cleanIdent(raw.id),
        type   = kind,
        label  = label,
        marks  = marks,
        radius = radius,
    }
end

-------------------------------------------------------------------------------
-- [ PERSISTENCE ] --
-------------------------------------------------------------------------------

local function refresh()
    scenes = EditorDb.LoadAll()
    Utils.MbtDebugger(('Scene editor: %d scene(s) in the database'):format(#scenes))
end

local function broadcast(target)
    TriggerClientEvent('mbt_emote_menu:scenes:sync', target or -1, scenes)
end

local function indexOfId(id)
    for i = 1, #scenes do
        if scenes[i].id == id then return i end
    end
end

local function nextId()
    -- Derived from what is already stored, so it stays stable across restarts.
    local highest = 0
    for i = 1, #scenes do
        local n = tonumber(tostring(scenes[i].id or ''):match('(%d+)$') or '')
        if n and n > highest then highest = n end
    end
    return ('scene_%d'):format(highest + 1)
end

-------------------------------------------------------------------------------
-- [ ACCESS ] --
-------------------------------------------------------------------------------

local function isEditor(src)
    if cfg.Enabled == false then return false end
    -- No database, no editor: letting an admin author scenes that cannot be
    -- saved is worse than telling them the editor is off.
    if not EditorDb.SchemaReady then return false end
    -- One authority for "is this an admin", defined in core/server.lua, so the
    -- editor and the admin payload can never disagree about who qualifies.
    return IsMbtEmoteAdmin and IsMbtEmoteAdmin(src) or false
end

local function writeThrottled(src)
    local now = GetGameTimer()
    local last = lastEditorWrite[src]
    if last and (now - last) < WRITE_THROTTLE_MS then return true end
    lastEditorWrite[src] = now
    return false
end

AddEventHandler('playerDropped', function()
    lastEditorWrite[source] = nil
end)

-------------------------------------------------------------------------------
-- [ EVENTS ] --
-------------------------------------------------------------------------------

-- Public read: a spot is a world feature, every player needs to know it exists.
RegisterNetEvent('mbt_emote_menu:scenes:request', function()
    local src = source
    if not src or src <= 0 then return end
    -- On a clean database the CREATE TABLE has not landed when the first
    -- client asks. Wait for the real barrier rather than a hopeful delay.
    if not EditorDb.AwaitSchema() then return end
    broadcast(src)
end)

RegisterNetEvent('mbt_emote_menu:editor:save', function(payload)
    local src = source
    if not src or src <= 0 then return end
    if not isEditor(src) then return end
    if writeThrottled(src) then return end

    local scene, err = validateScene(payload)
    if not scene then
        TriggerClientEvent('mbt_emote_menu:editor:result', src, false, err, 'save')
        return
    end

    if not scene.id or not indexOfId(scene.id) then
        if #scenes >= MAX_SCENES then
            TriggerClientEvent('mbt_emote_menu:editor:result', src, false, 'scene limit reached', 'save')
            return
        end
        scene.id = scene.id or nextId()
    end

    if not EditorDb.Save(scene, GetPlayerIdentifier(src, 0)) then
        TriggerClientEvent('mbt_emote_menu:editor:result', src, false, 'database write failed', 'save')
        return
    end

    -- Re-read rather than patching the local copy: the database is the source
    -- of truth, and another admin may have changed something in between.
    refresh()

    TriggerClientEvent('mbt_emote_menu:editor:result', src, true, scene.id, 'save')
    broadcast()
end)

RegisterNetEvent('mbt_emote_menu:editor:delete', function(id)
    local src = source
    if not src or src <= 0 then return end
    if not isEditor(src) then return end
    if writeThrottled(src) then return end

    local cleanId = cleanIdent(id)
    if not cleanId then return end

    if not indexOfId(cleanId) then return end

    if not EditorDb.Delete(cleanId) then
        TriggerClientEvent('mbt_emote_menu:editor:result', src, false, 'database delete failed', 'delete')
        return
    end

    refresh()
    TriggerClientEvent('mbt_emote_menu:editor:result', src, true, nil, 'delete')
    broadcast()
end)

-- The validator is handed to the database module so a one-time import from the
-- old data/scenes.json goes through exactly the same checks as a live write.
EditorDb.Init(validateScene)

CreateThread(function()
    if EditorDb.AwaitSchema() then
        refresh()
        broadcast()
    end
end)
