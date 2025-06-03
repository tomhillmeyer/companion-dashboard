require('dotenv').config();
const path = require('path');

module.exports = {
    packagerConfig: {
        asar: true,
        name: 'Companion Dashboard',
        executableName: 'Companion Dashboard',
        icon: './public/icon',
        osxSign: {
            identity: 'Developer ID Application: Creativeland, LLC (22SGVMMH49)',
            'hardened-runtime': true,
            entitlements: 'entitlements.plist',
            'entitlements-inherit': 'entitlements.plist',
            'signature-flags': 'library'
        }
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
    hooks: {
        postPackage: async (forgeConfig, buildResult) => {
            // Only notarize on macOS
            if (process.platform !== 'darwin') {
                return buildResult;
            }

            const { notarize } = require('electron-notarize');

            console.log('Starting notarization process...');

            try {
                // The .app bundle is in the package output directory
                const appPath = path.join(buildResult.outputPaths[0], 'Companion Dashboard.app');

                console.log(`Looking for app bundle at: ${appPath}`);

                // Check if the app exists
                const fs = require('fs');
                if (!fs.existsSync(appPath)) {
                    console.error(`App bundle not found at: ${appPath}`);
                    throw new Error(`App bundle not found at: ${appPath}`);
                }

                console.log(`Notarizing: ${appPath}`);

                await notarize({
                    tool: 'notarytool',
                    teamId: process.env.MACOS_TEAM_ID,
                    appBundleId: 'com.wearecreativeland.companiondashboard',
                    appPath: appPath,
                    appleId: process.env.MACOS_APPLEID,
                    appleIdPassword: process.env.MACOS_NOTARIZATION_PASSWORD,
                    // Skip stapling to avoid Error 65
                    skipStapling: true
                });

                console.log(`Successfully notarized: ${appPath}`);
                console.log('Note: Stapling was skipped. Your app is notarized but the ticket is not attached.');
                console.log('This is fine for distribution - macOS will verify online when needed.');

            } catch (error) {
                console.error('Notarization failed:', error);
                throw error;
            }

            return buildResult;
        }
    }
};