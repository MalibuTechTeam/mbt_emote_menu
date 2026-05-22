-------------------------------------------------------------------------------
-- [ EMOJI REACTIONS — Client ]
--
-- Self-contained port of the standalone mbt_emoji resource. Floats an emoji
-- glyph above a player's head when they trigger an emoji reaction, either from
-- the menu's "Emojis" category (routed through Core.PlayEmoteRaw) or via a
-- chat command (/smile, /cry, ...).
--
-- No ox_lib dependency: uses PlayerPedId() directly instead of cache.ped.
-------------------------------------------------------------------------------

Emoji = Emoji or {}

local cfg = MBT.Emoji or {}

local FONT        = 0
local BASE_SCALE  = cfg.Scale or 0.22
local MIN_DIST    = 2.0  -- clamp camera distance (not final scale) so a close-up
                         -- camera can't blow the glyph up. Kept below normal
                         -- third-person distance (~2-2.5m) so regular gameplay
                         -- renders at natural size — see DrawEmoji3D
local HEAD_BONE   = 31086 -- SKEL_Head — anchor point for the floating glyph
local HEAD_OFFSET = 0.32  -- metres above the head bone
local TEXT_COLOR  = { r = 255, g = 255, b = 255, a = 255 }

-- Per-ped stacking counter so two quick emojis from the same player don't
-- render perfectly on top of each other.
local pedStacks = {}

-------------------------------------------------------------------------------
-- [ RENDERING ] --
-------------------------------------------------------------------------------

--- Draw a single frame of 3D text at world coords. Scale shrinks with camera
--- distance so far-away emojis stay readable but unobtrusive.
local function DrawEmoji3D(coords, text)
    local cam = GetGameplayCamCoord()
    local dist = #(coords - cam)
    if dist <= 0.0 then return end

    -- Clamp the DISTANCE, not the final scale. Clamping the result made
    -- every MBT.Emoji.Scale value collapse to the same on-screen size at
    -- normal third-person distance; clamping distance keeps the Scale knob
    -- linear while still capping blow-up when the camera is right up close.
    local scale = 300.0 / (GetGameplayCamFov() * math.max(dist, MIN_DIST))

    SetTextColour(TEXT_COLOR.r, TEXT_COLOR.g, TEXT_COLOR.b, TEXT_COLOR.a)
    SetTextScale(0.0, BASE_SCALE * scale)
    SetTextDropshadow(0, 0, 0, 0, 55)
    SetTextDropShadow()
    SetTextCentre(true)
    SetTextFont(FONT)
    BeginTextCommandDisplayText('STRING')
    AddTextComponentSubstringPlayerName(text)
    SetDrawOrigin(coords.x, coords.y, coords.z, 0)
    EndTextCommandDisplayText(0.0, 0.0)
    ClearDrawOrigin()
end

--- Float `text` above `ped` for the configured display time. Distance-culled
--- and LOS-checked so it only draws when the local player can actually see it.
local function ShowAbovePed(ped, text)
    if not ped or ped == 0 or not DoesEntityExist(ped) then return end

    local maxDist   = cfg.MaxDistance or 60.0
    local displayMs = cfg.DisplayTimeMs or 5000

    pedStacks[ped] = (pedStacks[ped] or 0) + 1
    -- Offset above the head bone — small base + a per-stack bump so two quick
    -- emojis from the same player don't render on top of each other.
    local offset = HEAD_OFFSET + (pedStacks[ped] - 1) * 0.14

    CreateThread(function()
        local deadline = GetGameTimer() + displayMs
        while GetGameTimer() < deadline do
            local sleep = 0
            if DoesEntityExist(ped) then
                local playerPed   = PlayerPedId()
                local playerCoords = GetEntityCoords(playerPed)
                local pedCoords    = GetEntityCoords(ped)
                if #(playerCoords - pedCoords) <= maxDist then
                    if HasEntityClearLosToEntity(playerPed, ped, 17) then
                        -- Anchor to the head bone so the emoji sits just above
                        -- the head in any pose (standing, crouched, sitting).
                        local head = GetPedBoneCoords(ped, HEAD_BONE, 0.0, 0.0, 0.0)
                        DrawEmoji3D(vector3(head.x, head.y, head.z + offset), text)
                    end
                else
                    sleep = 250 -- out of range: idle instead of spinning a frame loop
                end
            else
                sleep = 250
            end
            Wait(sleep)
        end

        pedStacks[ped] = (pedStacks[ped] or 1) - 1
        if pedStacks[ped] <= 0 then pedStacks[ped] = nil end
    end)
end

-------------------------------------------------------------------------------
-- [ NETWORK ] --
-------------------------------------------------------------------------------

RegisterNetEvent('mbt_emote_menu:client:showEmoji', function(char, serverId)
    if not cfg.Enabled then return end
    if type(char) ~= 'string' or char == '' then return end

    local player = GetPlayerFromServerId(serverId)
    if player == -1 then return end

    local ped = GetPlayerPed(player)
    ShowAbovePed(ped, ' ' .. char .. ' ')
end)

-------------------------------------------------------------------------------
-- [ PUBLIC API ] --
-------------------------------------------------------------------------------

--- Trigger an emoji reaction by its config id. The server validates the id,
--- throttles per player, and broadcasts the resolved glyph to everyone.
--- @param id string emoji id (matches an entry in MBT.Emoji.List)
function Emoji.Play(id)
    if not cfg.Enabled then return end
    if type(id) ~= 'string' or id == '' then return end
    TriggerServerEvent('mbt_emote_menu:server:playEmoji', id)
end

-------------------------------------------------------------------------------
-- [ CHAT COMMANDS ] --
-------------------------------------------------------------------------------

-- Re-register the standalone /smile, /cry, ... commands so servers migrating
-- from mbt_emoji keep the exact same chat shortcuts. Disable via
-- MBT.Emoji.Commands = false (the menu cards still work either way).
if cfg.Enabled and cfg.Commands and cfg.List then
    for _, e in ipairs(cfg.List) do
        if type(e) == 'table' and type(e.id) == 'string' and e.id ~= '' then
            RegisterCommand(e.id, function()
                Emoji.Play(e.id)
            end, false)
        end
    end
end
