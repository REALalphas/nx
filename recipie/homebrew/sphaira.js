import { get, move, copy } from 'unipatch'

const resDirectory = process.env.HEKATE_RESOURCES

export default [
    get('github:ITotalJustice/sphaira').unpack(),

    ...(process.env.SPHAIRA_AS_DEFAULT == true
        ? [
              // Transfer hbmenu to our homebrew
              move('hbmenu.nro', 'switch/hbmenu.nro'),
              // Place sphaira in place of hbmenu
              copy('switch/sphaira/sphaira.nro', 'hbmenu.nro'),
          ]
        : []),
    // Remove unneeded directory
    // remove('switch/sphaira'),
]
