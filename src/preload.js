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
        getStatus: (pages) => ipcRenderer.invoke('web-server-status', pages),
        updateState: (state) => ipcRenderer.invoke('web-server-update-state', state),
        updateVariables: (variableValues, variableHtmlValues) => ipcRenderer.invoke('web-server-update-variables', variableValues, variableHtmlValues),
        sendWebRTCSignal: (data) => ipcRenderer.invoke('web-server-send-webrtc-signal', data)
    },
    onSyncStateFromBrowser: (callback) => {
        ipcRenderer.on('sync-state-from-browser', (event, stateData) => callback(stateData));
    },
    onWebRTCSignaling: (callback) => {
        ipcRenderer.on('webrtc-signaling', (event, data) => callback(data));
    },
    onMDNSStatusChanged: (callback) => {
        ipcRenderer.on('mdns-status-changed', () => callback());
    },
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    getSystemFonts: () => ipcRenderer.invoke('get-system-fonts')
});