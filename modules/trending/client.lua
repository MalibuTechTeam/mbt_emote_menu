-------------------------------------------------------------------------------
-- [ TRENDING — CLIENT ] --
--
-- Reports the local player's emote plays to the server-wide trending
-- aggregator, and asks the server for the current top emote whenever the
-- menu opens / the catalog becomes ready.
--
-- Mirrors the OpenJoin client pattern: a Trending.MaybeReport(...) hook is
-- exposed and called from Core.PlayEmoteRaw. When the feature is disabled it
-- becomes a no-op so callers don't need their own guard.
-------------------------------------------------------------------------------

Trending = Trending or {}

if not MBT.Trending or MBT.Trending.Enabled == false then
    function Trending.MaybeReport(_, _, _) end
    function Trending.Request() end
    return
end

-- Discrete "plays" only. Walks and Expressions are continuous states a player
-- toggles into, not one-shot performances — counting them would let a single
-- toggled walkstyle dominate the trending board.
local COUNTED_CATEGORIES = {
    Emotes       = true,
    PropEmotes   = true,
    Dances       = true,
    Shared       = true,
    AnimalEmotes = true,
    Emojis       = true,
}

-------------------------------------------------------------------------------
-- [ OUTGOING REPORT ] --
-------------------------------------------------------------------------------

function Trending.MaybeReport(emoteName, emoteLabel, emoteCategory)
    if type(emoteName) ~= 'string' or emoteName == '' then return end
    if type(emoteCategory) ~= 'string' or not COUNTED_CATEGORIES[emoteCategory] then return end

    TriggerServerEvent(
        'mbt_emote_menu:server:emotePlayed',
        emoteName,
        emoteLabel or emoteName,
        emoteCategory
    )
end

-------------------------------------------------------------------------------
-- [ REQUEST + RECEIVE ] --
-------------------------------------------------------------------------------

function Trending.Request()
    TriggerServerEvent('mbt_emote_menu:server:requestTrending')
end

RegisterNetEvent('mbt_emote_menu:client:receiveTrending', function(payload)
    -- payload is { name, label, category, plays } or nil when nothing
    -- qualifies. The NUI handler treats a nil/empty data field as "no hero".
    SendNUIMessage({
        action = 'trending',
        data = payload or false,
    })
    if Utils and Utils.MbtDebugger then
        if type(payload) == 'table' and payload.name then
            Utils.MbtDebugger(('trending: received top = %s (%d plays)')
                :format(payload.name, payload.plays or 0))
        else
            Utils.MbtDebugger('trending: received — none qualifies')
        end
    end
end)
