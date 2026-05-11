MBT = MBT or {}

-------------------------------------------------------------------------------
-- [ SECTION 1: GLOBAL SETTINGS ] --
-------------------------------------------------------------------------------

MBT.Language =
'en'              -- Options: 'en', 'it', 'es', 'fr', 'de', 'pt' (Loads from locales/*.lua, add your language in locales folder)
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

    AdultEmotes    = false, -- Include 18+ emotes (AdultAnimation) in catalog. Set true to show them.
    AbusableEmotes = false, -- Include abusable emotes (movement-exploit walks). Set true to show them.
}

-- Emote Wheel: hold-to-peek quick access (8 slots, no cursor needed)
MBT.EmoteWheel = {
    Key       = 'K', -- Hold this key to open the peek indicator
    Slots     = 8,   -- Number of wheel slots (max 8)
    RemoveKey = 'X', -- Press this key while wheel is open to remove emote from current slot
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

-------------------------------------------------------------------------------
-- [ SECTION 5: THEME ] --
-------------------------------------------------------------------------------

-- Override default theme colors. These are sent to the NUI at startup.
-- Hex values without '#'. Leave nil to use built-in MBT defaults.
MBT.Theme = {
    Accent     = '00fb8a', -- Green
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
