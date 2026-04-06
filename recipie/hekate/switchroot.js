import { get, create, edit } from 'unipatch'

const resDirectory = process.env.HEKATE_RESOURCES

const swtichRootBootEntry = {
    l4t: 1,
    id: 'SWANDR',
    boot_prefixes: 'switchroot/android/',
    icon: resDirectory + '/icon_android.bmp',
    logopath: resDirectory + '/bootlogo_android.bmp',
    r2p_action: 'normal',
    alarms_disable: process.env.SWITCHROOT_SLEEP_DEEP == true ? 1 : 0,
    usb3_enable: process.env.SWITCHROOT_USB3 == true ? 1 : 0,
    wifi_disable_vht80: process.env.SWITCHROOT_FIX_WIFI_CRASH == true ? 0 : 1,
    ddr200_enable: process.env.SWITCHROOT_DDR200 == true ? 1 : 0,

    // Undervolt and orverclock
    dvfsb: process.env.SWITCHROOT_UV_BASE == true ? 1 : 0,
    gpu_dvfsc:
        process.env.SWITCHROOT_UVOC_GPU == 2 ||
        process.env.SWITCHROOT_UVOC_GPU == 1
            ? 1
            : 0,
    limit_gpu_clk: process.env.SWITCHROOT_UVOC_GPU == 1 ? 1 : 0,
}

export default [
    // Icon and bootlogo
    get('local:./resources/android/*.bmp').to(resDirectory),
    // Configs
    create('bootloader/ini/android.ini'),
    edit('bootloader/ini/android.ini').set('Android', swtichRootBootEntry),
    edit('bootloader/hekate_ipl.ini').set('Android', swtichRootBootEntry),

    // Download bootloader requirements
    get('lineageos:nx_tab', {
        assetPattern: 'bl31.bin',
        version: 'latest',
    }).to('switchroot/android'),
    get('lineageos:nx_tab', {
        assetPattern: 'bl33.bin',
        version: 'latest',
    }).to('switchroot/android'),
    get('lineageos:nx_tab', {
        assetPattern: 'boot.scr',
        version: 'latest',
    }).to('switchroot/android'),

    ...(process.env.SWITCHROOT_PREP_INSTALL == true
        ? [
              // Download installation packages
              get('lineageos:nx_tab', {
                  assetPattern: 'boot.img',
                  version: 'latest',
              }).to('switchroot/install'),
              get('lineageos:nx_tab', {
                  assetPattern: 'recovery.img',
                  version: 'latest',
              }).to('switchroot/install'),
              get('lineageos:nx_tab', {
                  assetPattern: 'nx-plat.dtimg',
                  version: 'latest',
              }).to('switchroot/install'),
              get('lineageos:nx_tab', {
                  assetPattern: 'lineage-*-nightly-nx_tab-signed.zip',
                  version: 'latest',
              }).to('switchroot'),
              get('github:MindTheGapps/15.0.0-arm64', {
                  assetPattern: 'MindTheGapps-15.0.0-arm64-*.zip',
                  version: 'latest',
              }).to('switchroot'),
          ]
        : []),
]
