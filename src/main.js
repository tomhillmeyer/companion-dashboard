import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import DashboardWebServer from './webServer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development';

// Path to store window states
const windowStateFile = path.join(app.getPath('userData'), 'window-states.json');

const isMac = process.platform === 'darwin';


// Default window dimensions
const defaultWindowState = {
    width: 1200,
    height: 1000,
    x: undefined,
    y: undefined,
    isMaximized: false
};

// Track all windows and their web servers
let windows = new Map();
let windowWebServers = new Map(); // windowId -> webServer instance
let windowCounter = 0;
let windowAlwaysOnTopStates = new Map(); // windowId -> boolean

function loadWindowStates() {
    try {
        console.log('Loading window states from:', windowStateFile);
        const data = fs.readFileSync(windowStateFile, 'utf8');
        console.log('Raw window state data:', data);
        const states = JSON.parse(data);
        const result = Array.isArray(states) ? states : [states]; // Handle old single window format
        console.log('Parsed window states:', result);
        return result;
    } catch (error) {
        console.log('Failed to load window states:', error.message);
        return [];
    }
}

function saveWindowStates() {
    try {
        console.log('Saving window states. Current windows:', windows.size);
        const states = Array.from(windows.values()).map(window => {
            if (window && !window.isDestroyed()) {
                const bounds = window.getBounds();
                const isMaximized = window.isMaximized();
                const webServer = windowWebServers.get(window.windowId);

                const state = {
                    ...bounds,
                    isMaximized,
                    id: window.windowId,
                    alwaysOnTop: windowAlwaysOnTopStates.get(window.windowId) || false,
                    webServer: webServer ? {
                        isRunning: webServer.isServerRunning(),
                        port: webServer.getPort()
                    } : null
                };
                console.log('Saving window state:', state);
                return state;
            }
            return null;
        }).filter(Boolean);

        console.log('Final states to save:', states);
        fs.writeFileSync(windowStateFile, JSON.stringify(states, null, 2));
        console.log('Window states saved successfully');
    } catch (error) {
        console.error('Failed to save window states:', error);
    }
}

function createWindow(windowState = null) {
    const state = windowState || { ...defaultWindowState };

    // Use existing window ID if restoring, otherwise create new one
    let windowId;
    if (windowState && windowState.id) {
        windowId = windowState.id;
        // Make sure windowCounter is at least as high as restored IDs
        windowCounter = Math.max(windowCounter, windowId);
    } else {
        windowId = ++windowCounter;
    }

    // Offset new windows slightly so they don't overlap exactly
    if (!windowState && windows.size > 0) {
        state.x = (state.x || 100) + (windows.size * 30);
        state.y = (state.y || 100) + (windows.size * 30);
    }

    const window = new BrowserWindow({
        width: state.width,
        height: state.height,
        frame: !isMac,
        titleBarStyle: isMac ? 'customButtonsOnHover' : undefined,
        x: state.x,
        y: state.y,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js'),
            additionalArguments: [`--window-id=${windowId}`]
        }
    });

    // Store window ID for tracking and create dedicated web server
    window.windowId = windowId;
    windows.set(windowId, window);

    // Create a dedicated web server for this window
    const webServer = new DashboardWebServer();
    windowWebServers.set(windowId, webServer);

    // Restore maximized state
    if (state.isMaximized) {
        window.maximize();
    }

    // Restore always on top state
    if (state.alwaysOnTop) {
        window.setAlwaysOnTop(true);
        windowAlwaysOnTopStates.set(windowId, true);
    }

    // Save window states when any window changes
    const saveState = () => {
        saveWindowStates();
    };

    window.on('resize', saveState);
    window.on('move', saveState);
    window.on('maximize', saveState);
    window.on('unmaximize', saveState);

    // Update menu when window focus changes
    window.on('focus', () => {
        createMenu();
    });

    // Don't save on individual window close - it interferes with web server state
    // State is already saved when web servers start/stop

    // Clean up when window is closed
    window.on('closed', () => {
        // Stop and clean up the web server for this window
        const webServer = windowWebServers.get(windowId);
        if (webServer && webServer.isServerRunning()) {
            webServer.stop();
        }
        windowWebServers.delete(windowId);
        windowAlwaysOnTopStates.delete(windowId);

        windows.delete(windowId);
        console.log('Window closed and cleaned up, remaining windows:', windows.size);
    });

    // Load the app
    if (isDev) {
        window.loadURL('http://localhost:5173'); // Vite dev server
        if (windows.size === 1) { // Only open DevTools for first window
            window.webContents.openDevTools();
        }
    } else {
        window.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Restore web server if it was running when the window was closed
    if (windowState && windowState.webServer) {
        console.log('Window has web server state:', windowState.webServer);
        if (windowState.webServer.isRunning) {
            console.log('Restoring web server for window', windowId, 'on port', windowState.webServer.port);

            // Wait for the window to finish loading before starting the web server
            window.webContents.once('did-finish-load', () => {
                console.log('Window finished loading, starting web server');
                const webServer = windowWebServers.get(windowId);
                if (webServer) {
                    setTimeout(() => {
                        console.log('Starting restored web server on port', windowState.webServer.port);
                        try {
                            webServer.start(windowState.webServer.port);
                            console.log('Web server restoration completed');
                        } catch (error) {
                            console.error('Failed to start restored web server:', error);
                        }
                    }, 2000); // Increased delay to ensure React app is ready
                } else {
                    console.error('No web server instance found for window', windowId);
                }
            });
        } else {
            console.log('Web server was not running when window was closed');
        }
    } else {
        console.log('No web server state found for this window');
    }

    return window;
}

// Toggle always on top for the focused window
function toggleAlwaysOnTop() {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow && focusedWindow.windowId) {
        const currentState = windowAlwaysOnTopStates.get(focusedWindow.windowId) || false;
        const newState = !currentState;

        focusedWindow.setAlwaysOnTop(newState);
        windowAlwaysOnTopStates.set(focusedWindow.windowId, newState);

        // Update the menu to reflect the new state
        createMenu();

        // Save window states
        saveWindowStates();
    }
}

// Create application menu
function createMenu() {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    const isAlwaysOnTop = focusedWindow && focusedWindow.windowId ?
        (windowAlwaysOnTopStates.get(focusedWindow.windowId) || false) : false;

    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Window',
                    click: () => {
                        createWindow();
                    }
                },
                { type: 'separator' },
                {
                    label: 'Close Window',
                    accelerator: 'CmdOrCtrl+W',
                    role: 'close'
                }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectall' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'close' },
                { type: 'separator' },
                {
                    label: 'Always on top',
                    type: 'checkbox',
                    checked: isAlwaysOnTop,
                    click: toggleAlwaysOnTop
                }
            ]
        }
    ];

    if (isMac) {
        template.unshift({
            label: app.getName(),
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                {
                    label: 'New Window',
                    click: () => {
                        createWindow();
                    }
                },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideothers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        });

        // macOS Window menu
        template[4].submenu = [
            { role: 'close' },
            { role: 'minimize' },
            { role: 'zoom' },
            { type: 'separator' },
            { role: 'front' },
            { type: 'separator' },
            {
                label: 'Always on top',
                type: 'checkbox',
                checked: isAlwaysOnTop,
                click: toggleAlwaysOnTop
            }
        ];
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
    createMenu();

    // Restore saved windows or create a default one
    const savedStates = loadWindowStates();
    console.log('App starting. Found', savedStates.length, 'saved window states');
    if (savedStates.length > 0) {
        console.log('Restoring windows...');
        savedStates.forEach((state, index) => {
            console.log(`Creating window ${index + 1} with state:`, state);
            createWindow(state);
        });
    } else {
        console.log('No saved states, creating default window');
        createWindow();
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Helper function to get web server for the calling window
function getWebServerForWindow(event) {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (!senderWindow || !senderWindow.windowId) {
        throw new Error('Could not identify sender window');
    }

    const webServer = windowWebServers.get(senderWindow.windowId);
    if (!webServer) {
        throw new Error('No web server found for this window');
    }

    return webServer;
}

// Helper function to find available port starting from a base port
async function findAvailablePort(startPort, windowId) {
    const basePort = startPort || (8100 + windowId - 1); // Start from 8100, 8101, 8102, etc.

    // For now, just return the calculated port based on window ID
    // In a production app, you'd want to check if the port is actually available
    return basePort;
}

// IPC handlers for web server (per-window)
ipcMain.handle('web-server-start', async (event, port) => {
    try {
        const webServer = getWebServerForWindow(event);
        const senderWindow = BrowserWindow.fromWebContents(event.sender);

        // Auto-assign port based on window ID if not specified
        const targetPort = port || await findAvailablePort(8100, senderWindow.windowId);

        webServer.start(targetPort);

        // Wait for server to actually start before saving states
        setTimeout(() => {
            console.log('Web server started, saving window states');
            saveWindowStates();
        }, 100); // Small delay to ensure server is running

        return { success: true, port: webServer.getPort() };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('web-server-stop', async (event) => {
    try {
        const webServer = getWebServerForWindow(event);
        webServer.stop();

        // Save window states when web server stops
        console.log('Web server stopped, saving window states');
        saveWindowStates();

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('web-server-status', async (event) => {
    try {
        const webServer = getWebServerForWindow(event);
        return {
            isRunning: webServer.isServerRunning(),
            port: webServer.getPort(),
            endpoints: webServer.isServerRunning() ? webServer.getEndpoints() : []
        };
    } catch (error) {
        return {
            isRunning: false,
            port: null,
            endpoints: []
        };
    }
});

ipcMain.handle('web-server-update-state', async (event, state) => {
    try {
        const webServer = getWebServerForWindow(event);
        webServer.updateState(state);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Clean up on app quit
app.on('before-quit', (event) => {
    console.log('App is quitting. Current windows:', windows.size);

    // Don't save states here - they're already saved when web servers start/stop
    // This prevents overwriting the correct web server states

    // Stop all web servers
    console.log('Stopping web servers on quit');
    windowWebServers.forEach(webServer => {
        if (webServer.isServerRunning()) {
            console.log('Stopping web server on port', webServer.getPort());
            webServer.stop();
        }
    });
});