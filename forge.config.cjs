module.exports = {
    packagerConfig: {
        asar: true,
        osxSign: {
            identity: "Developer ID Application: Tom Hillmeyer ${{ secrets.MACOS_TEAM_ID }}",
            hardenedRuntime: true,
            entitlements: "entitlements.plist",
            "entitlements-inherit": "entitlements.plist",
            "signature-flags": "library"
        },
        osxNotarize: {
            tool: "notarytool",
            appleId: "${{ secrets.MACOS_APPLEID }}",
            appleIdPassword: "${{ secrets.MACOS_NOTARIZATION_PASSWORD }}", // See step 3
            teamId: "${{ secrets.MACOS_TEAM_ID }}"
        }
    },
    rebuildConfig: {},
    makers: [
        {
            name: '@electron-forge/maker-zip',
            platforms: ['darwin', 'win32'], // Add win32 here
        },
        {
            name: '@electron-forge/maker-dmg',
            config: {
                format: 'ULFO'
            }
        },
        // Add Windows-specific maker
        {
            name: '@electron-forge/maker-squirrel',
            config: {
                // Optional: customize installer settings
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