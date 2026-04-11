MBT = MBT or {}

local Locales = {}

function Translate(key, ...)
    if Locales[MBT.Language] and Locales[MBT.Language][key] then
        if ... then
            return string.format(Locales[MBT.Language][key], ...)
        end
        return Locales[MBT.Language][key]
    end
    -- Fallback to English
    if Locales['en'] and Locales['en'][key] then
        if ... then
            return string.format(Locales['en'][key], ...)
        end
        return Locales['en'][key]
    end
    return key
end

function RegisterLocale(lang, data)
    Locales[lang] = data
end

-- Expose the Locale table on MBT for compatibility with other MBT scripts
CreateThread(function()
    Wait(0)
    MBT.Locale = setmetatable({}, {
        __index = function(_, key)
            return Translate(key)
        end
    })
end)
