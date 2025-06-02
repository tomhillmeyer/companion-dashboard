module.exports = {
    packagerConfig: {
        asar: true,
        osxSign: {
            identity: 'Developer ID Application: Your Company (YOUR_TEAM_ID)', // Replace with your identity name
            'hardened-runtime': true,
            'entitlements': 'entitlements.plist',
            'entitlements-inherit': 'entitlements.plist',
            'gatekeeper-assess': false,
        },
        osxNotarize: {
            appleId: process.env.MACOS_APPLEID,
            appleIdPassword: process.env.MACOS_NOTARIZATION_PASSWORD,
            teamId: process.env.MACOS_TEAM_ID,
        },
    },
    rebuildConfig: {},
    makers: [
        {
            name: '@electron-forge/maker-zip',
            platforms: ['darwin', 'win32'],
        },
        {
            name: '@electron-forge/maker-dmg',
            config: {
                format: 'ULFO'
            }
        },
        {
            name: '@electron-forge/maker-squirrel',
            config: {
                // Customize Windows installer if needed
            }
        }
    ],
    plugins: [
        {
            name: '@electron-forge/plugin-auto-unpack-natives',
            config: {},
        },
    ],
};
