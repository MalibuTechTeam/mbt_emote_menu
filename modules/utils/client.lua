Utils = {}

function Utils.MbtDebugger(...)
    if MBT.Debug then
        print('^3[mbt_emote_menu]^0', ...)
    end
end

function Utils.CheckResourceVersion(resource, minimumVersion)
    local current = GetResourceMetadata(resource, 'version', 0)
    current = current and current:match('%d+%.%d+%.%d+') or nil
    if not current then return false, 'unknown' end
    if current == minimumVersion then return true, current end

    local cv, mv = {}, {}
    for n in current:gmatch('%d+') do cv[#cv + 1] = tonumber(n) end
    for n in minimumVersion:gmatch('%d+') do mv[#mv + 1] = tonumber(n) end

    for i = 1, #mv do
        local c, m = cv[i] or 0, mv[i] or 0
        if c ~= m then return c > m, current end
    end
    return true, current
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

Utils.KEY_CODES = {
    A = 0x41, B = 0x42, C = 0x43, D = 0x44, E = 0x45, F = 0x46, G = 0x47,
    H = 0x48, I = 0x49, J = 0x4A, K = 0x4B, L = 0x4C, M = 0x4D, N = 0x4E,
    O = 0x4F, P = 0x50, Q = 0x51, R = 0x52, S = 0x53, T = 0x54, U = 0x55,
    V = 0x56, W = 0x57, X = 0x58, Y = 0x59, Z = 0x5A,
    ['0'] = 0x30, ['1'] = 0x31, ['2'] = 0x32, ['3'] = 0x33, ['4'] = 0x34,
    ['5'] = 0x35, ['6'] = 0x36, ['7'] = 0x37, ['8'] = 0x38, ['9'] = 0x39,
    F1 = 0x70, F2 = 0x71, F3 = 0x72, F4 = 0x73, F5 = 0x74, F6 = 0x75,
    F7 = 0x76, F8 = 0x77, F9 = 0x78, F10 = 0x79, F11 = 0x7A, F12 = 0x7B,
}

---@param keyName string  letter (case-insensitive) or function key ('F1'..'F12')
---@return integer|nil    Windows VK code for IsRawKeyDown, or nil if unsupported
function Utils.KeyCode(keyName)
    if type(keyName) ~= 'string' then return nil end
    return Utils.KEY_CODES[keyName:upper()]
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
