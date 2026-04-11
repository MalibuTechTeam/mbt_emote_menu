Core = Core or {}

local playlistActive = false

RegisterNUICallback('playPlaylist', function(data, cb)
    local items = data.items
    if type(items) ~= 'table' or #items == 0 then
        cb({ ok = false })
        return
    end

    playlistActive = false
    Wait(250)

    playlistActive = true
    CreateThread(function()
        local looping = data.loop or false

        repeat
            for i, item in ipairs(items) do
                if not playlistActive then break end

                SendNUIMessage({ action = 'playlistIndex', index = i - 1 })

                if Core._rpemotesExportName then
                    Utils.SafeExportCall(Core._rpemotesExportName, 'EmoteCancel')
                    Wait(150)
                end

                Core.PlayEmoteRaw(item.name, item.category, tonumber(item.variation) or 1)

                local waitMs = (tonumber(item.playDuration) or 5) * 1000
                local elapsed = 0
                while elapsed < waitMs and playlistActive do
                    Wait(200)
                    elapsed = elapsed + 200
                end
            end
        until not looping or not playlistActive

        playlistActive = false
        if Core._rpemotesExportName then
            Utils.SafeExportCall(Core._rpemotesExportName, 'EmoteCancel')
        end
        SendNUIMessage({ action = 'playlistStopped' })
        Utils.MbtDebugger('Playlist finished')
    end)

    cb({ ok = true })
end)

RegisterNUICallback('stopPlaylist', function(_, cb)
    playlistActive = false
    if Core._rpemotesExportName then
        Utils.SafeExportCall(Core._rpemotesExportName, 'EmoteCancel')
    end
    SendNUIMessage({ action = 'playlistStopped' })
    Utils.MbtDebugger('Playlist stopped')
    cb({ ok = true })
end)
