const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    webServer: {
        start: (port) => ipcRenderer.invoke('web-server-start', port),
        stop: () => ipcRenderer.invoke('web-server-stop'),
        getStatus: () => ipcRenderer.invoke('web-server-status'),
        updateState: (state) => ipcRenderer.invoke('web-server-update-state', state)
    }
});