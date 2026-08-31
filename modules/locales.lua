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

-- Expose the Locale table on MBT for compatibility with other MBT scripts.
--
-- Set at file scope, not from a thread: __index resolves through Translate at
-- lookup time, so it does not need the locale files to have loaded yet -- and
-- deferring it by even one tick left MBT.Locale nil for anything that reads it
-- during startup, which silently produced a payload of raw keys.
MBT.Locale = setmetatable({}, {
    __index = function(_, key)
        return Translate(key)
    end
})
