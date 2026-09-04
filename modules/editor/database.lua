-------------------------------------------------------------------------------
-- [ SCENE EDITOR — DATABASE ] --
--
-- Scenes live in MySQL, one row each.
--
-- The earlier build wrote data/scenes.json. That failed in two ways worth
-- naming, because both are silent:
--
--   1. SaveResourceFile writes inside the resource folder. Hosts that redeploy
--      resources from a zip or git on every restart, or that mount them
--      read-only, would wipe or reject the write and the owner would only find
--      out after losing the work.
--   2. The file held the whole array, so two admins editing at once meant the
--      second save overwrote the first one's scenes. A row per scene cannot do
--      that.
--
-- Schema deploy follows mbt_character/modules/database/server.lua, itself
-- inherited from mbt_elevator: create on boot, and give consumers a real
-- barrier instead of hoping a fixed delay was long enough.
-------------------------------------------------------------------------------

EditorDb = EditorDb or {}

EditorDb.SchemaReady = false
EditorDb.SchemaError = nil

local TABLE = 'mbt_emote_menu_scenes'
local LEGACY_FILE = 'data/scenes.json'

---Blocks until the schema is genuinely up. Anything that queries must call
---this first: on a clean database the CREATE TABLE has not landed yet when the
---first client asks for the scene list.
function EditorDb.AwaitSchema()
    while not EditorDb.SchemaReady and not EditorDb.SchemaError do Wait(50) end
    return EditorDb.SchemaReady
end

-------------------------------------------------------------------------------
-- [ SCHEMA ] --
-------------------------------------------------------------------------------

local function tableExists(name)
    local count = MySQL.scalar.await([[
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
    ]], { name })
    return (tonumber(count) or 0) > 0
end

local function initSchema()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS `mbt_emote_menu_scenes` (
            `id`         VARCHAR(64)  NOT NULL,
            `label`      VARCHAR(64)  NOT NULL,
            `type`       ENUM('spot','seats','scene') NOT NULL DEFAULT 'spot',
            `radius`     FLOAT        NOT NULL DEFAULT 2.5,
            `marks`      JSON         NOT NULL,
            `created_by` VARCHAR(64)  NULL,
            `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                      ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ]])

    -- 'seats' arrived after the first build shipped, so a server that already
    -- has the table needs the column widened. MODIFY is idempotent: running it
    -- against a column that already matches is a no-op.
    pcall(function()
        MySQL.query.await([[
            ALTER TABLE `mbt_emote_menu_scenes`
            MODIFY COLUMN `type` ENUM('spot','seats','scene') NOT NULL DEFAULT 'spot'
        ]])
    end)
end

-------------------------------------------------------------------------------
-- [ READ / WRITE ] --
-------------------------------------------------------------------------------

---@return table[] scenes in the shape the rest of the resource uses
function EditorDb.LoadAll()
    local rows = MySQL.query.await(
        'SELECT `id`, `label`, `type`, `radius`, `marks` FROM `' .. TABLE .. '` ORDER BY `label`')
    if type(rows) ~= 'table' then return {} end

    local out = {}
    for i = 1, #rows do
        local row = rows[i]
        -- oxmysql hands JSON columns back already decoded on some builds and as
        -- a string on others. Accept both rather than betting on one.
        local marks = row.marks
        if type(marks) == 'string' then
            local ok, decoded = pcall(json.decode, marks)
            marks = ok and decoded or nil
        end

        if type(marks) == 'table' then
            out[#out + 1] = {
                id     = row.id,
                label  = row.label,
                type   = row.type,
                radius = tonumber(row.radius) or 2.5,
                marks  = marks,
            }
        end
    end

    return out
end

---Insert or update one scene. Row-scoped, so two admins editing different
---scenes never overwrite each other.
---@return boolean ok
function EditorDb.Save(scene, createdBy)
    local ok, err = pcall(function()
        MySQL.query.await([[
            INSERT INTO `mbt_emote_menu_scenes`
                (`id`, `label`, `type`, `radius`, `marks`, `created_by`)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                `label`  = VALUES(`label`),
                `type`   = VALUES(`type`),
                `radius` = VALUES(`radius`),
                `marks`  = VALUES(`marks`)
        ]], {
            scene.id, scene.label, scene.type, scene.radius,
            json.encode(scene.marks), createdBy,
        })
    end)

    if not ok then
        print(('^1[MalibuTech] Scene editor: save failed — %s^0'):format(tostring(err)))
        return false
    end
    return true
end

---@return boolean ok
function EditorDb.Delete(id)
    local ok, err = pcall(function()
        MySQL.query.await('DELETE FROM `' .. TABLE .. '` WHERE `id` = ?', { id })
    end)
    if not ok then
        print(('^1[MalibuTech] Scene editor: delete failed — %s^0'):format(tostring(err)))
        return false
    end
    return true
end

-------------------------------------------------------------------------------
-- [ ONE-TIME IMPORT FROM THE OLD JSON FILE ] --
-------------------------------------------------------------------------------

---Runs only when the table is empty and data/scenes.json still exists, so an
---owner who tested the file-based build does not lose those scenes. The file
---is left on disk untouched: deleting someone's data to tidy up is not ours
---to decide.
---@param validate fun(raw: table): table|nil
local function importLegacyFile(validate)
    local raw = LoadResourceFile(GetCurrentResourceName(), LEGACY_FILE)
    if not raw or raw == '' then return end

    local ok, decoded = pcall(json.decode, raw)
    if not ok or type(decoded) ~= 'table' or #decoded == 0 then return end

    local imported = 0
    for i = 1, #decoded do
        local scene = validate(decoded[i])
        if scene then
            scene.id = scene.id or ('scene_' .. i)
            if EditorDb.Save(scene, 'json-import') then
                imported = imported + 1
            end
        end
    end

    if imported > 0 then
        print(('^2[MalibuTech] Scene editor: imported %d scene(s) from %s into the database. ' ..
               'The file was left in place; you can delete it once you have checked them.^0')
            :format(imported, LEGACY_FILE))
    end
end

-------------------------------------------------------------------------------
-- [ BOOT ] --
-------------------------------------------------------------------------------

---@param validate fun(raw: table): table|nil  scene validator from server.lua
function EditorDb.Init(validate)
    CreateThread(function()
        -- Distinguish "the library never loaded" from "the query failed".
        -- They look identical in a stack trace and need opposite fixes: one is
        -- a missing resource or a missing @oxmysql/lib/MySQL.lua import, the
        -- other is a connection string.
        if MySQL == nil then
            EditorDb.SchemaError = 'oxmysql library not loaded'
            print('^1[MalibuTech] Scene editor: oxmysql is not available. ' ..
                  'Make sure the resource is started before mbt_emote_menu.^0')
            print('^1[MalibuTech] The scene editor is disabled for this session. ' ..
                  'Everything else in the menu keeps working.^0')
            return
        end

        local ok, err = pcall(function()
            initSchema()

            if not tableExists(TABLE) then
                error('table ' .. TABLE .. ' missing after CREATE TABLE')
            end

            local count = MySQL.scalar.await('SELECT COUNT(*) FROM `' .. TABLE .. '`')
            if (tonumber(count) or 0) == 0 then
                importLegacyFile(validate)
            end
        end)

        if ok then
            EditorDb.SchemaReady = true
        else
            EditorDb.SchemaError = tostring(err)
            print(('^1[MalibuTech] Scene editor: database query failed — %s^0'):format(tostring(err)))
            print('^1[MalibuTech] The scene editor is disabled for this session. ' ..
                  'oxmysql loaded, so check your connection string and that the ' ..
                  'database user may CREATE TABLE.^0')
        end
    end)
end
