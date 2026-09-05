-------------------------------------------------------------------------------
-- [ VERSION CHECK — SERVER ] --
--
-- Asks GitHub once, at boot, whether a newer release exists. This module only
-- fetches and remembers; it never talks to a client. The ACE gate and the
-- client event live in core/server.lua, so there is exactly one place where
-- "who is allowed to see this" is decided.
--
-- MBT.UpdateStatus is always set once the check completes (so the owner
-- diagnostics can say "checked, you're current" instead of staying blank).
-- MBT.UpdateInfo is set only when a newer release actually exists.
--
-- Both live on the server's own copy of the MBT table. config.lua is a
-- shared_script, so the client has a separate table where these stay nil —
-- nothing here is replicated.
-------------------------------------------------------------------------------

local cfg = (MBT.Admin and MBT.Admin.UpdateNotice) or {}

if cfg.Enabled == false then return end

local REPO = (MBT.UpdateNotice and MBT.UpdateNotice.Repository) or 'MalibuTechTeam/mbt_emote_menu'

---Parses a version into its three numeric components.
---@param s string|nil
---@return integer|nil major, integer|nil minor, integer|nil patch
local function parseVersion(s)
    local ma, mi, pa = tostring(s or ''):match('^v?(%d+)%.(%d+)%.(%d+)')
    if not ma then return nil end
    return tonumber(ma), tonumber(mi), tonumber(pa)
end

---@return boolean  true when `latest` is strictly newer than `current`
local function isNewer(latest, current)
    local lMa, lMi, lPa = parseVersion(latest)
    local cMa, cMi, cPa = parseVersion(current)
    if not lMa or not cMa then return false end

    if lMa ~= cMa then return lMa > cMa end
    if lMi ~= cMi then return lMi > cMi end
    return lPa > cPa
end

CreateThread(function()
    local resource = GetCurrentResourceName()
    local current = GetResourceMetadata(resource, 'version', 0)
    current = current and current:match('%d+%.%d+%.%d+') or nil

    if not current then
        print(('^3[MalibuTech] Unable to determine current version for %s^0'):format(resource))
        MBT.UpdateStatus = { checked = false }
        return
    end

    -- Published NOW, before the network is involved: the version you run comes
    -- from the manifest and is already known. Only the COMPARISON needs
    -- GitHub. Without this the admin panel spent the first seconds after every
    -- restart showing an em dash and "update check failed", which is a lie
    -- about two separate things at once.
    MBT.UpdateStatus = { current = current, checked = false }

    -- Never urgent: let the server finish booting first.
    SetTimeout(2000, function()
        PerformHttpRequest(('https://api.github.com/repos/%s/releases/latest'):format(REPO),
            function(status, body)
                -- Any failure leaves checked=false. We never claim "up to date"
                -- on a request that did not actually succeed.
                if status ~= 200 or type(body) ~= 'string' then
                    -- "Update check failed" with no reason is useless to an
                    -- owner staring at it in the menu. Say what happened; the
                    -- most common causes are a blocked outbound request and
                    -- GitHub's 60/hour unauthenticated rate limit (403).
                    print(('^3[MalibuTech] Update check failed for %s (HTTP %s). This is not fatal.^0')
                        :format(resource, tostring(status)))
                    MBT.UpdateStatus = { current = current, checked = false }
                    return
                end

                local ok, data = pcall(json.decode, body)
                if not ok or type(data) ~= 'table' or type(data.tag_name) ~= 'string' then
                    print(('^3[MalibuTech] Update check for %s: unexpected response shape.^0')
                        :format(resource))
                    MBT.UpdateStatus = { current = current, checked = false }
                    return
                end

                local latest = data.tag_name:match('%d+%.%d+%.%d+')
                if not latest then
                    MBT.UpdateStatus = { current = current, checked = false }
                    return
                end

                MBT.UpdateStatus = { current = current, latest = latest, checked = true }

                if not isNewer(latest, current) then return end

                local url = (type(data.html_url) == 'string' and data.html_url)
                    or ('https://github.com/%s/releases/latest'):format(REPO)

                MBT.UpdateInfo = { current = current, latest = latest, url = url }

                print(('^3[MalibuTech] Update available for %s (current: %s, latest: %s)^0'):format(
                    resource, current, latest))
                print(('^5[MalibuTech] Download the latest release: %s^0'):format(url))
            end, 'GET', '', { ['User-Agent'] = resource })
    end)
end)
