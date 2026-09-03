-- The server's accent: chosen by an admin in game, applied to everyone.
--
-- KVP and not a database row: it is one six-character string read once at
-- boot, and a query for that would cost more than it carries. The scenes are
-- in MySQL because they are rows; this is a setting.

local KVP_KEY = 'mbt_emote_menu:accent'

-- Captured BEFORE the stored choice is applied, so "reset" means default.lua
-- and not whatever was live a moment ago.
local FACTORY = (MBT.Theme and MBT.Theme.Accent) or '00e676'

-- nil = nobody has chosen; the factory value stands.
local chosen = nil

local lastThemeRequest = {}
local THROTTLE_MS = 2000

local function throttled(src)
    local now = GetGameTimer()
    local last = lastThemeRequest[src]
    if last and (now - last) < THROTTLE_MS then return true end
    lastThemeRequest[src] = now
    return false
end

AddEventHandler('playerDropped', function()
    lastThemeRequest[source] = nil
end)

---Six hex characters, no '#'. The ACE says who may write, never what.
---@param v any
---@return string|nil normalised lowercase hex, or nil when it is not one
local function validHex(v)
    if type(v) ~= 'string' then return nil end
    local hex = v:gsub('^#', ''):lower()
    if #hex ~= 6 or hex:match('^%x%x%x%x%x%x$') ~= hex then return nil end
    return hex
end

local function effective()
    return chosen or FACTORY
end

local function broadcast()
    TriggerClientEvent('mbt_emote_menu:theme:sync', -1, effective())
end

CreateThread(function()
    local raw = GetResourceKvpString(KVP_KEY)
    local hex = validHex(raw)
    if hex then
        chosen = hex
    elseif raw and raw ~= '' then
        -- A key we cannot parse is not a reason to refuse to start: the
        -- factory value is always a working answer.
        print('^3[MalibuTech] Stored accent is not a valid hex, ignoring it.^0')
    end
end)

-- Public: every player needs the colour, not just admins. Nothing here leaks
-- anything an admin knows -- it is the colour they can already see.
RegisterNetEvent('mbt_emote_menu:theme:request', function()
    local src = source
    if not src or src <= 0 then return end
    if throttled(src) then return end
    TriggerClientEvent('mbt_emote_menu:theme:sync', src, effective())
end)

RegisterNetEvent('mbt_emote_menu:theme:set', function(hex)
    local src = source
    if not src or src <= 0 then return end
    if not IsMbtEmoteAdmin(src) then return end

    local clean = validHex(hex)
    if not clean then return end
    if clean == chosen then return end

    chosen = clean
    SetResourceKvp(KVP_KEY, clean)
    broadcast()
end)

RegisterNetEvent('mbt_emote_menu:theme:reset', function()
    local src = source
    if not src or src <= 0 then return end
    if not IsMbtEmoteAdmin(src) then return end
    if chosen == nil then return end

    chosen = nil
    -- Deleted, never overwritten with FACTORY: a future release that ships a
    -- different colour has to be able to reach a server that reset once.
    DeleteResourceKvp(KVP_KEY)
    broadcast()
end)
