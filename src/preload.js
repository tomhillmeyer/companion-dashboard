const { contextBridge, ipcRenderer } = require('electron');

// Extract window ID from command line arguments
const windowIdArg = process.argv.find(arg => arg.startsWith('--window-id='));
const windowId = windowIdArg ? windowIdArg.split('=')[1] : '1';

// Check for kiosk mode flag
const isKioskMode = process.argv.includes('--kiosk-mode');

contextBridge.exposeInMainWorld('electronAPI', {
    windowId: windowId,
    isKioskMode: isKioskMode,
    webServer: {
        start: (port, hostname) => ipcRenderer.invoke('web-server-start', port, hostname),
        stop: () => ipcRenderer.invoke('web-server-stop'),
        getStatus: () => ipcRenderer.invoke('web-server-status'),
        updateState: (state) => ipcRenderer.invoke('web-server-update-state', state),
        updateVariables: (variableValues, variableHtmlValues) => ipcRenderer.invoke('web-server-update-variables', variableValues, variableHtmlValues)
    },
    onSyncStateFromBrowser: (callback) => {
        ipcRenderer.on('sync-state-from-browser', (event, stateData) => callback(stateData));
    },
    openExternal: (url) => ipcRenderer.invoke('open-external', url)
});