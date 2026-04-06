import { rename, get, create, edit, remove, move, del } from 'unipatch'
import addSwitchroot from './hekate/switchroot'

const resDirectory = process.env.HEKATE_RESOURCES

export default [
    get('github:ctcaer/hekate', {
        assetPattern: 'hekate_ctcaer_*_Nyx_*.zip',
    }).unpack(),
    rename('hekate_ctcaer_*.bin', 'payload.bin'),
    remove('bootloader/update.bin'),
    // Icons
    remove('bootloader/res'),
    get('local:./resources/hekate_res/*.bmp').to(resDirectory),
    // Configs
    get('local:./resources/hekate_ini/hekate_ipl.ini').to('bootloader'),
    get('local:./resources/hekate_ini/ini/').to('bootloader/ini'),

    ...(process.env.USE_SWITCHROOT == true ? addSwitchroot : []),

    // Additional ADD_TEGRAEXPLORER
    process.env.ADD_TEGRAEXPLORER == true
        ? get('github:suchmememanyskill/TegraExplorer', {
              assetPattern: 'TegraExplorer.bin',
          }).to('bootloader/payloads')
        : '',
    process.env.ADD_LOCKPICK_RCM == true
        ? get('github:impeeza/Lockpick_RCMDecScots', {
              assetPattern: 'Lockpick_RCM.bin',
          }).to('bootloader/payloads')
        : '',
]
