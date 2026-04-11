Utils = {}

function Utils.MbtDebugger(...)
    if MBT.Debug then
        print('^3[mbt_emote_menu]^0', ...)
    end
end

---@param str string|nil
---@return string|nil sanitized string, or nil if input was invalid
function Utils.Sanitize(str)
    if type(str) ~= 'string' then return nil end
    return str:gsub('[^%w_%-]', '')
end

---@param resourceName string  the export resource name (e.g. 'rpemotes')
---@param method       string  the method name to call
---@param ...          any     arguments forwarded to the export
---@return any|nil result, boolean ok
function Utils.SafeExport(resourceName, method, ...)
    local ok, result = pcall(function(...)
        return exports[resourceName][method](exports[resourceName], ...)
    end, ...)
    if ok then return result, true end
    return nil, false
end

---@param resourceName string
---@param method       string
---@param ...          any
function Utils.SafeExportCall(resourceName, method, ...)
    pcall(function(...) exports[resourceName][method](exports[resourceName], ...) end, ...)
end

---@param key string  the KVP key
---@return any|nil  decoded value, or nil if not found / invalid JSON
function Utils.LoadKvpJson(key)
    local raw = GetResourceKvpString(key)
    if not raw or raw == '' then return nil end
    local ok, data = pcall(json.decode, raw)
    if ok then return data end
    return nil
end

---@param key  string  the KVP key
---@param data any     value to encode and store
function Utils.SaveKvpJson(key, data)
    SetResourceKvp(key, json.encode(data))
end

---@param hash number|string  model hash or name
---@param timeout? number     max wait in ms (default 5000)
---@return boolean loaded
function Utils.RequestModel(hash, timeout)
    if type(hash) == 'string' then hash = GetHashKey(hash) end
    if HasModelLoaded(hash) then return true end
    RequestModel(hash)
    local maxWait = timeout or 5000
    local waited = 0
    while not HasModelLoaded(hash) and waited < maxWait do
        Wait(50)
        waited = waited + 50
    end
    return HasModelLoaded(hash)
end

---@param dict string  animation dictionary name
---@param timeout? number  max wait in ms (default 5000)
---@return boolean loaded
function Utils.RequestAnimDict(dict, timeout)
    if HasAnimDictLoaded(dict) then return true end
    RequestAnimDict(dict)
    local maxWait = timeout or 5000
    local waited = 0
    while not HasAnimDictLoaded(dict) and waited < maxWait do
        Wait(50)
        waited = waited + 50
    end
    return HasAnimDictLoaded(dict)
end
