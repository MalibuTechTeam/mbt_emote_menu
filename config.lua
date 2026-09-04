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
    -- Far enough to put a group in shot. Seven was chosen when the camera could
    -- only look at you, which made a longer arm pointless; now that the framing
    -- can slide (right-drag), the distance is what lets it contain the people
    -- it slid onto.
    MaxDistance      = 12.0, -- farthest (m)
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

    -- Key light. One photographic light placed relative to the CAMERA, so it
    -- keeps the same relationship to the shot however far the player orbits.
    -- Costs one native per frame inside the loop photo mode already runs, and
    -- nothing at all while photo mode is closed.
    Lighting = {
        Enabled          = true, -- false hides the Light tab entirely
        DefaultOn        = false,
        DefaultIntensity = 3.0,   -- 0.5 - 8.0
        DefaultWarmth    = 0.0,   -- -1.0 cool ... 0 daylight ... +1.0 tungsten
        DefaultKey       = 'front', -- 'front' | 'side' | 'rim'
        Range            = 5.0,   -- metres the light reaches
    },

    -- Hour and sky, for the photographer only.
    --
    -- Both natives are client-side: the sun moves and the sky changes for the
    -- person holding the camera and for nobody else, and everything is handed
    -- back when they close photo mode.
    --
    -- KNOWN LIMIT, worth reading before you promise this to anyone: almost
    -- every server runs a weather sync (vSync, cd_easytime, qb-weathersync...)
    -- that pushes its own state back every few seconds. We re-assert ours on a
    -- 1.5 s beat to stay on top of it, which works against the common ones but
    -- cannot be guaranteed against all of them. Set Enabled = false if your
    -- weather script fights it or if you would rather players did not.
    Environment = {
        Enabled = true, -- false hides the Scene tab entirely

        -- Sky presets. 'id' must be a real GTA weather type; 'label' is what
        -- the player reads. Order here is order on screen.
        Weathers = {
            { id = 'EXTRASUNNY', label = 'Clear'   },
            { id = 'CLOUDS',     label = 'Cloudy'  },
            { id = 'OVERCAST',   label = 'Grey'    },
            { id = 'FOGGY',      label = 'Fog'     },
            { id = 'RAIN',       label = 'Rain'    },
            { id = 'THUNDER',    label = 'Storm'   },
            { id = 'SNOWLIGHT',  label = 'Snow'    },
        },
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

-- Colours moved OUT of this file in 1.8.0. They now live in default.lua as the
-- shipped values, and an admin changes them in game from the shield menu --
-- server-wide, for everyone, without a restart.
--
-- One switch stays here, because it is a policy and not a colour: whether
-- players may pick their own accent from the curated presets.
MBT.Theme = MBT.Theme or {}
MBT.Theme.AllowAccentChange = false

-------------------------------------------------------------------------------
-- [ SECTION 6: MBT ECOSYSTEM INTEGRATION ] --
-------------------------------------------------------------------------------

-- Enable integration with other MBT scripts you have installed.
MBT.Ecosystem = {
    MetaClothes   = false, -- mbt_meta_clothes v2 installed
    WearableProps = false, -- mbt_wearable_props installed
}

-------------------------------------------------------------------------------
-- [ SECTION 7: ADMIN ACCESS ] --
-------------------------------------------------------------------------------

-- Everything in this section is gated behind one FiveM ACE permission.
--
-- Brand convention (patterns/admin-command-naming): the command that opens the
-- admin surface IS the resource name, and the permission derives from it as
-- 'command.mbt_emote_menu'. That ACE is auto-registered by FiveM and is already
-- covered by the wildcard most servers run (add_ace group.admin command allow),
-- so a normal setup needs NO extra server.cfg line.
--
-- Players without it never receive this data: the server simply does not answer
-- them, so there is nothing to hide client-side and nothing to leak.
MBT.Admin = {
    Command    = 'mbt_emote_menu', -- /mbt_emote_menu opens the scene editor
    Permission = nil,              -- nil -> 'command.' .. Command

    -- "Update available" notice, shown only to the players above, inside the
    -- menu's settings popover. The console line prints regardless.
    UpdateNotice = {
        Enabled    = true,
        Repository = 'MalibuTechTeam/mbt_emote_menu',
    },

    -- In-game scene editor: place marks in the world, assign an emote and a
    -- role to each, save. Scenes are stored in MySQL (table
    -- mbt_emote_menu_scenes, created automatically on first boot), so they
    -- survive script updates and live in your normal database backups.
    -- Requires oxmysql; without it the editor stays off and the rest of the
    -- menu is unaffected.
    Editor = {
        Enabled  = true,
        MaxMarks = 12,   -- per scene
        MaxScenes = 200, -- per server
    },
}

-- Scenes and spots authored with the in-game editor. The definitions live in
-- the database, not here: an owner places them in the world instead of typing
-- coordinates. This section only controls how they behave once placed.
MBT.VenueSpots = {
    Enabled = true,
    PollMs  = 750,  -- how often we check whether you walked into one
    Key     = 'E',  -- shown in the prompt; the control itself is E

    -- Seconds counted down before a multi-actor scene fires. Everyone is
    -- already standing on their mark by then, so this is bracing time, not a
    -- race start: too short and the shot begins before anyone has looked up.
    CountdownFrom = 5,

    -- Place the player exactly on the mark before the emote runs. This is the
    -- point of authoring a position: an emote that leans on a counter only
    -- looks right from the spot and angle it was placed at. Turn it off only
    -- if you would rather the emote played wherever the player is standing.
    SnapToMark = true,
}

-------------------------------------------------------------------------------
-- [ SECTION 8: JOB PERMISSIONS ] --
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
-- [ SECTION 9: NOTIFICATIONS ] --
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
