const { contextBridge, ipcRenderer } = require('electron');

// Extract window ID from command line arguments
const windowIdArg = process.argv.find(arg => arg.startsWith('--window-id='));
const windowId = windowIdArg ? windowIdArg.split('=')[1] : '1';

contextBridge.exposeInMainWorld('electronAPI', {
    windowId: windowId,
    webServer: {
        start: (port) => ipcRenderer.invoke('web-server-start', port),
        stop: () => ipcRenderer.invoke('web-server-stop'),
        getStatus: () => ipcRenderer.invoke('web-server-status'),
        updateState: (state) => ipcRenderer.invoke('web-server-update-state', state)
    },
    onSyncStateFromBrowser: (callback) => {
        ipcRenderer.on('sync-state-from-browser', (event, stateData) => callback(stateData));
    }
});