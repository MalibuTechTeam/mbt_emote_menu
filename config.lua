MBT = MBT or {}

-------------------------------------------------------------------------------
-- [ SECTION 1: GLOBAL SETTINGS ] --
-------------------------------------------------------------------------------

MBT.Language = 'en'              -- Options: 'en', 'it', 'es', 'fr', 'de', 'pt' (Loads from locales/*.lua, add your language in locales folder)
MBT.Debug = false -- Enable debug logs in console

-- Auto-detect rpemotes resource name. Supports:
-- 'rpemotes-reborn' (official), 'rpemotes' (legacy),   'rp-emotes' (old forks)
-- Set to nil for auto-detection, or force a specific name.
MBT.RpemotesResource = nil

-------------------------------------------------------------------------------
-- [ SECTION 2: MENU SETTINGS ] --
-------------------------------------------------------------------------------

MBT.Menu = {
    Keybind            = 'F4',         -- Key to open/close the MBT emote menu (same as rpemotes default)
    Command            = 'mbt_emotes', -- Chat command alternative (/mbt_emotes)
    Layout             = 'cinematic',  -- Menu UI Layout: 'default' or 'cinematic'
    Position           = 'right',      -- Menu panel position: 'left' or 'right'
    CloseOnPlay        = true,         -- Close menu automatically when an emote starts playing
    RememberState      = true,         -- Remember scroll position, tab, and filters when menu closes after playing an emote (resets on ESC/X)
    Watermark          = true,         -- Show 'MBT' watermark in the UI

    -- Disable rpemotes' native NativeUI menu when this resource is active.
    -- If true, pressing rpemotes' own menu key (F4 by default) will open MBT's menu instead.
    OverrideNativeMenu = true,
}

-------------------------------------------------------------------------------
-- [ SECTION 3: FEATURES ] --
-------------------------------------------------------------------------------

MBT.Features = {
    Favorites    = true, -- Enable favorites system (stored in KVP)
    RecentEmotes = true, -- Track and display recently played emotes
    MaxRecent    = 12,   -- Maximum number of recent emotes to remember
    QuickBind    = true, -- Enable drag-to-bind keybind assignment from UI
    SharedPopup  = true, -- Show inline popup for shared emote invitations
    PreviewPed   = true, -- Show animated ped preview when hovering emotes
    EmoteWheel   = true, -- Hold-to-peek emote wheel (hold key + scroll to pick, release to play)

    -- "Place in world" button on emote cards. Triggers rpemotes-reborn's placement
    -- flow (preview ped + WASD positioning) for the selected emote. Auto-detects
    -- the export at boot — silently disabled if rpemotes-reborn is older than the
    -- version that exposes StartNewPlacement / GetPlacementState.
    EmotePlacement = true,

    -- Group Sync "Open Join": when a player plays an emote, every player in
    -- radius sees a small anonymous pill at the bottom of the screen ("Join:
    -- <emote> [Y]") and can press the key to play the same emote. Best for
    -- ambient, "join the action" feel — never reveals who started the emote.
    -- See the MBT.OpenJoin block below for tuning.
    OpenJoin = true,

    -- "What's that emote?" — passive discovery. When you walk within range
    -- of another emoting player, a small bubble appears ABOVE THEIR HEAD
    -- with the emote name and a hotkey to copy it. Identifies WHO is doing
    -- it, unlike Open Join which is anonymous.
    --
    -- Reads the same state bag Open Join publishes, so it covers the same
    -- emote categories. Open Join (when enabled) takes visual precedence —
    -- the WhatsThat bubble is auto-hidden while the Open Join pill is
    -- showing the same emote, so there's no duplicate prompt.
    --
    -- Performance note: this feature runs a 100ms discovery scan + a
    -- per-frame screen-position update. On a 64-player server with
    -- ~30 players streamed, that's roughly 300 distance/state-bag reads
    -- per second per client — still negligible (< 0.1ms tick cost), but
    -- if you're stacking many heavy scripts you may want to disable it.
    --
    -- Off by default: Open Join already covers the same "join nearby
    -- emote" action; enabling this turns it into the more discoverable,
    -- per-player variant. Turn ON if you want both visual modes.
    WhatsThat = false,

    AdultEmotes    = false, -- Include 18+ emotes (AdultAnimation) in catalog. Set true to show them.
    AbusableEmotes = false, -- Include abusable emotes (movement-exploit walks). Set true to show them.
}

-- Client-side anti-spam guard on emote playback. Stops accidental double
-- clicks and prevents a buggy/malicious client from machine-gunning the
-- rpemotes engine (and our OpenJoin announce pipeline) with consecutive
-- plays. The cooldown only affects the LOCAL player — it doesn't impact
-- shared emotes received from other clients.
MBT.AntiSpam = {
    Enabled    = true,
    CooldownMs = 250, -- minimum delay between consecutive emote plays; 250ms allows 4 emotes/s, plenty for normal use
}

-- Emote Wheel: hold-to-peek quick access (8 slots, no cursor needed)
MBT.EmoteWheel = {
    Key       = 'K', -- Hold this key to open the peek indicator
    Slots     = 8,   -- Number of wheel slots (max 8)
    RemoveKey = 'X', -- Press this key while wheel is open to remove emote from current slot
}

-- Open Join: anonymous proximity-based invitation. When a player plays an
-- emote in one of the broadcast categories, every player within Radius sees
-- a small pill ("Join: <emote> [F]") and can press the key to play the same
-- emote. The player who started the emote is never named in the prompt.
--
-- Individual players can opt out with /mbt_openjoin off (persisted via KVP).
MBT.OpenJoin = {
    Radius   = 8.0,                         -- meters around the initiator
    JoinKey  = 'Y',                         -- default keybind, rebindable via FiveM Settings → Key Bindings → search "Join nearby emote (MBT)"
    Position = 'bottom-center',             -- 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
    BroadcastCategories = { 'Emotes', 'Dances', 'PropEmotes' },

    -- Heartbeat: the initiator's client re-announces while the emote is still
    -- playing so late-arriving players in radius can also join, and the pill
    -- doesn't permanently disappear after the first fade-out.
    HeartbeatMs        = 4000,              -- re-announce interval (set < PopupTimeoutMs for continuous visibility)
    AnnounceCooldownMs = 3000,              -- server-side throttle per initiator (must be < HeartbeatMs)
    PopupTimeoutMs     = 6000,              -- auto-dismiss after this many ms (set > HeartbeatMs for overlap)

    -- Safety cap for crowded zones: even if many players are within radius,
    -- only the N closest ones receive the invitation. Prevents a 100-dancer
    -- nightclub from generating exponential broadcast spam. Set to 0 or nil
    -- to disable the cap. 30 is comfortable for most large-server scenarios.
    MaxRecipients      = 30,
}

-- What's That Emote? — passive ambient discovery. A bubble floats above the
-- nearest emoting player within MaxDistance with the emote label and a
-- hotkey hint. One key press copies the emote on the local player.
MBT.WhatsThat = {
    MaxDistance = 5.0,                      -- meters (closest emoting player wins)
    Key         = 'G',                      -- default keybind, rebindable via FiveM Settings → Key Bindings
    ScanMs      = 100,                      -- state-bag / distance discovery interval (heavy work, low frequency)
    -- Screen-position tracking always runs every frame so the bubble follows
    -- the player's head smoothly even when the camera rotates fast.
}

-- Nearby Section — when at least one player is within Radius, the menu
-- surfaces a dedicated "Nearby" row above the categories with shared/duo
-- emotes ready to launch (handshakes, hugs, fight poses, etc.).
-- Solves the discoverability problem: most players never realise shared
-- emotes exist because they're buried in the Shared category.
--
-- Default 3m matches rpemotes-reborn's own server-side distance check on
-- shared emote requests, so anything the ribbon offers is actually
-- launchable — no "they're too far" friction.
MBT.SharedNearby = {
    Enabled = true,
    Radius  = 3.0,    -- meters
    PollMs  = 1000,   -- proximity check interval (low frequency — UI ribbon, not a tracker)
}

-- Trending: server-wide "Trending this week" hero. The server keeps a
-- rolling window of daily play-count buckets (one per day) and surfaces the
-- single top-scoring emote in the menu's hero card. Counts are aggregated
-- across all players on the server, persisted to KVP so they survive
-- restarts, and only the emote name + label + category + score are exposed
-- to clients — never per-player play history.
MBT.Trending = {
    Enabled             = true,  -- master toggle for the trending pipeline + hero card
    WindowDays          = 7,     -- rolling window length in days (score = sum of buckets)
    MinPlays            = 10,    -- minimum window score for an emote to qualify as "trending"
    SaveIntervalMinutes = 10,    -- how often the in-memory state is flushed to KVP
}

-------------------------------------------------------------------------------
-- [ SECTION 4: CATEGORIES ] --
-------------------------------------------------------------------------------

-- Customize category display order and visibility in the menu.
-- 'icon' values are Lucide icon names (used by the React UI).
-- Set 'visible' to false to hide a category from the menu.
--
-- NOTE: 'type' values must match rpemotes-reborn's internal categories — the
-- catalog comes from rpemotes, so a 'type' that does not exist there will
-- produce an empty pill. 'localeKey' (optional) is the translation key in
-- locales/*.lua; falls back to 'label' if missing/unresolved.
MBT.Categories = {
    { type = 'Emotes',       label = 'Emotes',      icon = 'smile',          visible = true, localeKey = 'cat_emotes' },
    { type = 'PropEmotes',   label = 'Props',       icon = 'package',        visible = true, localeKey = 'cat_props' },
    { type = 'Dances',       label = 'Dances',      icon = 'music',          visible = true, localeKey = 'cat_dances' },
    { type = 'Shared',       label = 'Shared',      icon = 'users',          visible = true, localeKey = 'cat_shared' },
    { type = 'Expressions',  label = 'Expressions', icon = 'drama',          visible = true, localeKey = 'cat_expressions' },
    { type = 'Walks',        label = 'Walk Styles', icon = 'footprints',     visible = true, localeKey = 'cat_walks' },
    { type = 'AnimalEmotes', label = 'Animals',     icon = 'dog',            visible = true, localeKey = 'cat_animals' },
    { type = 'Emojis',       label = 'Emojis',      icon = 'message-circle', visible = true, localeKey = 'cat_emojis' },
}

-- Banned emotes: list rpemotes-reborn emote names (case-insensitive) that
-- should never appear in the menu nor be broadcast via Open Join.
--
-- Note: this only filters our menu and our OpenJoin broadcast. It does NOT
-- block rpemotes' own `/e <name>` chat command — a player can still type the
-- banned emote name directly. For full enforcement you'd also need to
-- restrict the rpemotes ACE permission or block the command server-side.
MBT.BannedEmotes = {
    -- 'twerk',
    -- 'wank',
    -- 'finger',
    -- 'fuckyou',
}

-------------------------------------------------------------------------------
-- [ SECTION 5: THEME ] --
-------------------------------------------------------------------------------

-- Override default theme colors. These are sent to the NUI at startup.
-- Hex values without '#'. Leave nil to use built-in MBT defaults.
MBT.Theme = {
    Accent     = '00e676', -- Green
    Background = '0C0E14', -- Dark neutral background
    Card       = '141720', -- Card/panel background (neutral, no purple tint)
    Text       = 'E8E8EE', -- Primary text (slightly warm white)
    SubText    = '6B7280', -- Secondary text
    Border     = '1A1D26', -- Subtle border
}

-------------------------------------------------------------------------------
-- [ SECTION 6: MBT ECOSYSTEM INTEGRATION ] --
-------------------------------------------------------------------------------

-- If you have other MBT scripts, enable integration here.
-- The UI will show relevant info from these scripts when available.
MBT.Ecosystem = {
    MetaClothes   = false, -- true if mbt_meta_clothes v2 is installed
    WearableProps = false, -- true if mbt_wearable_props is installed
}

-------------------------------------------------------------------------------
-- [ SECTION 7: JOB PERMISSIONS ] --
-------------------------------------------------------------------------------

-- Restrict specific emotes to certain jobs. Players without the required
-- job will see the emote greyed out with a lock icon.
-- Format: ['emoteName'] = { 'job1', 'job2', ... }
-- An empty table or omitting an emote means it is available to everyone.
-- Job names must match your framework's job identifiers (case-sensitive).

MBT.JobPermissions = {
    Enabled = true, -- Master toggle for the job permission system

    -- Framework detection: 'auto' tries ESX → QBox → QBCore → standalone
    -- Force a specific framework: 'esx', 'qbox', 'qbcore', or 'standalone'
    Framework = 'auto',

    -- Example restrictions (uncomment / customize for your server):
    -- ['cop']       = { 'police', 'sheriff', 'fbi' },
    -- ['mechanic']  = { 'mechanic', 'bennys' },
    -- ['medic']     = { 'ambulance', 'doctor' },
    -- ['handcuff']  = { 'police', 'sheriff' },

    Emotes = {
        -- Add your job-restricted emotes here, e.g.:
        -- ['handcuff'] = { 'police', 'sheriff' },
    },
}

-------------------------------------------------------------------------------
-- [ SECTION 8: NOTIFICATIONS ] --
-------------------------------------------------------------------------------

MBT.Notification = function(data)
    -- Preset for ox_lib
    -- exports.ox_lib:notify({
    --     title = data.title or 'MBT Emotes',
    --     description = data.description,
    --     type = data.type or 'info',
    --     duration = data.duration or 4000
    -- })

    -- Default GTA Notification
    -- BeginTextCommandThefeedPost('STRING')
    -- AddTextComponentSubstringPlayerName(data.description or data.title or 'Notification')
    -- EndTextCommandThefeedPostTicker(false, true)

    -- Preset for ESX Standard
    -- ESX.ShowNotification(data.description or data.text)

    -- Preset for QBCore Standard
    -- QBCore.Functions.Notify(data.description or data.text, 'primary')

    -- Preset for QBox (qbx_core)
    -- exports.qbx_core:Notify(data.description or data.text, 'info', data.duration or 4000)
end
