import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development';

// Path to store window state
const windowStateFile = path.join(app.getPath('userData'), 'window-state.json');

const isMac = process.platform === 'darwin';


// Default window dimensions
const defaultWindowState = {
    width: 1200,
    height: 1000,
    x: undefined,
    y: undefined,
    isMaximized: false
};

function loadWindowState() {
    try {
        const data = fs.readFileSync(windowStateFile, 'utf8');
        return { ...defaultWindowState, ...JSON.parse(data) };
    } catch (error) {
        return defaultWindowState;
    }
}

function saveWindowState(windowState) {
    try {
        fs.writeFileSync(windowStateFile, JSON.stringify(windowState, null, 2));
    } catch (error) {
        console.error('Failed to save window state:', error);
    }
}

let mainWindow;

function createWindow() {
    const windowState = loadWindowState();

    mainWindow = new BrowserWindow({
        width: windowState.width,
        height: windowState.height,
        frame: !isMac,
        titleBarStyle: isMac ? 'customButtonsOnHover' : undefined,
        x: windowState.x,
        y: windowState.y,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false
        }
    });

    // Restore maximized state
    if (windowState.isMaximized) {
        mainWindow.maximize();
    }

    // Save window state when it's resized or moved
    const saveState = () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            const bounds = mainWindow.getBounds();
            const isMaximized = mainWindow.isMaximized();

            saveWindowState({
                ...bounds,
                isMaximized
            });
        }
    };

    mainWindow.on('resize', saveState);
    mainWindow.on('move', saveState);
    mainWindow.on('maximize', saveState);
    mainWindow.on('unmaximize', saveState);

    // Save state when window is closed
    mainWindow.on('close', saveState);

    // Load the app
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173'); // Vite dev server
        mainWindow.webContents.openDevTools(); // Open DevTools in development
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();

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