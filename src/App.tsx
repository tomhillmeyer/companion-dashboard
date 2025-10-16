import { useState, useEffect, useRef } from 'react';
import { v4 as uuid } from 'uuid';
import Box from './Box.tsx';
import SettingsMenu from './SettingsMenu.tsx';
import './App.css';
import defaultBoxes from './defaultBoxes.json';
import dashboardLogo from './assets/dashboard.png';
import { useVariableFetcher } from './useVariableFetcher';
import { TitleBar } from './TitleBar.tsx';


// Get window ID for isolated storage
const getWindowId = () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.windowId) {
        return (window as any).electronAPI.windowId;
    }
    // Fallback to a consistent default for now
    return '1';
};

const windowId = getWindowId();
const STORAGE_KEY = `window_${windowId}_boxes`;
const CANVAS_STORAGE_KEY = `window_${windowId}_canvas_settings`;
const CONNECTIONS_STORAGE_KEY = `window_${windowId}_companion_connections`;
const FONT_STORAGE_KEY = `global_font_family`;

interface CompanionConnection {
    id: string;
    url: string;
    label: string;
}

export interface VariableColor {
    id: string;
    variable: string;
    value: string;
    color: string;
}

export interface BoxData {
    id: string;
    frame: { translate: [number, number]; width: number; height: number };
    zIndex: number;
    backgroundColor: string;
    backgroundColorText: string;
    backgroundVariableColors: VariableColor[];
    backgroundImage?: string;
    backgroundImageSize?: 'cover' | 'contain';
    backgroundImageOpacity?: number;
    borderColor: string;
    borderColorText: string;
    borderVariableColors: VariableColor[];
    noBorder: boolean;
    headerColor: string;
    headerColorText: string;
    headerVariableColors: VariableColor[];
    headerLabelSource: string;
    headerLabel: string;
    headerLabelSize: number;
    headerLabelColor: string;
    headerLabelColorText: string;
    headerLabelVariableColors: VariableColor[];
    headerLabelVisible: boolean;
    leftLabelSource: string;
    leftLabel: string;
    leftLabelSize: number;
    leftLabelColor: string;
    leftLabelColorText: string;
    leftLabelVariableColors: VariableColor[];
    leftVisible: boolean;
    rightLabelSource: string;
    rightLabel: string;
    rightLabelSize: number;
    rightLabelColor: string;
    rightLabelColorText: string;
    rightLabelVariableColors: VariableColor[];
    rightVisible: boolean;
}





export default function App() {
    // Initialize state with localStorage data immediately
    const [boxes, setBoxes] = useState<BoxData[]>(() => {
        const savedBoxes = localStorage.getItem(STORAGE_KEY);
        if (savedBoxes) {
            try {
                return JSON.parse(savedBoxes);
            } catch (error) {
                console.error('Failed to parse saved boxes:', error);
                return defaultBoxes;
            }
        } else {
            return defaultBoxes;
        }
    });




    const handleConfigRestore = (newBoxes: BoxData[], newConnectionUrl: string, canvasSettings?: any) => {
        console.log('handleConfigRestore called with URL:', newConnectionUrl);
        console.log('Current companionBaseUrl before update:', companionBaseUrl);
        setBoxes(newBoxes);
        setCompanionBaseUrl(newConnectionUrl);
        console.log('Called setCompanionBaseUrl with:', newConnectionUrl);
        setSelectedBoxId(null); // Clear any selection

        // Apply canvas settings if provided
        if (canvasSettings) {
            if (canvasSettings.canvasBackgroundColor !== undefined) {
                setCanvasBackgroundColor(canvasSettings.canvasBackgroundColor);
            }
            if (canvasSettings.canvasBackgroundColorText !== undefined) {
                setCanvasBackgroundColorText(canvasSettings.canvasBackgroundColorText);
            }
            if (canvasSettings.canvasBackgroundVariableColors !== undefined) {
                setCanvasBackgroundVariableColors(canvasSettings.canvasBackgroundVariableColors);
            }
            if (canvasSettings.canvasBackgroundImageOpacity !== undefined) {
                setCanvasBackgroundImageOpacity(canvasSettings.canvasBackgroundImageOpacity);
            }
            if (canvasSettings.refreshRateMs !== undefined) {
                setRefreshRateMs(canvasSettings.refreshRateMs);
            }
        }
    };

    const deleteAllBoxes = () => {
        setBoxes([]);
        setSelectedBoxId(null); // Clear any selection
    };

    const duplicateBox = (originalBoxData: BoxData) => {
        const duplicatedBox: BoxData = {
            ...originalBoxData,
            id: uuid(), // New unique ID
            frame: {
                ...originalBoxData.frame,
                translate: [
                    originalBoxData.frame.translate[0] + 20, // Offset by 20px
                    originalBoxData.frame.translate[1] + 20
                ] as [number, number]
            }
        };
        setBoxes((prev) => [...prev, duplicatedBox]);
    };


    const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [isConnected, setIsConnected] = useState<boolean>(true);
    const reconnectIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Track dragging state globally for WebSocket sync
    useEffect(() => {
        (window as any).isDraggingBox = isDragging;
        console.log('Dragging state changed:', isDragging);
    }, [isDragging]);
    const [companionBaseUrl, setCompanionBaseUrl] = useState<string>(() => {
        return localStorage.getItem('companion_connection_url') || '';
    });
    const [connections, setConnections] = useState<CompanionConnection[]>([]);

    // Canvas background color state - initialize from localStorage
    const [canvasBackgroundColor, setCanvasBackgroundColor] = useState<string>(() => {
        const saved = localStorage.getItem(CANVAS_STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return parsed.canvasBackgroundColor || '#000000';
            } catch (error) {
                console.error('Failed to parse canvas settings:', error);
                return '#000000';
            }
        }
        return '#000000';
    });
    const [canvasBackgroundColorText, setCanvasBackgroundColorText] = useState<string>(() => {
        const saved = localStorage.getItem(CANVAS_STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return parsed.canvasBackgroundColorText || '';
            } catch (error) {
                return '';
            }
        }
        return '';
    });
    const [canvasBackgroundVariableColors, setCanvasBackgroundVariableColors] = useState<VariableColor[]>(() => {
        const saved = localStorage.getItem(CANVAS_STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return parsed.canvasBackgroundVariableColors || [];
            } catch (error) {
                return [];
            }
        }
        return [];
    });
    const [canvasBackgroundImageOpacity, setCanvasBackgroundImageOpacity] = useState<number>(() => {
        const saved = localStorage.getItem(CANVAS_STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return parsed.canvasBackgroundImageOpacity || 100;
            } catch (error) {
                return 100;
            }
        }
        return 100;
    });
    const [refreshRateMs, setRefreshRateMs] = useState<number>(() => {
        const saved = localStorage.getItem(CANVAS_STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return parsed.refreshRateMs || 100;
            } catch (error) {
                return 100;
            }
        }
        return 100;
    });

    // Font family state - initialize from localStorage
    const [fontFamily, setFontFamily] = useState<string>(() => {
        return localStorage.getItem(FONT_STORAGE_KEY) || 'Work Sans';
    });

    // Apply font immediately on component mount
    useEffect(() => {
        const savedFont = localStorage.getItem(FONT_STORAGE_KEY) || 'Work Sans';
        document.documentElement.style.setProperty('--box-font-family', `"${savedFont}", system-ui, Avenir, Helvetica, Arial, sans-serif`);
    }, []);

    const settingsMenuRef = useRef<{ toggle: () => void }>(null);

    // Save boxes to localStorage whenever boxes state changes
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(boxes));
    }, [boxes]);

    // Save canvas settings to localStorage whenever canvas state changes
    useEffect(() => {
        const canvasSettings = {
            canvasBackgroundColor,
            canvasBackgroundColorText,
            canvasBackgroundVariableColors,
            canvasBackgroundImageOpacity,
            refreshRateMs
        };
        localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify(canvasSettings));
    }, [canvasBackgroundColor, canvasBackgroundColorText, canvasBackgroundVariableColors, canvasBackgroundImageOpacity, refreshRateMs]);

    // Save companion connection URL to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('companion_connection_url', companionBaseUrl);
    }, [companionBaseUrl]);

    // Save font family to localStorage whenever it changes and apply to boxes only
    useEffect(() => {
        localStorage.setItem(FONT_STORAGE_KEY, fontFamily);
        // Apply font only to boxes by setting CSS custom property
        document.documentElement.style.setProperty('--box-font-family', `"${fontFamily}", system-ui, Avenir, Helvetica, Arial, sans-serif`);
    }, [fontFamily]);

    // Load connections from localStorage on component mount
    useEffect(() => {
        const savedConnections = localStorage.getItem(CONNECTIONS_STORAGE_KEY);
        if (savedConnections) {
            try {
                const parsed = JSON.parse(savedConnections);
                setConnections(parsed);
            } catch (error) {
                console.error('Failed to parse saved connections:', error);
            }
        }
    }, []);

    // Collect canvas variable names for fetching
    const getCanvasVariableNames = () => {
        const allVariables: { [key: string]: string } = {};

        // Add canvas background color text if it exists
        if (canvasBackgroundColorText) {
            allVariables[canvasBackgroundColorText] = canvasBackgroundColorText;
        }

        // Add canvas variable colors
        if (canvasBackgroundVariableColors && Array.isArray(canvasBackgroundVariableColors)) {
            canvasBackgroundVariableColors.forEach(varColor => {
                if (varColor.variable) {
                    allVariables[varColor.variable] = varColor.variable;
                }
            });
        }

        return allVariables;
    };


    // Collect all variable names from all boxes and canvas
    const getAllVariableNames = () => {
        const allVariables: { [key: string]: string } = {};

        // Add canvas variable names
        Object.assign(allVariables, getCanvasVariableNames());

        // Add box variable names
        boxes.forEach(box => {
            // Add label sources
            if (box.headerLabelSource) allVariables[box.headerLabelSource] = box.headerLabelSource;
            if (box.leftLabelSource) allVariables[box.leftLabelSource] = box.leftLabelSource;
            if (box.rightLabelSource) allVariables[box.rightLabelSource] = box.rightLabelSource;

            // Add color text sources
            if (box.backgroundColorText) allVariables[box.backgroundColorText] = box.backgroundColorText;
            if (box.borderColorText) allVariables[box.borderColorText] = box.borderColorText;
            if (box.headerColorText) allVariables[box.headerColorText] = box.headerColorText;
            if (box.headerLabelColorText) allVariables[box.headerLabelColorText] = box.headerLabelColorText;
            if (box.leftLabelColorText) allVariables[box.leftLabelColorText] = box.leftLabelColorText;
            if (box.rightLabelColorText) allVariables[box.rightLabelColorText] = box.rightLabelColorText;

            // Add variable color variables
            [
                box.backgroundVariableColors,
                box.borderVariableColors,
                box.headerVariableColors,
                box.headerLabelVariableColors,
                box.leftLabelVariableColors,
                box.rightLabelVariableColors
            ].forEach(varColors => {
                if (varColors && Array.isArray(varColors)) {
                    varColors.forEach(varColor => {
                        if (varColor.variable) {
                            allVariables[varColor.variable] = varColor.variable;
                        }
                    });
                }
            });
        });

        return allVariables;
    };

    // Use variable fetcher for all variables (canvas + boxes)
    const { values: allVariableValues, htmlValues: allHtmlVariableValues } = useVariableFetcher(companionBaseUrl, getAllVariableNames(), connections, refreshRateMs, isDragging);

    // Update web server state when dashboard state changes
    useEffect(() => {
        const updateWebServer = async () => {
            try {
                const canvasSettings = {
                    canvasBackgroundColor,
                    canvasBackgroundColorText,
                    canvasBackgroundVariableColors,
                    canvasBackgroundImageOpacity,
                    refreshRateMs
                };

                // Collect all image references from dashboard state
                const imageRefs = new Set<string>();
                
                // Check canvas background
                if (canvasBackgroundColorText && canvasBackgroundColorText.startsWith('./src/assets/')) {
                    const filename = canvasBackgroundColorText.replace('./src/assets/', '');
                    imageRefs.add(filename);
                }
                
                // Check all boxes for background images
                boxes.forEach(box => {
                    if (box.backgroundImage && box.backgroundImage.startsWith('./src/assets/')) {
                        const filename = box.backgroundImage.replace('./src/assets/', '');
                        imageRefs.add(filename);
                    }
                    if (box.backgroundColorText && box.backgroundColorText.startsWith('./src/assets/')) {
                        const filename = box.backgroundColorText.replace('./src/assets/', '');
                        imageRefs.add(filename);
                    }
                });

                // Load image data for all referenced images
                const imageData: { [key: string]: string } = {};
                for (const filename of imageRefs) {
                    const data = await getImageFromDB(filename);
                    if (data) {
                        imageData[filename] = data;
                    }
                }

                const state = {
                    boxes,
                    canvasSettings,
                    connections,
                    companionBaseUrl,
                    variableValues: allVariableValues,
                    htmlVariableValues: allHtmlVariableValues,
                    imageData,
                    fontFamily
                };

                // @ts-ignore - electronAPI is available via preload script
                await window.electronAPI?.webServer.updateState(state);
            } catch (error) {
                // Silently fail if web server is not available or not running
                console.debug('Web server update failed:', error);
            }
        };

        updateWebServer();
    }, [boxes, canvasBackgroundColor, canvasBackgroundColorText, canvasBackgroundVariableColors, canvasBackgroundImageOpacity, refreshRateMs, connections, companionBaseUrl, allVariableValues, allHtmlVariableValues, fontFamily]);

    // WebSocket sync for full app server (when running in browser)
    useEffect(() => {
        const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;
        console.log('Sync effect running. isElectron:', isElectron);

        // If running in Electron, listen for state changes from browser clients
        if (isElectron) {
            console.log('Setting up Electron listener for browser state changes');
            (window as any).electronAPI.onSyncStateFromBrowser((stateData: any) => {
                console.log('✅ Syncing state from browser client to Electron', stateData);

                // Update all state from incoming browser data
                if (stateData.boxes) {
                    setBoxes(stateData.boxes);
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateData.boxes));
                }

                if (stateData.canvasSettings) {
                    const cs = stateData.canvasSettings;
                    if (cs.canvasBackgroundColor !== undefined) setCanvasBackgroundColor(cs.canvasBackgroundColor);
                    if (cs.canvasBackgroundColorText !== undefined) setCanvasBackgroundColorText(cs.canvasBackgroundColorText);
                    if (cs.canvasBackgroundVariableColors !== undefined) setCanvasBackgroundVariableColors(cs.canvasBackgroundVariableColors);
                    if (cs.canvasBackgroundImageOpacity !== undefined) setCanvasBackgroundImageOpacity(cs.canvasBackgroundImageOpacity);
                    if (cs.refreshRateMs !== undefined) setRefreshRateMs(cs.refreshRateMs);
                    localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify(cs));
                }

                if (stateData.connections) {
                    setConnections(stateData.connections);
                    localStorage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(stateData.connections));
                }

                if (stateData.companionBaseUrl !== undefined) {
                    setCompanionBaseUrl(stateData.companionBaseUrl);
                    localStorage.setItem('companion_connection_url', stateData.companionBaseUrl);
                }

                if (stateData.fontFamily !== undefined) {
                    setFontFamily(stateData.fontFamily);
                    localStorage.setItem(FONT_STORAGE_KEY, stateData.fontFamily);
                    document.documentElement.style.setProperty('--box-font-family', `"${stateData.fontFamily}", system-ui, Avenir, Helvetica, Arial, sans-serif`);
                }
            });
        }

        // If running in browser (not Electron), connect to WebSocket
        if (!isElectron) {
            console.log('Running in browser, connecting to WebSocket...');

            const connectWebSocket = () => {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                // Include the current path so server knows if this is /full or read-only
                const path = window.location.pathname.startsWith('/full') ? '/full' : '/';
                const wsUrl = `${protocol}//${window.location.host}${path}`;
                console.log('WebSocket URL:', wsUrl);

                const ws = new WebSocket(wsUrl);

                ws.onopen = () => {
                    console.log('✅ Connected to full app server for bidirectional sync');
                    setIsConnected(true);

                    // Clear reconnect interval if it exists
                    if (reconnectIntervalRef.current) {
                        clearInterval(reconnectIntervalRef.current);
                        reconnectIntervalRef.current = null;
                    }
                };

                ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        console.log('📨 Received WebSocket message:', message.type);

                        if (message.type === 'stateUpdate' && message.data) {
                            const data = message.data;

                            // If user is actively dragging, ignore incoming updates completely
                            if ((window as any).isDraggingBox) {
                                console.log('⏸️ Dragging in progress, ignoring incoming update');
                                return;
                            }

                            console.log('📥 Received state update from Electron', data);

                            // Set flag to prevent sending this update back
                            (window as any).isReceivingUpdate = true;

                            // Update boxes
                            if (data.boxes) {
                                console.log('Updating boxes:', data.boxes.length);
                                setBoxes(data.boxes);
                                localStorage.setItem(STORAGE_KEY, JSON.stringify(data.boxes));
                            }

                            // Update canvas settings
                            if (data.canvasSettings) {
                                const cs = data.canvasSettings;
                                console.log('Updating canvas settings');
                                if (cs.canvasBackgroundColor !== undefined) setCanvasBackgroundColor(cs.canvasBackgroundColor);
                                if (cs.canvasBackgroundColorText !== undefined) setCanvasBackgroundColorText(cs.canvasBackgroundColorText);
                                if (cs.canvasBackgroundVariableColors !== undefined) setCanvasBackgroundVariableColors(cs.canvasBackgroundVariableColors);
                                if (cs.canvasBackgroundImageOpacity !== undefined) setCanvasBackgroundImageOpacity(cs.canvasBackgroundImageOpacity);
                                if (cs.refreshRateMs !== undefined) setRefreshRateMs(cs.refreshRateMs);
                                localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify(cs));
                            }

                            // Update connections
                            if (data.connections) {
                                console.log('Updating connections');
                                setConnections(data.connections);
                                localStorage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(data.connections));
                            }

                            // Update companion base URL
                            if (data.companionBaseUrl !== undefined) {
                                console.log('Updating companion base URL:', data.companionBaseUrl);
                                setCompanionBaseUrl(data.companionBaseUrl);
                                localStorage.setItem('companion_connection_url', data.companionBaseUrl);
                            }

                            // Update font family
                            if (data.fontFamily !== undefined) {
                                console.log('Updating font family:', data.fontFamily);
                                setFontFamily(data.fontFamily);
                                localStorage.setItem(FONT_STORAGE_KEY, data.fontFamily);
                                document.documentElement.style.setProperty('--box-font-family', `"${data.fontFamily}", system-ui, Avenir, Helvetica, Arial, sans-serif`);
                            }
                        }
                    } catch (error) {
                        console.error('❌ Error processing WebSocket message:', error);
                    }
                };

                ws.onerror = (error) => {
                    console.error('❌ WebSocket error:', error);
                    setIsConnected(false);
                };

                ws.onclose = () => {
                    console.log('⚠️ Disconnected from full app server');
                    setIsConnected(false);

                    // Start reconnection attempts
                    if (!reconnectIntervalRef.current) {
                        reconnectIntervalRef.current = setInterval(() => {
                            console.log('Attempting to reconnect...');
                            connectWebSocket();
                        }, 3000);
                    }
                };

                // Store WebSocket instance for sending changes
                (window as any).fullAppServerWS = ws;

                return ws;
            };

            const ws = connectWebSocket();

            return () => {
                console.log('Cleaning up WebSocket connection');
                if (reconnectIntervalRef.current) {
                    clearInterval(reconnectIntervalRef.current);
                    reconnectIntervalRef.current = null;
                }
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close();
                }
            };
        }
    }, []);

    // Send state changes from browser to Electron via WebSocket (only user-initiated changes)
    useEffect(() => {
        const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;

        // Don't send while dragging
        if (isDragging) {
            console.log('⏸️ Skipping send - drag in progress');
            return;
        }

        // Don't send if we're currently receiving an update (prevents infinite loop)
        if ((window as any).isReceivingUpdate) {
            console.log('⏭️ Skipping send - currently receiving update');
            (window as any).isReceivingUpdate = false; // Reset for next change
            return;
        }

        if (!isElectron && (window as any).fullAppServerWS) {
            const ws = (window as any).fullAppServerWS;

            if (ws.readyState === WebSocket.OPEN) {
                console.log('📤 Sending state change to Electron');
                const stateData = {
                    boxes,
                    canvasSettings: {
                        canvasBackgroundColor,
                        canvasBackgroundColorText,
                        canvasBackgroundVariableColors,
                        canvasBackgroundImageOpacity,
                        refreshRateMs
                    },
                    connections,
                    companionBaseUrl,
                    fontFamily
                };

                ws.send(JSON.stringify({
                    type: 'stateChange',
                    data: stateData
                }));
            } else {
                console.log('⚠️ WebSocket not ready, state:', ws.readyState);
            }
        }
    }, [boxes, canvasBackgroundColor, canvasBackgroundColorText, canvasBackgroundVariableColors, canvasBackgroundImageOpacity, refreshRateMs, connections, companionBaseUrl, fontFamily]);

    // Canvas color resolution function (same as Box component)
    const resolveCanvasColor = (variableColors: VariableColor[], colorText: string, fallbackColor: string) => {
        // 1. Check variable colors first - find first matching variable that evaluates to true
        if (variableColors && Array.isArray(variableColors)) {
            for (const varColor of variableColors) {
                if (varColor && varColor.variable && varColor.value) {
                    const variableValue = allVariableValues[varColor.variable] || '';
                    if (variableValue === varColor.value) {
                        return varColor.color;
                    }
                }
            }
        }

        // 2. If no variable colors match, check if colorText has a value
        if (colorText && colorText.trim()) {
            return allVariableValues[colorText] || colorText;
        }

        // 3. Fall back to the picker color
        return fallbackColor;
    };

    // Calculate the actual canvas background color
    const actualCanvasBackgroundColor = resolveCanvasColor(
        canvasBackgroundVariableColors,
        canvasBackgroundColorText,
        canvasBackgroundColor
    );

    // Check if the resolved color is an image (http/https URL, data URL, or ends with image extensions)
    const isImageUrl = (value: string) => {
        if (!value || typeof value !== 'string') return false;
        try {
            // Check for HTTP URLs
            if (value.startsWith('http://') || value.startsWith('https://')) return true;
            // Check for base64 data URLs
            if (value.startsWith('data:image/')) return true;
            // Check for image extensions
            return /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(value);
        } catch (error) {
            console.error('Error in isImageUrl:', error);
            return false;
        }
    };

    // State for loaded background image
    const [loadedBackgroundImage, setLoadedBackgroundImage] = useState<string | null>(null);

    // IndexedDB helper function for App.tsx
    const getImageFromDB = async (filename: string): Promise<string | null> => {
        try {
            const request = indexedDB.open('CompanionDashboardImages', 3);
            return new Promise((resolve) => {
                request.onerror = () => resolve(null); // Gracefully handle errors
                request.onsuccess = () => {
                    const db = request.result;
                    // Check if object store exists
                    if (!db.objectStoreNames.contains('images')) {
                        resolve(null);
                        return;
                    }

                    try {
                        const transaction = db.transaction(['images'], 'readonly');
                        const store = transaction.objectStore('images');
                        const getRequest = store.get(filename);

                        getRequest.onerror = () => resolve(null);
                        getRequest.onsuccess = () => {
                            const result = getRequest.result;
                            resolve(result ? result.data : null);
                        };
                    } catch (transactionError) {
                        console.error('IndexedDB transaction error:', transactionError);
                        resolve(null);
                    }
                };
                request.onupgradeneeded = (event) => {
                    const db = (event.target as IDBOpenDBRequest).result;
                    if (!db.objectStoreNames.contains('images')) {
                        db.createObjectStore('images', { keyPath: 'id' });
                    }
                };
            });
        } catch (error) {
            console.error('IndexedDB error:', error);
            return null;
        }
    };

    // Effect to load background image from IndexedDB when needed
    useEffect(() => {
        const loadBackgroundImage = async () => {
            if (actualCanvasBackgroundColor && typeof actualCanvasBackgroundColor === 'string' && actualCanvasBackgroundColor.startsWith('./src/assets/background_')) {
                const filename = actualCanvasBackgroundColor.split('/').pop();
                if (filename) {
                    // Try IndexedDB first
                    let cachedBase64 = await getImageFromDB(filename);
                    // Fallback to localStorage
                    if (!cachedBase64) {
                        cachedBase64 = localStorage.getItem(`window_${windowId}_cached_bg_${filename}`);
                    }
                    setLoadedBackgroundImage(cachedBase64);
                }
            } else {
                setLoadedBackgroundImage(null);
            }
        };

        loadBackgroundImage();
    }, [actualCanvasBackgroundColor]);

    // Generate background style with layered backgrounds
    const getCanvasBackgroundStyle = () => {
        const baseColor = resolveCanvasColor(
            canvasBackgroundVariableColors,
            canvasBackgroundColorText,
            canvasBackgroundColor
        );
        
        const opacity = canvasBackgroundImageOpacity / 100;
        
        // Check if the resolved background color is actually an image URL
        if (isImageUrl(actualCanvasBackgroundColor)) {
            let imageUrl = actualCanvasBackgroundColor;

            // Check if this is a cached image reference and we have loaded data
            if (actualCanvasBackgroundColor && typeof actualCanvasBackgroundColor === 'string' && actualCanvasBackgroundColor.startsWith('./src/assets/background_') && loadedBackgroundImage) {
                imageUrl = loadedBackgroundImage;
            }
            
            return {
                backgroundColor: canvasBackgroundColor, // Always use the solid color picker value as base
                position: 'relative' as const,
                '--canvas-background-image': `url("${imageUrl}")`,
                '--canvas-background-opacity': opacity
            };
        }
        
        // If there's a manually uploaded background image, use it
        if (loadedBackgroundImage && typeof loadedBackgroundImage === 'string') {
            return {
                backgroundColor: canvasBackgroundColor, // Always use the solid color picker value as base
                position: 'relative' as const,
                '--canvas-background-image': `url(${loadedBackgroundImage})`,
                '--canvas-background-opacity': opacity
            };
        }
        
        return {
            backgroundColor: baseColor
        };
    };

    const createNewBox = () => {
        const newBox: BoxData = {
            id: uuid(),
            frame: {
                translate: [30, 60] as [number, number],
                width: 600,
                height: 105,
            },
            zIndex: 1,
            backgroundColor: "#262626",
            backgroundColorText: "",
            backgroundVariableColors: [],
            borderColor: "#61BAFA",
            borderColorText: "",
            borderVariableColors: [],
            noBorder: true,
            headerColor: '#19325c',
            headerColorText: "",
            headerVariableColors: [],
            headerLabelSource: 'Time of Day',
            headerLabel: 'NO CONNECTION',
            headerLabelSize: 16,
            headerLabelColor: '#ffffff',
            headerLabelColorText: "",
            headerLabelVariableColors: [],
            leftLabelSource: 'Time',
            leftLabel: '',
            leftLabelSize: 14,
            leftLabelColor: '#FFFFFF',
            leftLabelColorText: "",
            leftLabelVariableColors: [],
            leftVisible: true,
            rightLabelSource: '$(internal:time_hms_12)',
            rightLabel: '',
            rightLabelSize: 20,
            rightLabelColor: '#FFFFFF',
            rightLabelColorText: "",
            rightLabelVariableColors: [],
            rightVisible: true,
            headerLabelVisible: true,
        };
        setBoxes((prev) => [...prev, newBox]);
    };


    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Delete selected box
            if (selectedBoxId && (event.key === 'Backspace' || event.key === 'Delete')) {
                // Prevent default behavior (like navigating back in browser)
                event.preventDefault();
                // Delete the selected box
                setBoxes((prev) => prev.filter((b) => b.id !== selectedBoxId));
                setSelectedBoxId(null);
            }
            // Create new box with Cmd+N (Mac) or Ctrl+N (Windows/Linux)
            else if (event.key === 'n' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                createNewBox();
            }
            // Toggle settings menu with Cmd+, (Mac) or Ctrl+, (Windows/Linux)
            else if (event.key === ',' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                settingsMenuRef.current?.toggle();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [selectedBoxId]);

    const canvasStyle = getCanvasBackgroundStyle();
    const hasBackgroundImage = isImageUrl(actualCanvasBackgroundColor) || (loadedBackgroundImage && typeof loadedBackgroundImage === 'string');

    // Check if we're running in browser (for disconnection overlay)
    const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;
    const showDisconnectOverlay = !isElectron && !isConnected;

    return (
        <div
            className={`canvas-container ${hasBackgroundImage ? 'has-background-image' : ''}`}
            style={{
                minHeight: '100vh',
                width: '100%',
                ...canvasStyle
            }}>
            <TitleBar />

            {/* Disconnection overlay - only shown when running in browser and disconnected */}
            {showDisconnectOverlay && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000,
                    pointerEvents: 'all',
                    cursor: 'not-allowed'
                }}>
                    <div style={{
                        backgroundColor: '#1a1a1a',
                        border: '2px solid #f44336',
                        borderRadius: '8px',
                        padding: '40px',
                        maxWidth: '500px',
                        textAlign: 'center',
                        boxShadow: '0 4px 20px rgba(244, 67, 54, 0.3)'
                    }}>
                        <div style={{
                            fontSize: '48px',
                            marginBottom: '20px'
                        }}>⚠️</div>
                        <h2 style={{
                            color: '#f44336',
                            margin: '0 0 16px 0',
                            fontSize: '24px',
                            fontWeight: 'bold'
                        }}>Connection Lost</h2>
                        <p style={{
                            color: '#cccccc',
                            margin: '0 0 12px 0',
                            fontSize: '16px',
                            lineHeight: '1.5'
                        }}>
                            The connection to the server has been lost.
                        </p>
                        <p style={{
                            color: '#999999',
                            margin: 0,
                            fontSize: '14px',
                            fontStyle: 'italic'
                        }}>
                            Attempting to reconnect...
                        </p>
                    </div>
                </div>
            )}

            <SettingsMenu
                ref={settingsMenuRef}
                onNewBox={createNewBox}
                connectionUrl={companionBaseUrl}
                onConnectionUrlChange={setCompanionBaseUrl}
                onConnectionsChange={setConnections}
                onConfigRestore={handleConfigRestore}
                onDeleteAllBoxes={deleteAllBoxes}
                canvasBackgroundColor={canvasBackgroundColor}
                canvasBackgroundColorText={canvasBackgroundColorText}
                canvasBackgroundVariableColors={canvasBackgroundVariableColors}
                onCanvasBackgroundColorChange={setCanvasBackgroundColor}
                onCanvasBackgroundColorTextChange={setCanvasBackgroundColorText}
                onCanvasBackgroundVariableColorsChange={setCanvasBackgroundVariableColors}
                canvasBackgroundImageOpacity={canvasBackgroundImageOpacity}
                onCanvasBackgroundImageOpacityChange={setCanvasBackgroundImageOpacity}
                refreshRateMs={refreshRateMs}
                onRefreshRateMsChange={setRefreshRateMs}
                fontFamily={fontFamily}
                onFontFamilyChange={setFontFamily}
            />
            {boxes.length === 0 ? (
                <div style={{
                    position: 'fixed',
                    top: '0',
                    left: '0',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    backgroundColor: 'rgba(0,0,0,.9)',
                    zIndex: 1,
                }}>
                    <img
                        src={dashboardLogo}
                        alt="Dashboard"
                        style={{
                            width: '500px',
                            height: 'auto',
                            opacity: 0.2,
                            filter: 'grayscale(100%)'
                        }}
                    />
                    <div style={{
                        position: 'fixed',
                        bottom: '32px',
                        left: '60px',
                        color: '#FFF',
                        fontSize: '14px',
                        fontWeight: '500',
                        opacity: .5,
                    }}>
                        Open the menu to add boxes!
                    </div>
                </div>
            ) : (
                boxes.map((box) => (
                    <Box
                        key={box.id}
                        boxData={box}
                        isSelected={selectedBoxId === box.id} // Pass down selection state
                        onSelect={() => setSelectedBoxId(box.id)} // Pass down select handler
                        onDeselect={() => setSelectedBoxId(null)} // Pass down deselect handler
                        onBoxUpdate={(updatedBox) => {
                            setBoxes(prev => prev.map(b => b.id === updatedBox.id ? updatedBox : b));
                        }}
                        onDelete={(boxId) => {
                            setBoxes((prev) => prev.filter((b) => b.id !== boxId));
                            setSelectedBoxId(null);
                        }}
                        onDuplicate={duplicateBox}
                        companionBaseUrl={companionBaseUrl}
                        connections={connections}
                        refreshRateMs={refreshRateMs}
                        isDragging={isDragging}
                        onDragStart={() => setIsDragging(true)}
                        onDragEnd={() => setIsDragging(false)}
                    />
                ))
            )}
        </div >
    );
}

