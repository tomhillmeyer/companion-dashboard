require('dotenv').config();
const { notarize } = require('electron-notarize');

exports.default = async function notarizing(context) {
    const { electronPlatformName, appOutDir } = context;
    if (electronPlatformName !== 'darwin') {
        return;
    }

    const appName = context.packager.appInfo.productFilename;

    return await notarize({
        tool: 'notarytool',
        teamId: process.env.MACOS_TEAM_ID,
        appBundleId: 'com.wearecreativeland.companiondashboard',
        appPath: `${appOutDir}/${appName}.app`,
        appleId: process.env.MACOS_APPLEID,
        appleIdPassword: process.env.MACOS_NOTARIZATION_PASSWORD,
    });
};