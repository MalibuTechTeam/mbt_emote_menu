-------------------------------------------------------------------------------
-- [ PHOTO MODE — Server (Discord relay) ]
--
-- Optional. Only active when MBT.PhotoMode.Discord.Enabled is true and a
-- webhook URL is set. Receives a captured JPEG (base64) from a client and
-- posts it to the configured Discord channel.
--
-- SECURITY: the webhook URL lives ONLY here, server-side — it is never sent to
-- any client, so a tampered client can't extract and spam it. Uploads are
-- size-capped and throttled per player.
-------------------------------------------------------------------------------

local cfg = MBT.PhotoMode or {}
local dc  = cfg.Discord or {}

if not cfg.Enabled or not dc.Enabled then return end

local MAX_B64   = 2000000 -- ~1.5 MB image; reject anything bigger
local lastSend  = {}

-- ── base64 decode (Lua 5.4 bitwise; input is clean client-produced b64) ──
local B64 = {}
do
    local chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    for i = 1, 64 do B64[chars:byte(i)] = i - 1 end
end

local function b64decode(s)
    s = s:gsub('[^A-Za-z0-9+/]', '')
    local out, n = {}, #s
    for i = 1, n, 4 do
        local a = B64[s:byte(i)]     or 0
        local b = B64[s:byte(i + 1)] or 0
        local c = B64[s:byte(i + 2)]
        local d = B64[s:byte(i + 3)]
        local v = a * 262144 + b * 4096 + (c or 0) * 64 + (d or 0)
        out[#out + 1] = string.char((v >> 16) & 0xFF)
        if c then out[#out + 1] = string.char((v >> 8) & 0xFF) end
        if d then out[#out + 1] = string.char(v & 0xFF) end
    end
    return table.concat(out)
end

local function reply(src, ok, reason)
    TriggerClientEvent('mbt_emote_menu:client:photoUploadResult', src, ok, reason)
end

RegisterNetEvent('mbt_emote_menu:server:photoUpload', function(b64)
    local src = source
    if not src or src <= 0 then return end

    if type(dc.WebhookUrl) ~= 'string' or dc.WebhookUrl == '' then
        reply(src, false, 'not-configured'); return
    end
    if type(b64) ~= 'string' or #b64 < 100 then
        reply(src, false, 'bad-data'); return
    end
    if #b64 > MAX_B64 then
        reply(src, false, 'too-large'); return
    end

    local now = GetGameTimer()
    local throttle = dc.ThrottleMs or 30000
    if lastSend[src] and (now - lastSend[src]) < throttle then
        reply(src, false, 'throttled'); return
    end
    lastSend[src] = now

    local bytes = b64decode(b64)
    if #bytes < 64 then
        reply(src, false, 'decode-failed'); return
    end

    -- Long static boundary — collision with JPEG bytes is astronomically
    -- unlikely, and JPEG cannot contain a CRLF-delimited copy of this token.
    local boundary = '----MBTPhotoModeBoundary7f3a9c1e2b'
    local payload = json.encode({
        username = dc.Username or 'MBT Photo Mode',
        content  = ('📸 **%s**'):format(GetPlayerName(src) or ('player ' .. src)),
    })

    local body = table.concat({
        '--' .. boundary,
        'Content-Disposition: form-data; name="payload_json"',
        'Content-Type: application/json',
        '',
        payload,
        '--' .. boundary,
        'Content-Disposition: form-data; name="files[0]"; filename="mbt_shot.jpg"',
        'Content-Type: image/jpeg',
        '',
        bytes,
        '--' .. boundary .. '--',
        '',
    }, '\r\n')

    PerformHttpRequest(dc.WebhookUrl, function(status)
        local ok = status and status >= 200 and status < 300
        reply(src, ok and true or false, ok and 'ok' or ('http-' .. tostring(status)))
    end, 'POST', body, { ['Content-Type'] = 'multipart/form-data; boundary=' .. boundary })
end)

AddEventHandler('playerDropped', function()
    local src = source
    if src then lastSend[src] = nil end
end)
