fx_version 'cerulean'
use_experimental_fxv2_oal 'yes'
lua54 'yes'
game 'gta5'

name 'mbt_emote_menu'
author 'Malibù Tech Team'
version      '1.2.1'
description 'Premium NUI emote menu for rpemotes-reborn by Malibu Tech'

dependencies {
    '/server:6116',
    '/onesync',
    'rpemotes-reborn',
}

shared_scripts {
    'modules/locales.lua',
    'locales/*.lua',
    'config.lua',
}

server_scripts {
    'modules/utils/server.lua',
    'core/server.lua',
    'modules/bridges/esx.lua',
    'modules/bridges/qbcore.lua',
    'modules/bridges/qbox.lua',
    'modules/openjoin/server.lua',
}

client_scripts {
    'modules/utils/client.lua',
    'modules/storage/client.lua',
    'modules/preview/client.lua',
    'modules/playlist/client.lua',
    'modules/partner/client.lua',
    'modules/openjoin/client.lua',
    'core/client.lua',
}

ui_page 'web/dist/index.html'

files {
    'web/dist/index.html',
    'web/dist/assets/**',
}
