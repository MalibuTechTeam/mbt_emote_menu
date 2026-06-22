MBT = MBT or {}

-------------------------------------------------------------------------------
-- [ SECTION 1: GLOBAL SETTINGS ] --
-------------------------------------------------------------------------------

MBT.Language = 'en'  -- 'en' | 'it' | 'es' | 'fr' | 'de' | 'pt' (see locales/)
MBT.Debug    = false -- Enable debug logs in the console

-- rpemotes resource name. Leave nil for auto-detection (rpemotes-reborn,
-- rpemotes, rp-emotes). Set a name only if you run a renamed fork.
MBT.RpemotesResource = nil

-------------------------------------------------------------------------------
-- [ SECTION 2: MENU SETTINGS ] --
-------------------------------------------------------------------------------

MBT.Menu = {
    Keybind            = 'F4',         -- Key to open/close the menu
    Command            = 'mbt_emotes', -- Chat command alternative (/mbt_emotes)
    Layout             = 'cinematic',  -- Default layout: 'default' or 'cinematic'
    AllowLayoutSwitch  = true,         -- Let players pick their layout in the menu settings (false = lock to Layout above)
    Position           = 'right',      -- Default panel side: 'left' or 'right' (players can change theirs in the settings)
    CloseOnPlay        = true,         -- Close the menu when an emote starts (players can change theirs in the settings)
    RememberState      = true,         -- Keep scroll/tab/filters between opens (resets on ESC/X)
    Watermark          = true,         -- Show the 'MBT' watermark
    OverrideNativeMenu = true,         -- Replace rpemotes' own NativeUI menu with this one
}

-------------------------------------------------------------------------------
-- [ SECTION 3: FEATURES ] --
-------------------------------------------------------------------------------

MBT.Features = {
    Favorites      = true,  -- Favorites system (saved per player)
    RecentEmotes   = true,  -- Track recently played emotes
    MaxRecent      = 12,    -- How many recent emotes to remember
    QuickBind      = true,  -- Drag-to-bind keybinds from the UI
    SharedPopup    = true,  -- Inline popup for shared emote invitations
    PreviewPed     = true,  -- Animated ped preview on hover
    EmoteWheel     = true,  -- Hold-to-peek emote wheel
    Personas       = true,  -- Saved loadouts: named Quick Bind + Wheel setups you switch between
    EmotePlacement = true,  -- "Place in world" button (needs a recent rpemotes-reborn)
    OpenJoin       = true,  -- Nearby players get a prompt to join your emote (see MBT.OpenJoin)
    WhatsThat      = false, -- Bubble over a nearby emoting player with their emote + copy hotkey
}

-- 18+ and movement-exploit ("abusable") emotes are controlled by rpemotes-reborn
-- itself (AdultEmotesDisabled / AbusableEmotesDisabled in its config.lua). The
-- menu shows whatever rpemotes exposes, so set those there.

-- Anti-spam guard: minimum delay between consecutive emote plays (local player).
MBT.AntiSpam = {
    Enabled    = true,
    CooldownMs = 250, -- 250ms allows up to 4 emotes/s
}

-- Personas: named loadouts bundling Quick Binds (NUM1-6) + Wheel slots.
MBT.Personas = {
    Max = 4, -- maximum number of personas a player can create
}

-- Emote Wheel: hold a key to open, pick a slot, release to play.
MBT.EmoteWheel = {
    Key                = 'K',      -- Hold to open the wheel
    Slots              = 8,        -- Number of slots (max 8)
    RemoveKey          = 'X',      -- Press while open to clear the current slot
    Mode               = 'radial', -- 'radial' = flick the mouse toward a slot · 'linear' = scroll through slots
    PointerSensitivity = 2.8,      -- radial only: how fast the flick pointer moves (higher = faster)
}

-- Open Join: when you play an emote, nearby players see an anonymous
-- "Join: <emote> [key]" pill and can press the key to join in.
-- Players can opt out with /mbt_openjoin off.
MBT.OpenJoin = {
    Radius   = 8.0,             -- meters around the initiator
    JoinKey  = 'Y',             -- join keybind (rebindable in FiveM Settings -> Key Bindings)
    Position = 'bottom-center', -- top/bottom + left/center/right
    BroadcastCategories = { 'Emotes', 'Dances', 'PropEmotes' }, -- categories that trigger a prompt

    HeartbeatMs        = 4000, -- re-announce interval while the emote plays
    AnnounceCooldownMs = 3000, -- per-player throttle (keep below HeartbeatMs)
    PopupTimeoutMs     = 6000, -- pill auto-dismiss time (keep above HeartbeatMs)
    MaxRecipients      = 30,   -- cap recipients in crowded zones (0/nil = no cap)
}

-- What's That Emote: bubble above the nearest emoting player.
MBT.WhatsThat = {
    MaxDistance = 5.0, -- meters
    Key         = 'G', -- copy keybind (rebindable in FiveM Settings -> Key Bindings)
    ScanMs      = 100, -- discovery scan interval (ms)
}

-- Nearby Section: a "Nearby" row in the menu with shared/duo emotes, shown
-- when another player is close enough to actually launch them with you.
MBT.SharedNearby = {
    Enabled = true,
    Radius  = 3.0,  -- meters
    PollMs  = 1000, -- proximity check interval (ms)
}

-- Trending: server-wide "Trending this week" hero card in the menu.
MBT.Trending = {
    Enabled             = true,
    WindowDays          = 7,  -- rolling window length in days
    MinPlays            = 10, -- minimum plays to qualify as trending
    SaveIntervalMinutes = 10, -- how often counts are saved
}

-- RP Text: /me and /do commands that float a styled pill above the player's
-- head, visible to nearby players. Chat commands only, not a menu feature.
MBT.RpText = {
    Enabled    = true, -- master toggle
    MaxLength  = 110,  -- max characters per message
    DurationMs = 6500, -- how long the pill stays up
    ThrottleMs = 1000, -- per-player cooldown between messages
    HeadOffset = 0.25, -- pill height above the head, in meters

    -- Channels. 'command' = chat command (rename or remove a row to avoid
    -- clashing with another /me system), 'range' = visibility in meters,
    -- 'label' = pill tag, 'color' = tag accent (hex, no '#').
    Channels = {
        { id = 'me', command = 'me', label = 'ME', range = 16.0, color = '00e676' },
        { id = 'do', command = 'do', label = 'DO', range = 16.0, color = '7fa8c9' },
        -- Uncomment to add a /med channel:
        -- { id = 'med', command = 'med', label = 'MED', range = 24.0, color = 'e0654f' },
    },
}

-- Photo Mode: a cinematic camera + framing tool opened from a button in the menu.
MBT.PhotoMode = {
    Enabled   = true,  -- master toggle (shows the camera button in the menu)
    Watermark = true,  -- show the small MBT watermark on the framing overlay

    -- Discord embed dressing (only used when Discord.Enabled below).
    -- LogoUrl: YOUR server logo, shown as the embed thumbnail (any public URL).
    --          Leave empty for none. The MBT mark always stays in the footer.
    -- Caption: short flavour line under the player name (empty = none).
    LogoUrl = '',
    Caption = 'Captured in Photo Mode',

    -- Camera feel. Sensitivities are how fast drag/scroll move the camera.
    OrbitSensitivity = 0.45, -- drag -> rotation speed
    ZoomSensitivity  = 0.30, -- scroll -> zoom speed
    MinDistance      = 0.7,  -- closest the camera can get (m)
    MaxDistance      = 7.0,  -- farthest (m)
    DofDefault       = true, -- start with depth-of-field (background blur) on

    -- Look presets, applied as GTA timecycle modifiers. 'timecycle' = nil means
    -- no filter (clean look). These names are tunable — swap them for any
    -- timecycle modifier you like; strength is 0.0-1.0.
    Filters = {
        { id = 'none',    label = 'None',      timecycle = nil },
        { id = 'cinema',  label = 'Cinematic', timecycle = 'cinema',      strength = 0.55 },
        { id = 'noir',    label = 'Noir',      timecycle = 'phone_cam11', strength = 1.0 },
        { id = 'warm',    label = 'Warm',      timecycle = 'phone_cam1',  strength = 1.0 },
        { id = 'vibrant', label = 'Vibrant',   timecycle = 'phone_cam2',  strength = 1.0 },
        { id = 'cool',    label = 'Cool',      timecycle = 'phone_cam4',  strength = 1.0 },
    },

    -- Send-to-Discord (optional). When Enabled and a WebhookUrl is set, a
    -- "Send to Discord" button appears and the shot posts to that channel.
    Discord = {
        Enabled    = false, -- owner turns this on
        WebhookUrl = '',    -- e.g. 'https://discord.com/api/webhooks/...'
        ThrottleMs = 30000, -- per-player cooldown between sends (anti-spam)
        -- How the post looks:
        --   'image' = just the screenshot, nothing else
        --   'embed' = the screenshot + a rich info card below (player, location, time, logo)
        Style      = 'embed',
    },
}

-------------------------------------------------------------------------------
-- [ SECTION 4: CATEGORIES ] --
-------------------------------------------------------------------------------

-- Category order and visibility in the menu. 'icon' = Lucide icon name,
-- 'visible' = false hides it, 'localeKey' = translation key (falls back to
-- 'label'). 'type' must match an rpemotes-reborn category — an unknown type
-- shows an empty pill.
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

-- Emote names hidden from the menu and from Open Join (case-insensitive).
-- Does not block rpemotes' own /e <name> command.
MBT.BannedEmotes = {
    -- 'twerk',
    -- 'wank',
    -- 'finger',
    -- 'fuckyou',
}

-------------------------------------------------------------------------------
-- [ SECTION 5: THEME ] --
-------------------------------------------------------------------------------

-- Menu colors, sent to the UI at startup. Hex without '#'.
MBT.Theme = {
    Accent            = '00e676', -- Brand green — the server's accent for everyone
    AllowAccentChange = false,    -- Keep the accent admin-controlled. Set true only if you want players to pick their own preset in the settings
    Background        = '0C0E14', -- Background
    Card              = '141720', -- Card / panel
    Text              = 'E8E8EE', -- Primary text
    SubText           = '6B7280', -- Secondary text
    Border            = '1A1D26', -- Borders
}

-------------------------------------------------------------------------------
-- [ SECTION 6: MBT ECOSYSTEM INTEGRATION ] --
-------------------------------------------------------------------------------

-- Enable integration with other MBT scripts you have installed.
MBT.Ecosystem = {
    MetaClothes   = false, -- mbt_meta_clothes v2 installed
    WearableProps = false, -- mbt_wearable_props installed
}

-------------------------------------------------------------------------------
-- [ SECTION 7: JOB PERMISSIONS ] --
-------------------------------------------------------------------------------

-- Restrict emotes to jobs — players without the job see them locked.
-- Format: ['emoteName'] = { 'job1', 'job2', ... }. Job names are
-- case-sensitive and must match your framework's identifiers.
MBT.JobPermissions = {
    Enabled   = true,   -- Master toggle
    Framework = 'auto', -- 'auto' | 'esx' | 'qbox' | 'qbcore' | 'standalone'

    Emotes = {
        -- ['handcuff'] = { 'police', 'sheriff' },
        -- ['medic']    = { 'ambulance', 'doctor' },
        -- ['mechanic'] = { 'mechanic', 'bennys' },
    },
}

-------------------------------------------------------------------------------
-- [ SECTION 8: NOTIFICATIONS ] --
-------------------------------------------------------------------------------

-- Notification handler. Uncomment the preset for your framework.
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
