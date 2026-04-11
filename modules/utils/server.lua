Utils = Utils or {}

function Utils.MbtDebugger(...)
    if MBT.Debug then
        print('^3[mbt_emote_menu]^0', ...)
    end
end

---@param expectedName string
---@return boolean ok
function Utils.MbtResourceNameCheck(expectedName)
    local actual = GetCurrentResourceName()
    if actual == expectedName then return true end

    print(('^1[%s] ERROR: This resource must be named "%s"!^0'):format(actual, expectedName))
    print(('^1[%s] Current name: "%s" — please rename the folder and restart.^0'):format(actual, actual))
    return false
end

---@param repository string
function Utils.MbtVersionCheck(repository)
    local resource = GetCurrentResourceName()
    local currentVersion = GetResourceMetadata(resource, 'version', 0)

    if currentVersion then
        currentVersion = currentVersion:match('%d+%.%d+%.%d+')
    end

    if not currentVersion then
        print(('^3[%s] Unable to determine current version for update check^0'):format(resource))
        return
    end

    SetTimeout(2000, function()
        PerformHttpRequest(('https://api.github.com/repos/%s/releases/latest'):format(repository),
            function(status, response)
                if status ~= 200 then return end

                response = json.decode(response)
                if response.prerelease then return end

                local latestVersion = response.tag_name:match('%d+%.%d+%.%d+')
                if not latestVersion or latestVersion == currentVersion then return end

                local cv = { string.strsplit('.', currentVersion) }
                local lv = { string.strsplit('.', latestVersion) }

                for i = 1, #cv do
                    local current, latest = tonumber(cv[i]), tonumber(lv[i])

                    if current ~= latest then
                        if current < latest then
                            print(('^3[%s] An update is available! (current: %s → latest: %s)^0'):format(resource,
                                currentVersion, latestVersion))
                            print(('^3[%s] %s^0'):format(resource, response.html_url))
                        end
                        break
                    end
                end
            end, 'GET')
    end)
end
