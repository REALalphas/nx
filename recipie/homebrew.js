import { rename, get, create, edit, remove, move, del } from 'unipatch'
import sphaira from './homebrew/sphaira'

export default [
    // Sphaira
    ...(process.env.USE_SPHAIRA == true ? sphaira : []),
    // JKSV
    get('github:j-d-k/jksv', {
        assetPattern: 'JKSV.nro',
    }).to('switch/jksv'),
    // Linkalho
    get('github:impeeza/linkalho', {
        assetPattern: 'linkalho-*.zip',
    }).unpack(),
]
