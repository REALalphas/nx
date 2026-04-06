import { rename, get, create, edit, remove, move, del } from 'unipatch'

const addSwitchcraft = [
    get('github:halop/OC-Switchcraft-EOS')
        .unpack()
        .ignore('PC')
        .to('switchcraft_tmp'),
    // Transfer hbmenu to our homebrew
    // move('hbmenu.nro', 'switch/hbmenu.nro'),
    // // Place sphaira in place of hbmenu
    // move('switch/sphaira/sphaira.nro', 'hbmenu.nro'),
    // // Remove unneeded directory
    // remove('switch/sphaira'),
]

export default [
    get('github:atmosphere-nx/atmosphere', {
        assetPattern: 'atmosphere-*+hbl-*+hbmenu-*.zip',
    }).unpack(),
    // Atmosphere's default homebrew
    remove('switch/reboot_to_payload.nro'), // Broken on some systems (Just reboot or use Ultrahand)
    move('switch/daybreak.nro', 'switch/daybreak/'), // Updater
    move('switch/haze.nro', 'switch/haze/'), // "Low level" USB file transfer

    get('github:impeeza/sys-patch', {
        assetPattern: 'sys-patch-v*.zip',
    })
        .unpack()
        .to('sys-patch_tmp'),

    ...(process.env.USE_OVERCLOCKING == true ? addSwitchcraft : []),
]
