-- MalibuTech factory values. NOT your configuration file.
--
-- config.lua is yours: it holds what has to be decided before the resource
-- boots. This holds what MalibuTech ships, and what the in-game admin panel
-- edits. Editing it by hand works, but it is the file an update overwrites --
-- the shield menu is the place these are meant to be changed from.
--
-- "Reset" in the panel means these values, captured at load before any saved
-- choice is applied.

MBT = MBT or {}

-- Il repository da cui si legge l'ultima versione. NON e' configurabile: lo
-- script e' nostro e deve puntare alla nostra repository, e core/client.lua
-- accetta solo URL sotto github.com/MalibuTechTeam/ comunque.
--
-- ATTENZIONE, e non accorpare: questo NON puo' stare in MBT.Admin.UpdateNotice
-- insieme a Enabled. fxmanifest carica default.lua PRIMA di config.lua, e
-- config.lua:284 fa `MBT.Admin = { ... }` -- un'assegnazione intera, che
-- cancellerebbe qualunque cosa avessimo messo qui dentro MBT.Admin.
-- Accorparli compila, parte, e cade in silenzio sul fallback di
-- modules/version/server.lua. Nessun errore, e il difetto si vede solo il
-- giorno che il repository cambia nome.
MBT.UpdateNotice = {
    Repository = 'MalibuTechTeam/mbt_emote_menu',
}

-- Menu colours, sent to the UI at startup. Hex without '#'.
--
-- Accent is the one that matters, and it is the one the admin panel edits:
-- every surface in the UI is derived from it (web/src/utils/theme.ts), carrying
-- its hue at a fixed lightness. Pick amber and the panels go amber; pick a
-- near-grey and they stay near-grey.
--
-- Background and Card are LEGACY. Nothing reads them since the surfaces became
-- derived -- their tokens have no users left in the stylesheet. Left in place
-- rather than deleted mid-release; they will go in a later one.
MBT.Theme = {
    Accent            = '00e676', -- Brand green. The admin panel overrides this per server.
    AllowAccentChange = false,    -- Let players pick their own accent from the curated presets
    Background        = '0C0E14', -- legacy, unused
    Card              = '121814', -- legacy, unused
    Text              = 'E8E8EE', -- Primary text
    SubText           = '8A93A6', -- Secondary text (5.8:1 on Card)
    Border            = '1A1D26', -- Internal dividers
}
