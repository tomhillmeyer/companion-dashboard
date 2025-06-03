require('dotenv').config();
const { notarize } = require('electron-notarize');
const path = require('path');
const fs = require('fs');

exports.default = async function notarizing(context) {
    const { electronPlatformName, appOutDir } = context;

    console.log('Notarization context:', {
        platform: electronPlatformName,
        outDir: appOutDir
    });

    if (electronPlatformName !== 'darwin') {
        console.log('Skipping notarization - not macOS');
        return;
    }

    // Check if required environment variables are set
    if (!process.env.MACOS_TEAM_ID || !process.env.MACOS_APPLEID || !process.env.MACOS_NOTARIZATION_PASSWORD) {
        console.log('Missing required environment variables for notarization');
        return;
    }

    const appName = context.packager.appInfo.productFilename;
    const appPath = path.join(appOutDir, `${appName}.app`);

    console.log(`Looking for app at: ${appPath}`);

    if (!fs.existsSync(appPath)) {
        console.error(`App not found at ${appPath}`);
        return;
    }

    console.log(`Starting notarization for ${appName} at ${appPath}`);

    try {
        await notarize({
            tool: 'notarytool',
            teamId: process.env.MACOS_TEAM_ID,
            appBundleId: 'com.wearecreativeland.companiondashboard',
            appPath: appPath,
            appleId: process.env.MACOS_APPLEID,
            appleIdPassword: process.env.MACOS_NOTARIZATION_PASSWORD,
        });
        console.log('Notarization completed successfully');
    } catch (error) {
        console.error('Notarization failed:', error);
        throw error;
    }
};