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
                // Windows installer configuration
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
            // Only notarize on macOS and when building locally
            if (process.platform !== 'darwin') {
                console.log('Skipping notarization - not running on macOS');
                return buildResult;
            }

            // Check if we're building a macOS app
            const isMacOSBuild = buildResult.platform === 'darwin';
            if (!isMacOSBuild) {
                console.log('Skipping notarization - not a macOS build');
                return buildResult;
            }

            // Check if required environment variables are set
            if (!process.env.MACOS_TEAM_ID || !process.env.MACOS_APPLEID || !process.env.MACOS_NOTARIZATION_PASSWORD) {
                console.warn('Missing required environment variables for notarization:');
                console.warn('- MACOS_TEAM_ID');
                console.warn('- MACOS_APPLEID');
                console.warn('- MACOS_NOTARIZATION_PASSWORD');
                console.warn('Skipping notarization...');
                return buildResult;
            }

            const { notarize } = require('electron-notarize');
            const fs = require('fs');

            console.log('Starting notarization process...');

            try {
                // The .app bundle is in the package output directory
                const appPath = path.join(buildResult.outputPaths[0], 'Companion Dashboard.app');

                console.log(`Looking for app bundle at: ${appPath}`);

                // Check if the app exists
                if (!fs.existsSync(appPath)) {
                    console.error(`App bundle not found at: ${appPath}`);
                    throw new Error(`App bundle not found at: ${appPath}`);
                }

                console.log(`Notarizing: ${appPath}`);
                console.log(`Architecture: ${buildResult.arch}`);

                await notarize({
                    tool: 'notarytool',
                    teamId: process.env.MACOS_TEAM_ID,
                    appBundleId: 'com.wearecreativeland.companiondashboard',
                    appPath: appPath,
                    appleId: process.env.MACOS_APPLEID,
                    appleIdPassword: process.env.MACOS_NOTARIZATION_PASSWORD,
                });

                console.log(`✅ Successfully notarized: ${appPath}`);

            } catch (error) {
                console.error('❌ Notarization failed:', error);
                // Don't throw the error to allow the build to continue
                // You can uncomment the line below if you want notarization failures to stop the build
                // throw error;
            }

            return buildResult;
        }
    }
};