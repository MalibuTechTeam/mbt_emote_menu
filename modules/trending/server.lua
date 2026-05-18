-------------------------------------------------------------------------------
-- [ TRENDING — SERVER ] --
--
-- Server-wide "Trending this week" aggregation. Every client reports the
-- emotes it plays; the server keeps a rolling window of daily play-count
-- buckets and surfaces the single top-scoring emote to the menu hero.
--
-- Privacy: only aggregate counts are kept. We never store who played what —
-- a bucket is just { [emoteName] = count }. Clients only ever learn the
-- winning emote's name + label + category + total score.
--
-- Persistence: the whole state is json-encoded into resource KVP every
-- SaveIntervalMinutes (and on resource stop), so trending survives restarts.
-------------------------------------------------------------------------------

if not MBT.Trending or MBT.Trending.Enabled == false then return end

local KVP_KEY = 'mbt_trending'
local PLAY_COOLDOWN_MS = 3000 -- per-source throttle so a stuck key can't inflate counts
local REQUEST_THROTTLE_MS = 2000

local windowDays = math.max(1, tonumber(MBT.Trending.WindowDays) or 7)
local minPlays = math.max(1, tonumber(MBT.Trending.MinPlays) or 5)
local saveIntervalMs = math.max(1, tonumber(MBT.Trending.SaveIntervalMinutes) or 5) * 60000

-- buckets: array of { date = 'YYYY-MM-DD', counts = { [name] = n } }, oldest
-- first, newest last. Always exactly `windowDays` entries.
local buckets = {}
-- meta: cache of emote display info, { [name] = { label =, category = } }.
local meta = {}

local lastPlay = {}    -- [src] = GetGameTimer()
local lastRequest = {} -- [src] = GetGameTimer()

-------------------------------------------------------------------------------
-- [ DATE / BUCKET HELPERS ] --
-------------------------------------------------------------------------------

local function today()
    return os.date('%Y-%m-%d')
end

local function bannedSet()
    local set = {}
    for _, name in ipairs(MBT.BannedEmotes or {}) do
        if type(name) == 'string' then set[name:lower()] = true end
    end
    return set
end

-- Returns a {date,count} list spanning the last `windowDays` calendar days,
-- ending today. Existing bucket counts are preserved when their date still
-- falls inside the window.
local function buildWindow(existing)
    local byDate = {}
    for _, b in ipairs(existing or {}) do
        if type(b) == 'table' and type(b.date) == 'string' then
            byDate[b.date] = (type(b.counts) == 'table') and b.counts or {}
        end
    end

    local out = {}
    -- 86400 = seconds per day. os.time() at noon-ish avoids DST edge issues.
    local now = os.time()
    for i = windowDays - 1, 0, -1 do
        local date = os.date('%Y-%m-%d', now - i * 86400)
        out[#out + 1] = { date = date, counts = byDate[date] or {} }
    end
    return out
end

-------------------------------------------------------------------------------
-- [ PERSISTENCE ] --
-------------------------------------------------------------------------------

local function save()
    local ok, encoded = pcall(json.encode, { buckets = buckets, meta = meta })
    if ok and encoded then
        SetResourceKvp(KVP_KEY, encoded)
    end
end

local function load()
    local raw = GetResourceKvpString(KVP_KEY)
    if not raw or raw == '' then
        buckets = buildWindow(nil)
        return
    end

    local ok, decoded = pcall(json.decode, raw)
    if not ok or type(decoded) ~= 'table' then
        buckets = buildWindow(nil)
        return
    end

    -- buildWindow discards any persisted bucket whose date is outside the
    -- current window, so stale days simply fall off after a long downtime.
    buckets = buildWindow(decoded.buckets)
    if type(decoded.meta) == 'table' then
        meta = decoded.meta
    end
end

-------------------------------------------------------------------------------
-- [ ROTATION ] --
-------------------------------------------------------------------------------

-- Rotate buckets when the calendar day changes: drop the oldest, append a
-- fresh empty bucket for the new day. Checked once a minute.
CreateThread(function()
    while true do
        Wait(60000)
        local newest = buckets[#buckets]
        if not newest or newest.date ~= today() then
            buckets = buildWindow(buckets)
            Utils.MbtDebugger('trending: rotated buckets, newest day = ' .. today())
        end
    end
end)

-------------------------------------------------------------------------------
-- [ SCORING ] --
-------------------------------------------------------------------------------

-- Top-scoring emote with a window score >= minPlays, or nil.
local function computeTop()
    local totals = {}
    for _, b in ipairs(buckets) do
        for name, count in pairs(b.counts) do
            totals[name] = (totals[name] or 0) + count
        end
    end

    local bestName, bestScore = nil, 0
    for name, score in pairs(totals) do
        if score > bestScore then
            bestName, bestScore = name, score
        end
    end

    if not bestName or bestScore < minPlays then return nil end

    local info = meta[bestName] or {}
    return {
        name     = bestName,
        label    = info.label or bestName,
        category = info.category or 'Emotes',
        plays    = bestScore,
    }
end

-------------------------------------------------------------------------------
-- [ CLIENT EVENTS ] --
-------------------------------------------------------------------------------

RegisterNetEvent('mbt_emote_menu:server:emotePlayed', function(emoteName, emoteLabel, emoteCategory)
    local src = source
    if not src or src <= 0 then return end

    if type(emoteName) ~= 'string' or type(emoteLabel) ~= 'string' or type(emoteCategory) ~= 'string' then
        return
    end

    emoteName = emoteName:sub(1, 64)
    if emoteName == '' then return end

    if bannedSet()[emoteName:lower()] then return end

    -- Per-source cooldown: blocks a buggy/malicious client from machine-gunning
    -- the count up. Mirrors core/server.lua's throttle pattern.
    local now = GetGameTimer()
    local last = lastPlay[src]
    if last and (now - last) < PLAY_COOLDOWN_MS then return end
    lastPlay[src] = now

    -- Ensure the newest bucket is today's before we increment.
    local bucket = buckets[#buckets]
    if not bucket or bucket.date ~= today() then
        buckets = buildWindow(buckets)
        bucket = buckets[#buckets]
    end

    bucket.counts[emoteName] = (bucket.counts[emoteName] or 0) + 1
    meta[emoteName] = {
        label    = emoteLabel:sub(1, 64),
        category = emoteCategory:sub(1, 32),
    }
end)

RegisterNetEvent('mbt_emote_menu:server:requestTrending', function()
    local src = source
    if not src or src <= 0 then return end

    local now = GetGameTimer()
    local last = lastRequest[src]
    if last and (now - last) < REQUEST_THROTTLE_MS then return end
    lastRequest[src] = now

    TriggerClientEvent('mbt_emote_menu:client:receiveTrending', src, computeTop())
end)

-------------------------------------------------------------------------------
-- [ LIFECYCLE ] --
-------------------------------------------------------------------------------

AddEventHandler('playerDropped', function()
    local src = source
    if not src then return end
    lastPlay[src] = nil
    lastRequest[src] = nil
end)

CreateThread(function()
    while true do
        Wait(saveIntervalMs)
        save()
        Utils.MbtDebugger('trending: state flushed to KVP')
    end
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName == GetCurrentResourceName() then
        save()
    end
end)

load()
Utils.MbtDebugger(('trending: loaded — window=%dd, minPlays=%d'):format(windowDays, minPlays))
