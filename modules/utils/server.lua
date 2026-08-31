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

    print(('^1[MalibuTech] ERROR: This resource must be named "%s"!^0'):format(expectedName))
    print(('^1[MalibuTech] Current folder name: "%s" — please rename it and restart.^0'):format(actual))
    return false
end
