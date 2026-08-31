# MBT Emote Menu — Premium NUI for rpemotes-reborn

<p align="center">
  <img src="https://img.shields.io/badge/FiveM-Ready-00e676?style=for-the-badge&logo=fivem&logoColor=white" alt="FiveM Ready" />
  <img src="https://img.shields.io/badge/Framework-ESX%20%7C%20QBox%20%7C%20QBCore%20%7C%20Standalone-blue?style=for-the-badge" alt="Framework" />
  <img src="https://img.shields.io/badge/Version-1.7.0-informational?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/Lua-5.4-purple?style=for-the-badge&logo=lua" alt="Lua 5.4" />
  <img src="https://img.shields.io/badge/React-TypeScript-61DAFB?style=for-the-badge&logo=react" alt="React + TS" />
  <img src="https://img.shields.io/badge/License-PolyForm%20Noncommercial%201.0.0-blue?style=for-the-badge" alt="PolyForm Noncommercial 1.0.0" />
</p>

<p align="center">
   <img src="https://raw.githubusercontent.com/MalibuTechTeam/mbt_emote_menu/main/.github/release-assets/hero.png" alt="MBT Emote Menu" />
</p>

**mbt_emote_menu** is a premium NUI overlay that completely replaces the default rpemotes-reborn menu with a modern, responsive, and feature-rich interface built with React + TypeScript. Designed for serious RP servers that demand a polished player experience.

> [!IMPORTANT]
> **Requires [rpemotes-reborn](https://github.com/alberttheprince/rpemotes-reborn) 2.1.2 or newer.** Since 1.7.0 the menu reads the emote catalog through rpemotes' `GetEmoteCatalog` export and plays every emote through `Execute`. There is no fallback: on an older rpemotes the menu stays disabled and prints a notice in the server console. Update rpemotes-reborn first, then this resource.

---

## Preview

| Default Layout | Cinematic Layout |
|:-:|:-:|
| ![Default](.github/release-assets/v1.4.0-standard.png) | ![Cinematic](.github/release-assets/v1.4.0-cinematic.png) |

---

## Features

### Core

- **1800+ emotes** organized by category with **silhouette icons** (Emotes, Props, Dances, Shared, Expressions, Walk Styles, Animals, Emojis) — the whole catalog is read live from rpemotes-reborn, so anything you add there shows up here with no extra work
- **Emoji reactions** powered by rpemotes-reborn's own emoji system (networked, distance-filtered and rate-limited by rpemotes)
- **Real-time search** with instant filtering across all emotes
- **Two layout modes** *(fully redesigned in 1.4)* — *Default* (a bounded, draggable floating panel) and *Cinematic* (an edge-docked, vignette-blended immersive overlay)
- **Left or right positioning** — configurable panel side
- **Draggable menu** — click and drag the header to reposition (default layout)
- **Fully responsive** — optimized breakpoints for 720p, 1080p, 1440p, 4K, and ultrawide monitors (21:9, 32:9)

### Organization

- **Favorites** system with import/export (JSON) and drag-to-reorder
- **Recent emotes** — automatically tracks your last played emotes
- **Top emotes** — ranked by your personal play count
- **Trending this week** *(new in 1.4)* — a server-wide hero spotlight showing the single most-played emote across everyone on the server, on a rolling 7-day window (aggregate counts only, no per-player tracking)
- **Custom lists** — create personal collections with custom names and icons
- **Category filters** — filter by Props, Shared, or browse All
- **Sorting & filter** — A-Z, Z-A, or by category, plus a one-click random emote

### Quick Access

- **Quick Bind** — assign emotes to NUM1-NUM6 keys via right-click drawer
- **Emote Wheel** — hold-to-peek selector (up to 8 slots, no cursor needed). *(new in 1.6)* A **radial / gesture mode** lets you flick the mouse toward a slot, weapon-wheel style, instead of scrolling — switchable via `MBT.EmoteWheel.Mode`
- **Personas / Loadouts** *(new in 1.6)* — save named loadouts (e.g. "Cop", "Party") bundling your Quick Binds and Wheel slots, and switch between them in one click. The active loadout auto-saves as you edit; a non-deletable "Default" is always there as a fallback
- **Keyboard navigation** — arrow keys + Enter to browse and play emotes
- **Smart search** *(new in 1.6)* — search now matches an emote's prop and animation too, not just its name, so "radio" finds the walkie-talkie emotes
- **Random emote** button for spontaneous fun

### Playback

- **Emote preview** — see the animation on your ped before committing (solo, invisible to others)
- **Place in world** — drop an emote at a precise spot via rpemotes-reborn's WASD placement flow, with a branded in-game HUD overlay
- **Playlist system** — queue multiple emotes in sequence with play/stop/clear controls
- **Shared emote popup** — inline accept/decline for sync emote invitations
- **Partner finder** — locate nearby players for shared animations
- **Remember State** — menu remembers your scroll position, tab, and filters after playing an emote (resets on ESC/X, configurable)

### Social & Discovery *(new in 1.3)*

- **Open Join** — when you start a broadcast-eligible emote (dances, shared, ...), every player within radius gets a small anonymous pill (`Join: <emote> [Y]`) and can press one key to play the same emote. Initiator is never named. Per-player opt-out via `/mbt_openjoin off`. Pill auto-dismisses when the initiator walks off or stops, no manual cleanup needed
- **What's That Emote?** — passive discovery. Walk near someone who is emoting and a floating bubble above their head shows the emote name with a hotkey hint — one press copies it onto your own character. Off by default (opt-in via `MBT.Features.WhatsThat`)
- **Nearby ribbon** — when at least one player is in proximity, a dedicated ribbon surfaces above the category pills with your most-played shared / duet emotes, ranked by personal play count. One-click to start a duet with the closest player via the Partner Finder
- **Premium motion language** — entry / exit animations on every social surface (slide + scale-up + accent ring pulse on arrival, snappy 150ms scale-down on exit), tail anchors on the floating bubble, smooth tab transitions via the View Transitions API. Respects `prefers-reduced-motion`

### Roleplay & Expression *(new in 1.5)*

- **RP Text** — `/me` and `/do` commands that float a styled pill above your head describing an action, visible to nearby players. Configurable channels with per-channel command name, range, and color. Server-side length clamp, sanitization, and throttle. Fully toggleable via `MBT.RpText.Enabled`

### Creator Tools *(new in 1.6)*

- **Photo Mode** — a cinematic camera opened from a button in the menu header. Drag to orbit the camera around your character, scroll to zoom, pick a look filter (cinematic, noir, warm, vibrant, cool), toggle depth-of-field and a rule-of-thirds framing grid, then capture — the MBT watermark rides on every shot. Optionally, the server owner can wire a Discord webhook so players send shots straight to a channel (per-player throttled; the upload runs client-side via `screenshot-basic`, so the webhook is handed to the uploading client — a write-only webhook, rotate it if abused). Uses `screenshot-basic` when present, falls back to "hide HUD + your own screenshot key" otherwise. Fully tunable via `MBT.PhotoMode`

### Scene Editor *(new in 1.8)*

- **Place scenes in the world, in-game** — walk to where an actor should stand, face the way they should face, press a key. That is the mark. No coordinates to copy out of a dev tool, no Lua to edit
- **Spots** — a single mark with an emote. Walk into it and a prompt offers the action: lean on the bar, address the podium, sit on the cell bunk. Your MLOs stop needing a board of `/e` commands taped to the wall
- **Multi-actor scenes** — several marks, each with its own emote *and its own role name*. A wedding, an interrogation, a mugshot, an awards photo. Nearby players get a role card, walk to their mark, ready up, and everyone hits their pose on a shared countdown
- **Built by you, not by us** — every server ends up with different scenes on different MLOs. This is not a fixed list of animations we picked
- **Survives updates** — scenes live in your database, not in the resource folder, so dropping a new version over the old one never touches your work
- **Admin only** — the editor is behind an ACE permission, server-side. Ordinary players see the scenes, never the editor

### Player Settings *(new in 1.7)*

- **Per-player settings popover** — a "..." menu in the header where each player configures the menu for themselves, and it is remembered: **layout** (standard or cinematic, lockable with `MBT.Menu.AllowLayoutSwitch`), **panel side**, **emote wheel mode** (radial or linear), **UI language**, **close on play**, and an **accent preset** (opt-in via `MBT.Theme.AllowAccentChange`)
- **Performance mode** — turns off ambient effects, vignette, entrance animation and hover preview for steadier FPS on weaker machines

### Reliability

- **Auto-close on death** — the menu closes itself if the player ped dies while it is open, avoiding stuck UI during the respawn / death camera
- **Version Check** — notifies server owners when a new release is available on GitHub: a line in the server console, plus an in-menu notice for admins only (see Admin Access). Regular players never see it
- **Resource Name Guard** — prevents the resource from starting if the folder is renamed (avoids silent breakage)

### Permissions & Security

- **Job-locked emotes** — restrict specific emotes to certain jobs (police, mechanic, medic, etc.)
- **ACE-gated admin surface** — the update notice, the owner diagnostics and the scene editor are unlocked by one FiveM ACE permission, checked server-side on every request. A player without it is answered with silence: the payload never leaves the server, so there is nothing client-side that has to be trusted to hide it
- **Banned emotes blacklist** — server owners can blocklist specific emote names server-side; both the catalog and the social broadcast layer filter them out
- **Per-source rate limiting** — every NetEvent the menu accepts is throttled per server ID (catalog request, job lookup, ecosystem status, social broadcast). Prevents a malicious or buggy client from flooding the server
- **Anti-spam cooldown** — client-side cooldown between back-to-back emote plays (`MBT.AntiSpam.CooldownMs`, default 250ms), with a separate cooldown on social broadcasts (default 3s per source)
- **Large-server safety** — Open Join announcements cap at the N closest recipients (`MBT.OpenJoin.MaxRecipients`, default 30) so a 1000-player server doesn't fan-out into a network storm at busy zones
- **Anti-spoofing** — server validates the initiator's replicated `mbtCurrentEmote` state bag against the announced emote before relaying, blocking clients that try to advertise an emote they aren't actually playing
- **Hardened roleplay text** — `/me` and `/do` messages are sanitized and length-clamped server-side, then rendered as escaped text (never raw HTML), so a player cannot inject markup onto other players' screens. The broadcast is distance-filtered and per-player throttled
- **Multi-framework support** — auto-detects ESX, QBox, QBCore, or standalone

### Ecosystem

- **MBT Meta Clothes** integration — detects and connects with `mbt_meta_clothes`
- **MBT Wearable Props** integration — detects and connects with `mbt_wearable_props`

### Localization

Built-in translations for **6 languages**: English, Italian, Spanish, French, German, Portuguese. Add your own by creating a new file in the `locales/` folder.

---

## Requirements

| Dependency | Version |
|---|---|
| [FiveM Server](https://fivem.net) | Build 6116+ |
| OneSync | Enabled |
| [rpemotes-reborn](https://github.com/alberttheprince/rpemotes-reborn) | **2.1.2+** (hard requirement) |

---

## Installation

1. Update [rpemotes-reborn](https://github.com/alberttheprince/rpemotes-reborn) to **2.1.2 or newer** first. The menu will not run on anything older.

2. Download the latest [release](https://github.com/MalibuTechTeam/mbt_emote_menu/releases) into your server's `resources` folder.

3. Add to your `server.cfg`:
   ```cfg
   ensure rpemotes-reborn
   ensure mbt_emote_menu
   ```
   > **Important:** `mbt_emote_menu` must start **after** `rpemotes-reborn`.

4. Configure `config.lua` to your liking (see Configuration below).

5. Restart your server or run `ensure mbt_emote_menu` in the live console.

---

## Configuration

All configuration is done in `config.lua`. Here's an overview of each section:

### General

```lua
MBT.Language = 'en'           -- 'en', 'it', 'es', 'fr', 'de', 'pt'
MBT.Debug = false             -- Enable debug logs
MBT.RpemotesResource = nil    -- Auto-detect or force: 'rpemotes-reborn', 'rpemotes', 'rp-emotes'
```

### Menu

```lua
MBT.Menu = {
    Keybind            = 'F4',
    Command            = 'mbt_emotes',
    Layout             = 'cinematic',    -- default layout: 'default' or 'cinematic'
    AllowLayoutSwitch  = true,           -- let players pick their layout in the settings (false = lock to Layout)
    Position           = 'right',        -- default panel side: 'left' or 'right' (players can change theirs)
    CloseOnPlay        = true,           -- players can change theirs in the settings
    RememberState      = true,           -- Remember scroll/tab/filters after playing (resets on ESC/X)
    Watermark          = true,
    OverrideNativeMenu = true,           -- Replaces rpemotes' NativeUI menu
}
```

### Features

```lua
MBT.Features = {
    Favorites      = true,
    RecentEmotes   = true,
    MaxRecent      = 12,
    QuickBind      = true,
    SharedPopup    = true,
    PreviewPed     = true,
    EmoteWheel     = true,
    Personas       = true,    -- saved loadouts: named Quick Bind + Wheel setups
    EmotePlacement = true,    -- "Place in world" button (needs rpemotes-reborn placement export)
    OpenJoin       = true,    -- anonymous proximity group emotes
    WhatsThat      = false,   -- peek-and-copy bubble above nearby emoting players (opt-in)
}
```

> 18+ and movement-exploit ("abusable") emotes are controlled by **rpemotes-reborn itself** (`AdultEmotesDisabled` / `AbusableEmotesDisabled` in its `config.lua`). The menu shows whatever rpemotes exposes, so set those there.

### Emote Wheel

```lua
MBT.EmoteWheel = {
    Key                = 'K',      -- Hold to open
    Slots              = 8,        -- Max 8 slots
    RemoveKey          = 'X',      -- Remove emote from current slot while wheel is open
    Mode               = 'radial', -- 'radial' = flick the mouse toward a slot · 'linear' = scroll
    PointerSensitivity = 2.8,      -- radial only: flick pointer speed
}
```

### Personas

```lua
MBT.Features.Personas = true   -- Saved loadouts (Quick Bind + Wheel) you switch between
MBT.Personas = {
    Max = 4,   -- Maximum number of loadouts a player can create
}
```

### Photo Mode

```lua
MBT.PhotoMode = {
    Enabled   = true,   -- Camera button in the menu header
    Watermark = true,   -- MBT watermark on the framing overlay
    DofDefault = true,  -- Start with depth-of-field on
    Filters = { --[[ look presets via timecycle modifiers ]] },
    Discord = {
        Enabled    = false, -- Owner opt-in: "Send to Discord" button
        WebhookUrl = '',    -- Handed to the uploading client (write-only webhook)
        ThrottleMs = 30000, -- Per-player cooldown between sends
    },
}
```

### Trending

```lua
MBT.Trending = {
    Enabled             = true,  -- Server-wide "Trending this week" hero card
    WindowDays          = 7,     -- Rolling window length, in days
    MinPlays            = 10,    -- Minimum window score for an emote to qualify
    SaveIntervalMinutes = 10,    -- How often counts are flushed to KVP
}
```

### RP Text

```lua
MBT.RpText = {
    Enabled    = true,   -- Master toggle
    MaxLength  = 110,    -- Max characters per message
    DurationMs = 6500,   -- How long the pill stays up
    ThrottleMs = 1000,   -- Per-player cooldown between messages
    HeadOffset = 0.25,   -- Pill height above the head, in meters
    Channels = {         -- Rename a command to avoid clashing with another /me system
        { id = 'me', command = 'me', label = 'ME', range = 16.0, color = '00e676' },
        { id = 'do', command = 'do', label = 'DO', range = 16.0, color = '7fa8c9' },
    },
}
```

### Theme

```lua
MBT.Theme = {
    Accent            = '00e676', -- Brand green — the server's accent for everyone
    AllowAccentChange = false,    -- true = players can pick their own accent preset in the settings
    Background        = '0C0E14',
    Card              = '141720',
    Text              = 'E8E8EE',
    SubText           = '6B7280',
    Border            = '1A1D26',
}
```

### Admin Access

The update notice, the owner diagnostics and the scene editor are all unlocked by
one ACE permission. Following the MBT convention, **the admin command is the
resource name** and the permission derives from it:

```
/mbt_emote_menu          opens the scene editor
command.mbt_emote_menu   the ACE it checks
```

FiveM registers that ACE automatically, and it is already covered by the wildcard
most servers run:

```cfg
add_ace group.admin command allow
add_principal identifier.license:XXXXXXXX group.admin
```

So on a typical server **no extra line is needed**. Only add one if your admin
group does not use the `command` wildcard:

```cfg
add_ace group.admin command.mbt_emote_menu allow
```

```lua
MBT.Admin = {
    Command    = 'mbt_emote_menu', -- /mbt_emote_menu opens the scene editor
    Permission = nil,              -- nil -> 'command.' .. Command

    UpdateNotice = {
        Enabled    = true,
        Repository = 'MalibuTechTeam/mbt_emote_menu',
    },

    Editor = {
        Enabled   = true,
        MaxMarks  = 12,   -- per scene
        MaxScenes = 200,  -- per server
    },
}
```

Scenes authored in-game are stored in MySQL, in `mbt_emote_menu_scenes`, one row
per scene. The table is created automatically on first boot — there is no SQL
file to import. They survive script updates and are covered by your normal
database backups.

This is the resource's only database dependency (`oxmysql`). If it is missing or
the connection fails, the scene editor turns itself off and says so in console;
everything else in the menu keeps working.

### Job Permissions

```lua
MBT.JobPermissions = {
    Enabled   = true,
    Framework = 'auto',    -- 'auto', 'esx', 'qbox', 'qbcore', 'standalone'
    Emotes = {
        ['handcuff'] = { 'police', 'sheriff' },
        ['mechanic'] = { 'mechanic', 'bennys' },
    },
}
```

### Categories

Toggle visibility or reorder categories in the menu:

```lua
MBT.Categories = {
    { type = 'Emotes',       label = 'Emotes',      icon = 'smile',      visible = true },
    { type = 'PropEmotes',   label = 'Props',        icon = 'package',    visible = true },
    { type = 'Dances',       label = 'Dances',       icon = 'music',      visible = true },
    { type = 'Shared',       label = 'Shared',       icon = 'users',      visible = true },
    { type = 'Expressions',  label = 'Expressions',  icon = 'drama',      visible = true },
    { type = 'Walks',        label = 'Walk Styles',  icon = 'footprints', visible = true },
    { type = 'AnimalEmotes', label = 'Animals',      icon = 'dog',        visible = true },
    { type = 'Emojis',       label = 'Emojis',       icon = 'message-circle', visible = true },
}
```

### Debug

When `MBT.Debug = true`, detailed logs are printed in both server console and client F8 console (including the NUI frontend via `[MBT NUI]` prefix). Useful for troubleshooting emote loading and KVP storage.

### Notifications

The notification function in `config.lua` supports presets for **ox_lib**, **ESX**, **QBCore**, **QBox**, and native GTA notifications. Uncomment the preset that matches your server setup.

---

## Keybinds Reference

| Key | Action |
|---|---|
| `F4` | Open / close emote menu |
| `K` (hold) | Open emote wheel |
| `Mouse Wheel` | Scroll wheel slots (while holding K) |
| `X` | Remove emote from wheel slot (while holding K) |
| `NUM1` — `NUM6` | Play quick-bound emote |
| `Right Click` | Open quick bind / wheel slot drawer on a card |
| `Arrow Keys` | Navigate emote list |
| `Enter` | Play focused emote |
| `ESC` | Close menu |

---

## FAQ

**Q: Can I use this without rpemotes-reborn?**
No. This resource is a UI replacement that depends on rpemotes-reborn for all animation logic and emote data.

**Q: Does it work with ESX, QBox, and QBCore?**
Yes. The job permission system auto-detects your framework (ESX → QBox → QBCore → standalone). You can also force a specific one in config.

**Q: How do I add a new language?**
Create a new file in `locales/` (e.g., `locales/jp.lua`), copy the structure from `en.lua`, translate the strings, and set `MBT.Language = 'jp'` in config.

**Q: My emotes don't show up.**
Make sure `rpemotes-reborn` is started and running before `mbt_emote_menu`. Check the F8 console for errors.

**Q: The menu looks wrong on my ultrawide monitor.**
The UI includes responsive breakpoints for all common resolutions including 2560x1080, 3440x1440, and 5120x1440. If you still experience issues, please open an issue with your resolution.

---

## Acknowledgments

This project would not exist without [**rpemotes-reborn**](https://github.com/alberttheprince/rpemotes-reborn) and the incredible work of its maintainers and contributors. rpemotes-reborn provides the entire animation engine, emote library, and shared emote logic that powers every feature in this menu. We are deeply grateful to the rpemotes-reborn team for building and maintaining such a solid foundation for the FiveM roleplay community.

**mbt_emote_menu** is a third-party UI overlay and is not affiliated with or endorsed by the rpemotes-reborn project. This resource is published with respect for the original project's license and guidelines. If you are part of the rpemotes-reborn team and have any concerns, please reach out to us directly.

---

## Credits

Developed by **Malibu Tech Team**.

Special thanks to:

- **rpemotes-reborn** — for the emote engine and animation library that makes this all possible
- **The FiveM community** — for continuous feedback, testing, and inspiration

---

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE.md).

You are free to use and modify this software for **noncommercial purposes only** — personal use, hobby servers, research, and education. Any commercial use, redistribution for profit, or inclusion in paid products is prohibited without written permission from Malibu Tech Team.

This resource depends on [rpemotes-reborn](https://github.com/alberttheprince/rpemotes-reborn) which is licensed under GPL-3.0. **mbt_emote_menu** does not include or redistribute any rpemotes-reborn source code — it communicates with rpemotes-reborn at runtime through FiveM exports and events.

---

## Media

- **Documentation:** [malibutechteam.com/docs](https://malibutechteam.com/docs/mbt-emote-menu/introduction)
- **Changelog:** [every release](https://github.com/MalibuTechTeam/mbt_emote_menu/releases)

Copyright 2026 MalibuTech.
