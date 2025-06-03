require('dotenv').config();

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
        postMake: async (forgeConfig, makeResults) => {
            // Only notarize on macOS
            if (process.platform !== 'darwin') {
                return makeResults;
            }

            const { notarize } = require('electron-notarize');

            console.log('Starting notarization process...');

            try {
                for (const makeResult of makeResults) {
                    if (makeResult.platform === 'darwin') {
                        // Find the .app bundle in the make results
                        const appPath = makeResult.artifacts.find(artifact =>
                            artifact.endsWith('.app') ||
                            (artifact.includes('.app') && !artifact.endsWith('.zip') && !artifact.endsWith('.dmg'))
                        );

                        if (appPath) {
                            console.log(`Notarizing: ${appPath}`);

                            await notarize({
                                tool: 'notarytool',
                                teamId: process.env.MACOS_TEAM_ID,
                                appBundleId: 'com.wearecreativeland.companiondashboard',
                                appPath: appPath,
                                appleId: process.env.MACOS_APPLEID,
                                appleIdPassword: process.env.MACOS_NOTARIZATION_PASSWORD,
                            });

                            console.log(`Successfully notarized: ${appPath}`);
                        } else {
                            console.log('No .app bundle found in make results');
                        }
                    }
                }
            } catch (error) {
                console.error('Notarization failed:', error);
                throw error;
            }

            return makeResults;
        }
    }
};