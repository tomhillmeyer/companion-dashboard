// SettingsMenu.tsx
import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { FaAngleRight } from "react-icons/fa6";
import { FaAngleLeft } from "react-icons/fa6";
import { FaX } from "react-icons/fa6";
import { FaLock } from "react-icons/fa6";
import { FaLockOpen } from "react-icons/fa6";
import { FaChevronDown, FaChevronUp, FaCopy } from "react-icons/fa6";
import { v4 as uuid } from 'uuid';
import type { VariableColor, CompanionConnection, ROI, ComparisonOperator, PageData } from './types';
import ColorPicker from './ColorPicker';
import FontPicker from './FontPicker';
import { useVideoDevices } from './useVideoDevices';
import ROIModal from './ROIModal';

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

import './SettingsMenu.css';
// Import the image directly - this is the most reliable approach
import dashboardWordmark from './assets/dashboard-wordmark.png';
// Import version from package.json
import packageJson from '../package.json';

// Get window ID for isolated storage
const windowId = (window as any).electronAPI?.windowId || '1';
const STORAGE_KEY = `window_${windowId}_companion_connection_url`;
const CONNECTIONS_STORAGE_KEY = `window_${windowId}_companion_connections`;
const FONT_STORAGE_KEY = `global_font_family`;

const SettingsMenu = forwardRef<{ toggle: () => void }, {
    onNewBox: () => void;
    connectionUrl: string;
    onConnectionUrlChange: (url: string) => void;
    onConnectionsChange: (connections: CompanionConnection[]) => void;
    mainConnectionValid?: boolean | null;
    onMainConnectionValidChange?: (valid: boolean | null) => void;
    additionalConnectionValidities?: { [key: string]: boolean | null };
    onAdditionalConnectionValiditiesChange?: (validities: { [key: string]: boolean | null }) => void;
    onConfigRestore: (boxes: any[], connectionUrl: string, canvasSettings?: any, pages?: any[]) => void;
    onDeleteAllBoxes: () => void;
    canvasBackgroundColor?: string;
    canvasBackgroundColorText?: string;
    canvasBackgroundVariableColors?: VariableColor[];
    onCanvasBackgroundColorChange?: (color: string) => void;
    onCanvasBackgroundColorTextChange?: (text: string) => void;
    onCanvasBackgroundVariableColorsChange?: (variableColors: VariableColor[]) => void;
    canvasBackgroundImageOpacity?: number;
    onCanvasBackgroundImageOpacityChange?: (opacity: number) => void;
    canvasBackgroundImageSize?: 'cover' | 'contain' | 'width';
    onCanvasBackgroundImageSizeChange?: (size: 'cover' | 'contain' | 'width') => void;
    canvasBackgroundImageWidth?: number;
    onCanvasBackgroundImageWidthChange?: (width: number) => void;
    canvasBackgroundVideoDeviceId?: string;
    onCanvasBackgroundVideoDeviceIdChange?: (deviceId: string) => void;
    canvasBackgroundVideoSize?: 'cover' | 'contain';
    onCanvasBackgroundVideoSizeChange?: (size: 'cover' | 'contain') => void;
    canvasBackgroundVideoROI?: { x: number; y: number; width: number; height: number };
    onCanvasBackgroundVideoROIChange?: (roi: { x: number; y: number; width: number; height: number } | undefined) => void;
    refreshRateMs?: number;
    onRefreshRateMsChange?: (refreshRate: number) => void;
    fontFamily?: string;
    onFontFamilyChange?: (fontFamily: string) => void;
    boxesLocked?: boolean;
    onBoxesLockedChange?: (locked: boolean) => void;
    onToggle?: () => void;
    isDisplayMode?: boolean;
    scaleEnabled?: boolean;
    onScaleEnabledChange?: (enabled: boolean) => void;
    designWidth?: number;
    onDesignWidthChange?: (width: number) => void;
    pages?: PageData[];
}>(({
    onNewBox,
    connectionUrl,
    onConnectionUrlChange,
    onConnectionsChange,
    mainConnectionValid,
    onMainConnectionValidChange,
    additionalConnectionValidities,
    onAdditionalConnectionValiditiesChange,
    onConfigRestore,
    onDeleteAllBoxes,
    canvasBackgroundColor,
    canvasBackgroundColorText,
    canvasBackgroundVariableColors,
    onCanvasBackgroundColorChange,
    onCanvasBackgroundColorTextChange,
    onCanvasBackgroundVariableColorsChange,
    canvasBackgroundImageOpacity,
    onCanvasBackgroundImageOpacityChange,
    canvasBackgroundImageSize,
    onCanvasBackgroundImageSizeChange,
    canvasBackgroundImageWidth,
    onCanvasBackgroundImageWidthChange,
    canvasBackgroundVideoDeviceId,
    onCanvasBackgroundVideoDeviceIdChange,
    canvasBackgroundVideoSize,
    onCanvasBackgroundVideoSizeChange,
    canvasBackgroundVideoROI,
    onCanvasBackgroundVideoROIChange,
    refreshRateMs,
    onRefreshRateMsChange,
    fontFamily,
    onFontFamilyChange,
    boxesLocked,
    onBoxesLockedChange,
    onToggle,
    isDisplayMode = false,
    scaleEnabled = false,
    onScaleEnabledChange,
    designWidth = 1920,
    onDesignWidthChange,
    pages = []
}, ref) => {
    const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;

    const [inputUrl, setInputUrl] = useState('');
    const [isValidUrl, setIsValidUrl] = useState<boolean | null>(null);
    // Use prop values for web clients, local state for Electron
    const effectiveIsValidUrl = isElectron ? isValidUrl : (mainConnectionValid ?? null);

    // Helper to update validity and notify parent
    const updateIsValidUrl = (valid: boolean | null) => {
        setIsValidUrl(valid);
        if (isElectron && onMainConnectionValidChange) {
            onMainConnectionValidChange(valid);
        }
    };

    const [connections, setConnections] = useState<CompanionConnection[]>([]);
    const connectionsRef = useRef<CompanionConnection[]>([]); // Track current connections for comparison
    const [connectionInputs, setConnectionInputs] = useState<{ [key: string]: string }>({});
    const [connectionValidities, setConnectionValidities] = useState<{ [key: string]: boolean | null }>({});
    // Use prop values for web clients, local state for Electron
    const effectiveConnectionValidities = isElectron ? connectionValidities : (additionalConnectionValidities ?? {});

    // Helper to update connection validities and notify parent
    const updateConnectionValidities = (validities: { [key: string]: boolean | null }) => {
        setConnectionValidities(validities);
        if (isElectron && onAdditionalConnectionValiditiesChange) {
            onAdditionalConnectionValiditiesChange(validities);
        }
    };
    const [mainConnectionStopped, setMainConnectionStopped] = useState<boolean>(false);
    const [connectionsStopped, setConnectionsStopped] = useState<boolean>(false);
    const handleCopyUrl = (url: string, e: React.MouseEvent) => {
        navigator.clipboard.writeText(url);
        const target = e.currentTarget as HTMLElement;
        target.style.transform = 'scale(0.8)';
        setTimeout(() => {
            target.style.transform = 'scale(1)';
        }, 200);
    };

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isActive, setIsActive] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Touch gesture state
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [touchStartY, setTouchStartY] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Background image file input ref
    const backgroundImageInputRef = useRef<HTMLInputElement>(null);

    // Video devices hook
    const { devices: videoDevices, refresh: refreshVideoDevices } = useVideoDevices();

    // Config load dialog state
    const [showConfigDialog, setShowConfigDialog] = useState(false);
    const [pendingConfig, setPendingConfig] = useState<any>(null);

    // ROI modal state
    const [showCanvasROIModal, setShowCanvasROIModal] = useState(false);

    // Platform detection - web server available on desktop (Electron) and dev mode
    const isDesktop = typeof window !== 'undefined' && (window as any).electronAPI;
    const isDev = import.meta.env.DEV;
    const showWebServer = isDesktop || isDev;

    // Web server state
    const [webServerPort, setWebServerPort] = useState<number>(80);
    const [webServerHostname, setWebServerHostname] = useState<string>('dashboard');
    const [webServerRunning, setWebServerRunning] = useState<boolean>(false);
    const [webServerStatus, setWebServerStatus] = useState<string>('Stopped');
    const [webServerEndpoints, setWebServerEndpoints] = useState<any[]>([]);
    const [selectedInterface, setSelectedInterface] = useState<string | null>(null);

    // Section collapse state
    const [collapsedSections, setCollapsedSections] = useState<{ [key: string]: boolean }>({
        companionConnection: false,
        font: true,
        responsiveScaling: true,
        background: true,
        boxes: true,
        webServer: true,
        configuration: true
    });

    const toggleSection = (section: string) => {
        setCollapsedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };


    // Web server functions
    const startWebServer = async () => {
        try {
            if (isDev && !isDesktop) {
                setWebServerStatus('Web server not available in dev mode without Electron');
                return;
            }

            // If server is already running, stop it first to allow restart with new settings
            if (webServerRunning) {
                console.log('Server already running, stopping before restart...');
                // @ts-ignore - electronAPI is available via preload script
                await window.electronAPI?.webServer.stop();
                // Wait a moment for the server to fully stop
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // @ts-ignore - electronAPI is available via preload script
            const result = await window.electronAPI?.webServer.start(webServerPort, webServerHostname);
            if (result?.success) {
                setWebServerRunning(true);
                setWebServerPort(result.port); // Sync the actual port that started
                setWebServerStatus(`Running on port ${result.port}`);
                localStorage.setItem(`window_${windowId}_web_server_port`, result.port.toString());
                localStorage.setItem(`window_${windowId}_web_server_hostname`, webServerHostname);
                console.log(`Web server started on port ${result.port}`);
            } else {
                setWebServerStatus(`Failed: ${result?.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Failed to start web server:', error);
            setWebServerStatus('Failed to start');
        }
    };

    const stopWebServer = async () => {
        try {
            // @ts-ignore - electronAPI is available via preload script
            const result = await window.electronAPI?.webServer.stop();
            if (result?.success) {
                setWebServerRunning(false);
                setWebServerStatus('Stopped');
                console.log('Web server stopped');
            } else {
                setWebServerStatus(`Failed to stop: ${result?.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Failed to stop web server:', error);
            setWebServerStatus('Failed to stop');
        }
    };


    // Use a ref to always have the latest pages value
    const pagesRef = useRef(pages);
    useEffect(() => {
        pagesRef.current = pages;
    }, [pages]);

    const checkWebServerStatus = async (syncPort: boolean = false) => {
        try {
            if (isDev && !isDesktop) {
                setWebServerStatus('Web server not available in dev mode without Electron');
                return;
            }

            // @ts-ignore - electronAPI is available via preload script
            const status = await window.electronAPI?.webServer.getStatus(pagesRef.current);

            if (status) {
                setWebServerRunning(status.isRunning);
                setWebServerStatus(status.isRunning ? `Running on port ${status.port}` : 'Stopped');
                setWebServerEndpoints(status.endpoints || []);

                // Sync the port from server state only on initial load or when explicitly requested
                if (syncPort && status.isRunning) {
                    setWebServerPort(status.port);
                }
            }
        } catch (error) {
            console.error('Failed to check web server status:', error);
        }
    };


    // Load saved web server port and hostname on mount
    useEffect(() => {
        if (showWebServer) {
            // Load saved settings from localStorage first
            const savedPort = localStorage.getItem(`window_${windowId}_web_server_port`);
            if (savedPort) {
                setWebServerPort(parseInt(savedPort, 10));
            }
            const savedHostname = localStorage.getItem(`window_${windowId}_web_server_hostname`);
            if (savedHostname) {
                setWebServerHostname(savedHostname);
            }

            // Check actual server status and sync port if server is running
            // This ensures UI matches reality (e.g., if server auto-started from saved state)
            // Check immediately
            checkWebServerStatus(true);

            // Also check after a delay to catch server that's auto-starting
            // (server has 2.5s delay in main.js before it starts)
            const timer = setTimeout(() => {
                checkWebServerStatus(true);
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [showWebServer]);

    // Check web server status periodically
    useEffect(() => {
        if (showWebServer) {
            const interval = setInterval(() => checkWebServerStatus(), 5000);
            return () => clearInterval(interval);
        }
    }, [showWebServer]);

    // Re-check web server status when pages change (to update page endpoints)
    useEffect(() => {
        if (showWebServer && webServerRunning) {
            checkWebServerStatus();
        }
    }, [pages, showWebServer, webServerRunning]);


    // Sync internal state when props change (for external updates via WebSocket)
    useEffect(() => {
        // Update inputUrl to match connectionUrl prop
        setInputUrl(connectionUrl);
    }, [connectionUrl]);

    // Update ref whenever connections state changes
    useEffect(() => {
        connectionsRef.current = connections;
    }, [connections]);

    // Sync connections from localStorage when they change externally
    useEffect(() => {
        const loadConnections = () => {
            const savedConnections = localStorage.getItem(`window_${windowId}_companion_connections`);
            if (savedConnections) {
                try {
                    const parsed = JSON.parse(savedConnections);
                    // Only update if actually different to avoid unnecessary re-renders
                    // Use ref to get the current value inside the interval callback
                    if (JSON.stringify(parsed) !== JSON.stringify(connectionsRef.current)) {
                        console.log('Connections changed, updating UI:', parsed);
                        setConnections(parsed);
                        // Update connection inputs for all connections
                        const inputs: { [key: string]: string } = {};
                        parsed.forEach((conn: CompanionConnection) => {
                            inputs[conn.id] = conn.url;
                        });
                        setConnectionInputs(inputs);
                    }
                } catch (error) {
                    console.error('Failed to parse saved connections:', error);
                }
            } else {
                // If no saved connections, clear the local state
                if (connectionsRef.current.length > 0) {
                    console.log('Connections cleared, updating UI');
                    setConnections([]);
                    setConnectionInputs({});
                }
            }
        };

        // Load initially
        loadConnections();

        // Poll for changes every second to catch external updates
        const interval = setInterval(loadConnections, 1000);
        return () => clearInterval(interval);
    }, []); // Only run once on mount

    const downloadConfig = async () => {
        try {
            // Get data from localStorage
            const boxes = localStorage.getItem(`window_${windowId}_boxes`);
            const pages = localStorage.getItem(`window_${windowId}_pages`);
            const connectionUrl = localStorage.getItem('companion_connection_url');
            const connections = localStorage.getItem(`window_${windowId}_companion_connections`);
            const canvasSettings = localStorage.getItem(`window_${windowId}_canvas_settings`);

            // Get cached background image data if it exists
            const canvasSettingsObj = canvasSettings ? JSON.parse(canvasSettings) : {};
            let backgroundImageData = null;

            if (canvasSettingsObj.canvasBackgroundColorText &&
                canvasSettingsObj.canvasBackgroundColorText.startsWith('./src/assets/background_')) {
                const filename = canvasSettingsObj.canvasBackgroundColorText.split('/').pop();
                if (filename) {
                    // Try IndexedDB first, then localStorage fallback
                    backgroundImageData = await getImageFromDB(filename);
                    if (!backgroundImageData) {
                        backgroundImageData = localStorage.getItem(`window_${windowId}_cached_bg_${filename}`);
                    }
                }
            }

            // Get web server settings
            const webServerPort = localStorage.getItem(`window_${windowId}_web_server_port`);
            const webServerHostname = localStorage.getItem(`window_${windowId}_web_server_hostname`);

            // Create config object
            const config = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                boxes: boxes ? JSON.parse(boxes) : [],
                pages: pages ? JSON.parse(pages) : [],
                companion_connection_url: connectionUrl || '',
                companion_connections: connections ? JSON.parse(connections) : [],
                canvas_settings: canvasSettingsObj,
                background_image_data: backgroundImageData,
                font_family: localStorage.getItem(FONT_STORAGE_KEY) || '',
                scale_enabled: localStorage.getItem(`window_${windowId}_scale_enabled`) === 'true',
                design_width: parseInt(localStorage.getItem(`window_${windowId}_design_width`) || '1920'),
                web_server: {
                    enabled: webServerRunning,
                    port: webServerPort ? parseInt(webServerPort, 10) : 80,
                    hostname: webServerHostname || 'dashboard'
                }
            };

            console.log('Config export:', {
                hasBackgroundImage: !!backgroundImageData,
                backgroundImageSize: backgroundImageData ? `${(backgroundImageData.length / 1024 / 1024).toFixed(2)}MB` : 'none'
            });

            const dataStr = JSON.stringify(config, null, 2);
            const fileName = `companion-dashboard-${new Date().toISOString().split('T')[0]}.json`;

            if (Capacitor.isNativePlatform()) {
                // Native platform (iOS/Android) - use Capacitor plugins
                try {
                    // Write file to Documents directory
                    const result = await Filesystem.writeFile({
                        path: fileName,
                        data: dataStr,
                        directory: Directory.Documents,
                        encoding: Encoding.UTF8
                    });

                    console.log('File saved to:', result.uri);

                    // Show share dialog so user can save/export the file
                    await Share.share({
                        title: 'Export Companion Dashboard Config',
                        text: 'Save your dashboard configuration',
                        url: result.uri,
                        dialogTitle: 'Save Configuration File'
                    });

                    console.log('Config exported successfully');
                } catch (error) {
                    console.error('Failed to export config:', error);
                    //alert('Failed to export configuration');
                }
            } else {
                // Web platform - use original blob method
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);

                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                URL.revokeObjectURL(url);
                console.log('Config downloaded successfully');
            }
        } catch (error) {
            console.error('Failed to download config:', error);
            alert('Failed to download configuration');
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const handleFileRestore = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const configText = e.target?.result as string;
                const config = JSON.parse(configText);

                // Validate config structure (basic validation)
                if (!config.boxes || !Array.isArray(config.boxes)) {
                    throw new Error('Invalid config format: missing or invalid boxes array');
                }

                // Store config and show dialog
                setPendingConfig(config);
                setShowConfigDialog(true);
                //alert('Configuration restored successfully!');

            } catch (error) {
                console.error('Failed to restore config:', error);
                alert('Failed to restore configuration. Please check the file format.');
            }
        };

        reader.readAsText(file);

        // Reset file input
        event.target.value = '';
    };

    // Load cached URL and connections on component mount (Electron only - web clients use props)
    useEffect(() => {
        const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;

        // Web clients are just remote views - they should only use the connectionUrl prop from Electron
        if (!isElectron) {
            setInputUrl(connectionUrl);
            return;
        }

        // Electron: Load from localStorage
        const cachedUrl = localStorage.getItem(STORAGE_KEY);
        if (cachedUrl) {
            setInputUrl(cachedUrl);
            // Only update parent if it's different from current connectionUrl
            if (cachedUrl !== connectionUrl) {
                onConnectionUrlChange(cachedUrl);
            }
        } else {
            setInputUrl(connectionUrl);
        }

        // Load additional connections
        const cachedConnections = localStorage.getItem(CONNECTIONS_STORAGE_KEY);
        if (cachedConnections) {
            try {
                const parsedConnections = JSON.parse(cachedConnections);
                setConnections(parsedConnections);

                // Initialize connection inputs
                const inputs: { [key: string]: string } = {};
                parsedConnections.forEach((conn: CompanionConnection) => {
                    inputs[conn.id] = conn.url;
                });
                setConnectionInputs(inputs);
            } catch (error) {
                console.error('Failed to parse cached connections:', error);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run on mount

    useEffect(() => {
        // Reset when connectionUrl changes
        setMainConnectionStopped(false);
        updateIsValidUrl(null);
    }, [connectionUrl]);

    useEffect(() => {
        const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;

        // Web clients don't check connections - they're just remote controls
        if (!isElectron) {
            return;
        }

        const checkConnection = async () => {
            if (mainConnectionStopped) {
                return;
            }

            if (!connectionUrl) {
                updateIsValidUrl(null);
                return;
            }

            try {
                const response = await fetch(`${connectionUrl}/api/variable/internal/time_unix/value`);
                if (!response.ok) throw new Error('Non-200 response');
                const data = await response.text();
                const timestamp = parseInt(data);
                if (!isNaN(timestamp)) {
                    updateIsValidUrl(true);
                } else {
                    throw new Error('Invalid response');
                }
            } catch (err) {
                updateIsValidUrl(false);
                setMainConnectionStopped(true);
                console.warn('Main connection failed, stopped checking');
            }
        };

        checkConnection(); // Initial check
        const interval = setInterval(checkConnection, 5000); // Repeat every 5s

        return () => clearInterval(interval); // Cleanup
    }, [connectionUrl, mainConnectionStopped]);

    // Check connections validity (Electron only)
    useEffect(() => {
        // Reset when connections change
        setConnectionsStopped(false);
    }, [connections]);

    useEffect(() => {
        const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;

        // Web clients don't check connections - they're just remote controls
        if (!isElectron) {
            return;
        }

        const checkConnections = async () => {
            if (connectionsStopped) {
                return;
            }

            const validities: { [key: string]: boolean | null } = {};
            let hasAnyError = false;

            for (const connection of connections) {
                if (!connection.url) {
                    validities[connection.id] = null;
                    continue;
                }

                try {
                    const response = await fetch(`${connection.url}/api/variable/internal/time_unix/value`);
                    if (!response.ok) throw new Error('Non-200 response');
                    const data = await response.text();
                    const timestamp = parseInt(data);
                    if (!isNaN(timestamp)) {
                        validities[connection.id] = true;
                    } else {
                        throw new Error('Invalid response');
                    }
                } catch (err) {
                    validities[connection.id] = false;
                    hasAnyError = true;
                }
            }

            updateConnectionValidities(validities);

            if (hasAnyError) {
                setConnectionsStopped(true);
                console.warn('Additional connection(s) failed, stopped checking');
            }
        };

        if (connections.length > 0) {
            checkConnections();
            const interval = setInterval(checkConnections, 5000);
            return () => clearInterval(interval);
        }
    }, [connections, connectionsStopped]);

    // Touch gesture handlers
    useEffect(() => {
        const handleTouchStart = (e: TouchEvent) => {
            const touch = e.touches[0];
            const startX = touch.clientX;
            const startY = touch.clientY;

            // Only start tracking if touch begins within 30px of left edge
            if (startX <= 30) {
                setTouchStartX(startX);
                setTouchStartY(startY);
                setIsDragging(true);
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isDragging || touchStartX === null || touchStartY === null) return;

            const touch = e.touches[0];
            const currentX = touch.clientX;
            const currentY = touch.clientY;

            const deltaX = currentX - touchStartX;
            const deltaY = Math.abs(currentY - touchStartY);

            // If user has dragged right more than 50px and vertical movement is less than 100px
            if (deltaX > 50 && deltaY < 100) {
                setIsActive(true);
                setIsDragging(false);
                setTouchStartX(null);
                setTouchStartY(null);
            }

            // Cancel if user moves too far vertically or backwards
            if (deltaY > 100 || deltaX < -20) {
                setIsDragging(false);
                setTouchStartX(null);
                setTouchStartY(null);
            }
        };

        const handleTouchEnd = () => {
            setIsDragging(false);
            setTouchStartX(null);
            setTouchStartY(null);
        };

        // Add touch event listeners to document
        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: true });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isDragging, touchStartX, touchStartY]);

    // Click outside handler to close menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsActive(false);
            }
        };

        if (isActive) {
            document.addEventListener('click', handleClickOutside);
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [isActive]);

    const [visible, setVisible] = useState(false);
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
        const handleMouseMove = () => {
            setVisible(true);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = window.setTimeout(() => {
                setVisible(false);
            }, 2000); // 2 seconds of inactivity
        };

        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const handleUrlSubmit = () => {
        const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;
        const trimmedUrl = inputUrl.trim();

        // If field is empty, disconnect
        if (!trimmedUrl) {
            setInputUrl('');
            if (isElectron) localStorage.setItem(STORAGE_KEY, '');
            onConnectionUrlChange('');
            updateIsValidUrl(null);
            return;
        }

        try {
            let urlToParse = trimmedUrl;
            // Add http:// if no protocol specified
            if (!urlToParse.startsWith('http://') && !urlToParse.startsWith('https://')) {
                urlToParse = 'http://' + urlToParse;
            }
            const url = new URL(urlToParse);
            const baseUrl = `${url.protocol}//${url.host}`;
            setInputUrl(baseUrl);
            if (isElectron) localStorage.setItem(STORAGE_KEY, baseUrl);
            onConnectionUrlChange(baseUrl);
        } catch (error) {
            console.error('Invalid URL:', error);
            updateIsValidUrl(false); // Show red border if input is invalid
        }
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newUrl = e.target.value;
        setInputUrl(newUrl);
    };

    const addConnection = () => {
        const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;
        const newConnection: CompanionConnection = {
            id: uuid(),
            url: '',
            label: `Connection [${connections.length + 1}]`
        };

        const updatedConnections = [...connections, newConnection];
        setConnections(updatedConnections);
        setConnectionInputs(prev => ({ ...prev, [newConnection.id]: '' }));

        // Save to localStorage (Electron only)
        if (isElectron) localStorage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(updatedConnections));
        onConnectionsChange(updatedConnections);
    };

    const deleteConnection = (connectionId: string, event?: React.MouseEvent) => {
        const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;
        event?.stopPropagation();
        const updatedConnections = connections.filter(conn => conn.id !== connectionId);
        setConnections(updatedConnections);

        // Remove from inputs and validities
        setConnectionInputs(prev => {
            const newInputs = { ...prev };
            delete newInputs[connectionId];
            return newInputs;
        });
        setConnectionValidities(prev => {
            const newValidities = { ...prev };
            delete newValidities[connectionId];
            return newValidities;
        });

        // Save to localStorage (Electron only)
        if (isElectron) localStorage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(updatedConnections));
        onConnectionsChange(updatedConnections);
    };

    const handleConnectionUrlChange = (connectionId: string, newUrl: string) => {
        setConnectionInputs(prev => ({ ...prev, [connectionId]: newUrl }));
    };

    const handleConnectionUrlSubmit = (connectionId: string) => {
        const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;
        const inputUrl = connectionInputs[connectionId] || '';
        const trimmedUrl = inputUrl.trim();

        // If field is empty, clear the connection URL
        if (!trimmedUrl) {
            const updatedConnections = connections.map(conn =>
                conn.id === connectionId ? { ...conn, url: '' } : conn
            );
            setConnections(updatedConnections);
            setConnectionInputs(prev => ({ ...prev, [connectionId]: '' }));
            setConnectionValidities(prev => ({ ...prev, [connectionId]: null }));

            if (isElectron) localStorage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(updatedConnections));
            onConnectionsChange(updatedConnections);
            return;
        }

        try {
            let urlToParse = trimmedUrl;
            // Add http:// if no protocol specified
            if (!urlToParse.startsWith('http://') && !urlToParse.startsWith('https://')) {
                urlToParse = 'http://' + urlToParse;
            }
            const url = new URL(urlToParse);
            const baseUrl = `${url.protocol}//${url.host}`;

            const updatedConnections = connections.map(conn =>
                conn.id === connectionId ? { ...conn, url: baseUrl } : conn
            );
            setConnections(updatedConnections);
            setConnectionInputs(prev => ({ ...prev, [connectionId]: baseUrl }));

            if (isElectron) localStorage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(updatedConnections));
            onConnectionsChange(updatedConnections);
        } catch (error) {
            console.error('Invalid URL:', error);
            setConnectionValidities(prev => ({ ...prev, [connectionId]: false }));
        }
    };

    const toggleClass = () => {
        setIsActive(prev => !prev);
        onToggle?.();
    };

    useImperativeHandle(ref, () => ({
        toggle: toggleClass
    }));

    const addCanvasVariableColor = () => {
        const variableColors = canvasBackgroundVariableColors || [];
        const newVariableColor: VariableColor = {
            id: uuid(),
            variable: '',
            operator: '==',
            value: '',
            color: '#ffffff'
        };
        onCanvasBackgroundVariableColorsChange?.([...variableColors, newVariableColor]);
    };

    const removeCanvasVariableColor = (id: string, event?: React.MouseEvent) => {
        event?.stopPropagation();
        const variableColors = canvasBackgroundVariableColors || [];
        onCanvasBackgroundVariableColorsChange?.(variableColors.filter(vc => vc.id !== id));
    };

    const updateCanvasVariableColor = (id: string, property: keyof VariableColor, value: string) => {
        const variableColors = canvasBackgroundVariableColors || [];
        const updated = variableColors.map(vc =>
            vc.id === id ? { ...vc, [property]: value } : vc
        );
        onCanvasBackgroundVariableColorsChange?.(updated);
    };

    const handleBackgroundImageBrowse = () => {
        backgroundImageInputRef.current?.click();
    };

    const compressImage = (file: File, maxWidth: number = 1920, maxHeight: number = 1080, quality: number = 0.9): Promise<string> => {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // Calculate new dimensions while maintaining aspect ratio
                let { width, height } = img;
                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                // Draw and compress image
                ctx?.drawImage(img, 0, 0, width, height);

                // Preserve PNG format for images with transparency
                const isPNG = file.type === 'image/png';
                const base64DataUrl = isPNG
                    ? canvas.toDataURL('image/png')
                    : canvas.toDataURL('image/jpeg', quality);

                console.log(`Compressed image with quality: ${quality}, estimated size: ${(base64DataUrl.length * 0.75 / 1024 / 1024).toFixed(2)}MB`);
                resolve(base64DataUrl);
            };

            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
        });
    };

    const handleBackgroundImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Check if it's an image file
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file.');
            return;
        }


        try {
            console.log(`Original file size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

            // Check current localStorage usage
            let totalSize = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    totalSize += localStorage[key].length;
                }
            }
            console.log(`Current localStorage usage: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);

            // Compress image for better performance on mobile
            const base64DataUrl = await compressImage(file);

            // Create a unique filename with timestamp
            const timestamp = Date.now();
            const cachedFilename = `background_${timestamp}.jpg`; // Always save as JPG after compression

            // Delete old cached background image if it exists
            const currentBgText = canvasBackgroundColorText || '';
            if (currentBgText.startsWith('./src/assets/background_') && currentBgText.includes('.')) {
                const oldFilename = currentBgText.split('/').pop();
                if (oldFilename) {
                    localStorage.removeItem(`window_${windowId}_cached_bg_${oldFilename}`);
                }
            }

            // Set the new background image path
            onCanvasBackgroundColorTextChange?.(`./src/assets/${cachedFilename}`);

            // Store the base64 data URL in IndexedDB (much larger capacity)
            try {
                await storeImageInDB(cachedFilename, base64DataUrl);
                console.log('Background image stored in IndexedDB:', cachedFilename);
            } catch (dbError) {
                console.error('IndexedDB storage failed, falling back to localStorage:', dbError);
                // Fallback to localStorage with compression
                try {
                    localStorage.setItem(`window_${windowId}_cached_bg_${cachedFilename}`, base64DataUrl);
                    console.log('Background image stored in localStorage (fallback)');
                } catch (quotaError) {
                    if (quotaError instanceof DOMException && quotaError.name === 'QuotaExceededError') {
                        throw new Error(`Storage quota exceeded. Current localStorage usage: ${(totalSize / 1024 / 1024).toFixed(2)}MB. Please clear some data or use a smaller image.`);
                    } else {
                        throw quotaError;
                    }
                }
            }
        } catch (error) {
            console.error('Failed to cache background image:', error);
            alert('Failed to set background image.');
        }

        // Reset file input
        event.target.value = '';
    };

    // IndexedDB helper functions for larger image storage
    const openImageDB = (): Promise<IDBDatabase> => {
        return new Promise((resolve, reject) => {
            // Use a higher version to avoid conflicts
            const request = indexedDB.open('CompanionDashboardImages', 3);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains('images')) {
                    db.createObjectStore('images', { keyPath: 'id' });
                }
            };
        });
    };

    const storeImageInDB = async (filename: string, base64Data: string): Promise<void> => {
        try {
            const db = await openImageDB();
            const transaction = db.transaction(['images'], 'readwrite');
            const store = transaction.objectStore('images');

            return new Promise((resolve, reject) => {
                const request = store.put({ id: filename, data: base64Data });
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    console.log('Successfully stored image in IndexedDB');
                    resolve();
                };
            });
        } catch (error) {
            console.error('Error in storeImageInDB:', error);
            throw error;
        }
    };

    const getImageFromDB = async (filename: string): Promise<string | null> => {
        try {
            const db = await openImageDB();
            const transaction = db.transaction(['images'], 'readonly');
            const store = transaction.objectStore('images');

            return new Promise((resolve, reject) => {
                const request = store.get(filename);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const result = request.result;
                    resolve(result ? result.data : null);
                };
            });
        } catch (error) {
            console.error('Error getting image from IndexedDB:', error);
            return null;
        }
    };

    const deleteImageFromDB = async (filename: string): Promise<void> => {
        try {
            const db = await openImageDB();
            const transaction = db.transaction(['images'], 'readwrite');
            const store = transaction.objectStore('images');

            return new Promise((resolve, reject) => {
                const request = store.delete(filename);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            });
        } catch (error) {
            console.error('Error deleting image from IndexedDB:', error);
        }
    };

    const clearCachedBackground = async () => {
        const currentBgText = canvasBackgroundColorText || '';
        if (currentBgText.startsWith('./src/assets/background_')) {
            // Clear the cached image reference
            onCanvasBackgroundColorTextChange?.('');

            // Remove cached image from both localStorage and IndexedDB
            const filename = currentBgText.split('/').pop();
            if (filename) {
                localStorage.removeItem(`window_${windowId}_cached_bg_${filename}`);
                await deleteImageFromDB(filename);
                console.log('Cleared cached background image:', filename);
            }
        }
    };

    const handleAddBoxesOnly = () => {
        if (!pendingConfig) return;

        // Add boxes only - generate new UUIDs
        const existingBoxes = localStorage.getItem(`window_${windowId}_boxes`);
        const currentBoxes = existingBoxes ? JSON.parse(existingBoxes) : [];

        // Create new boxes with fresh UUIDs
        const newBoxes = pendingConfig.boxes.map((box: any) => ({
            ...box,
            id: uuid(), // Generate new UUID for each box
            frame: {
                ...box.frame,
                translate: [
                    box.frame.translate[0] + 20, // Offset slightly to avoid overlap
                    box.frame.translate[1] + 20
                ]
            }
        }));

        const mergedBoxes = [...currentBoxes, ...newBoxes];
        localStorage.setItem(`window_${windowId}_boxes`, JSON.stringify(mergedBoxes));

        // Update parent state with merged boxes, keep existing settings
        onConfigRestore(mergedBoxes, connectionUrl, null);

        console.log('Boxes added successfully with new UUIDs');
        setShowConfigDialog(false);
        setPendingConfig(null);
    };

    const handleReplaceEntireConfig = async () => {
        if (!pendingConfig) return;

        // Ask for confirmation
        const confirmReplace = window.confirm(
            "Are you sure you want to replace the entire configuration? This cannot be undone."
        );

        if (confirmReplace) {
            console.log('Replacing configuration with:', {
                connectionUrl: pendingConfig.companion_connection_url,
                connections: pendingConfig.companion_connections,
                boxCount: pendingConfig.boxes?.length
            });

            // Clear current localStorage
            localStorage.removeItem(`window_${windowId}_boxes`);
            localStorage.removeItem('companion_connection_url');
            localStorage.removeItem(`window_${windowId}_companion_connections`);
            localStorage.removeItem(`window_${windowId}_canvas_settings`);

            // Set new data
            localStorage.setItem(`window_${windowId}_boxes`, JSON.stringify(pendingConfig.boxes));
            // Always set connection URL, even if empty (for complete replacement)
            const urlToSet = pendingConfig.companion_connection_url || '';
            localStorage.setItem('companion_connection_url', urlToSet);
            console.log('Set companion_connection_url to:', urlToSet);
            // Always set connections, even if empty array (for complete replacement)
            localStorage.setItem(`window_${windowId}_companion_connections`, JSON.stringify(pendingConfig.companion_connections || []));
            if (pendingConfig.canvas_settings) {
                localStorage.setItem(`window_${windowId}_canvas_settings`, JSON.stringify(pendingConfig.canvas_settings));
            }

            // Restore font family if it exists
            if (pendingConfig.font_family) {
                localStorage.setItem(FONT_STORAGE_KEY, pendingConfig.font_family);
                onFontFamilyChange?.(pendingConfig.font_family);
            }

            // Restore scaling settings if they exist
            if (pendingConfig.scale_enabled !== undefined) {
                localStorage.setItem(`window_${windowId}_scale_enabled`, pendingConfig.scale_enabled.toString());
                onScaleEnabledChange?.(pendingConfig.scale_enabled);
            }

            if (pendingConfig.design_width !== undefined) {
                localStorage.setItem(`window_${windowId}_design_width`, pendingConfig.design_width.toString());
                onDesignWidthChange?.(pendingConfig.design_width);
            }

            // Restore background image if it exists
            if (pendingConfig.background_image_data && pendingConfig.canvas_settings?.canvasBackgroundColorText) {
                const backgroundPath = pendingConfig.canvas_settings.canvasBackgroundColorText;
                if (backgroundPath.startsWith('./src/assets/background_')) {
                    const filename = backgroundPath.split('/').pop();
                    if (filename) {
                        try {
                            await storeImageInDB(filename, pendingConfig.background_image_data);
                            console.log('Background image restored to IndexedDB');
                        } catch (error) {
                            // Fallback to localStorage
                            localStorage.setItem(`window_${windowId}_cached_bg_${filename}`, pendingConfig.background_image_data);
                            console.log('Background image restored to localStorage (fallback)');
                        }
                    }
                }
            }

            // Restore web server settings if they exist
            if (pendingConfig.web_server) {
                if (pendingConfig.web_server.port) {
                    localStorage.setItem(`window_${windowId}_web_server_port`, pendingConfig.web_server.port.toString());
                    setWebServerPort(pendingConfig.web_server.port);
                }
                if (pendingConfig.web_server.hostname) {
                    localStorage.setItem(`window_${windowId}_web_server_hostname`, pendingConfig.web_server.hostname);
                    setWebServerHostname(pendingConfig.web_server.hostname);
                }
                console.log('Web server settings restored:', pendingConfig.web_server);
            }

            // Update local input state first
            const urlForRestore = pendingConfig.companion_connection_url || '';
            setInputUrl(urlForRestore);
            console.log('Set local input URL to:', urlForRestore);

            // Always update connections state first (even if empty array for complete replacement)
            const connectionsToRestore = pendingConfig.companion_connections || [];
            setConnections(connectionsToRestore);
            // Initialize connection inputs
            const inputs: { [key: string]: string } = {};
            connectionsToRestore.forEach((conn: CompanionConnection) => {
                inputs[conn.id] = conn.url;
            });
            setConnectionInputs(inputs);
            // Notify parent about connections change immediately
            onConnectionsChange(connectionsToRestore);

            // Update parent state - this will trigger connection restart
            console.log('Calling onConfigRestore with URL:', urlForRestore);
            onConfigRestore(pendingConfig.boxes, urlForRestore, pendingConfig.canvas_settings, pendingConfig.pages);

            console.log('Full configuration replaced successfully');
        }

        setShowConfigDialog(false);
        setPendingConfig(null);
    };

    return (
        <div ref={menuRef}>
            {!isDisplayMode && (
                <div id="menu-icon"
                    className="menu-icon"
                    style={{
                        opacity: visible ? 1 : 0,
                        transition: 'opacity 0.5s ease',
                    }} onClick={toggleClass}>
                    <FaAngleRight style={{ display: isActive ? 'none' : 'inline' }} />
                    <FaAngleLeft style={{ display: isActive ? 'inline' : 'none' }} />
                </div>
            )}
            {!isDisplayMode && (
                <div
                    className="lock-icon"
                    style={{
                        opacity: visible ? 1 : 0,
                        transition: 'opacity 0.5s ease',
                        cursor: 'pointer'
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onBoxesLockedChange?.(!boxesLocked);
                    }}
                >
                    {boxesLocked ? <FaLock /> : <FaLockOpen />}
                </div>
            )}
            <div className={isActive ? 'menu menu-open' : 'menu'}>
                <div className='menu-content'>
                    <div className='logo-box'>
                        <img src={dashboardWordmark} className='wordmark-image' alt="Companion Dashboard" />
                    </div>
                    <div className='section-label-container' onClick={(e) => { e.stopPropagation(); toggleSection('companionConnection'); }}>
                        <span className='section-label'>Companion Connection</span>
                        {collapsedSections.companionConnection ? <FaChevronDown /> : <FaChevronUp />}
                    </div>
                    {!collapsedSections.companionConnection && (
                        <>
                            <div className='menu-section'>
                                <div className="settings-subsection">
                                    <div className="canvas-refresh-rate-controls">
                                        <label htmlFor="canvas-refresh-rate" className="connection-label">Variable Refresh Rate (ms)</label>
                                        <input
                                            id="canvas-refresh-rate"
                                            type="number"
                                            min="50"
                                            max="10000"
                                            value={refreshRateMs || 500}
                                            onChange={(e) => onRefreshRateMsChange?.(parseInt(e.target.value) || 500)}
                                            className="canvas-color-text"
                                            style={{ marginLeft: '15px', textAlign: 'center' }}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="menu-section-column" style={{ marginTop: '15px' }}>
                                <div className="settings-subsection">
                                    <div className="connection-item">
                                        <span className="connection-label">Default Connection</span>
                                        <div className="connection-controls">
                                            <input
                                                type="text"
                                                value={inputUrl}
                                                onChange={handleUrlChange}
                                                placeholder="http://127.0.0.1:8888/"
                                                style={{
                                                    border: '1px solid',
                                                    borderColor:
                                                        effectiveIsValidUrl === null ? 'gray' :
                                                            effectiveIsValidUrl === true ? 'green' :
                                                                'red'
                                                }}
                                            />
                                            <button onClick={handleUrlSubmit}>SET</button>
                                        </div>
                                    </div>

                                    {connections.map((connection, index) => (
                                        <div key={connection.id} className="connection-item">
                                            <span className="connection-label">Connection [{index + 1}]</span>
                                            <div className="connection-controls">
                                                <input
                                                    type="text"
                                                    value={connectionInputs[connection.id] || ''}
                                                    onChange={(e) => handleConnectionUrlChange(connection.id, e.target.value)}
                                                    placeholder="http://127.0.0.1:8888/"
                                                    style={{
                                                        border: '1px solid',
                                                        borderColor:
                                                            effectiveConnectionValidities[connection.id] === null ? 'gray' :
                                                                effectiveConnectionValidities[connection.id] === true ? 'green' :
                                                                    'red'
                                                    }}
                                                />
                                                <button onClick={() => handleConnectionUrlSubmit(connection.id)}>SET</button>
                                                <button
                                                    onClick={(e) => deleteConnection(connection.id, e)}
                                                    className="delete-connection-button"
                                                >
                                                    <FaX />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    <button
                                        className="add-connection-button"
                                        onClick={addConnection}
                                    >
                                        ADD CONNECTION
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                    <div className='section-label-container' onClick={(e) => { e.stopPropagation(); toggleSection('font'); }}>
                        <span className='section-label'>Global Font</span>
                        {collapsedSections.font ? <FaChevronDown /> : <FaChevronUp />}
                    </div>
                    {!collapsedSections.font && (
                        <div className='menu-section font-section'>
                            <FontPicker
                                value={fontFamily || 'Work Sans'}
                                onChange={(font) => {
                                    localStorage.setItem(FONT_STORAGE_KEY, font);
                                    onFontFamilyChange?.(font);
                                }}
                                className="settings-font-picker"
                            />
                        </div>
                    )}

                    {!Capacitor.isNativePlatform() && (
                        <>
                            <div className='section-label-container' onClick={(e) => { e.stopPropagation(); toggleSection('responsiveScaling'); }}>
                                <span className='section-label'>Responsive Scaling</span>
                                {collapsedSections.responsiveScaling ? <FaChevronDown /> : <FaChevronUp />}
                            </div>
                            {!collapsedSections.responsiveScaling && (
                                <>
                                    <div className='menu-section'>
                                        <div className='settings-subsection'>
                                            <div className='scaling-checkbox-row'>
                                                <input
                                                    type="checkbox"
                                                    id="scale-enabled"
                                                    checked={scaleEnabled}
                                                    onChange={(e) => onScaleEnabledChange?.(e.target.checked)}
                                                />
                                                <label htmlFor="scale-enabled" className="connection-label">
                                                    Scale based on width
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                    <div className='menu-section' style={{ marginTop: '15px' }}>
                                        <div className='settings-subsection'>
                                            <div className='scaling-width-row'>
                                                <label htmlFor="design-width">
                                                    Width (px)
                                                </label>
                                                <input
                                                    id="design-width"
                                                    type="number"
                                                    value={designWidth}
                                                    onChange={(e) => {
                                                        const value = parseInt(e.target.value) || 1920;
                                                        onDesignWidthChange?.(value);
                                                    }}
                                                    min="320"
                                                    max="7680"
                                                />
                                                <button
                                                    onClick={() => {
                                                        if (typeof window !== 'undefined') {
                                                            onDesignWidthChange?.(window.innerWidth);
                                                        }
                                                    }}
                                                >
                                                    USE CURRENT CANVAS WIDTH
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    <div className='section-label-container' onClick={(e) => { e.stopPropagation(); toggleSection('background'); }}>
                        <span className='section-label'>Background</span>
                        {collapsedSections.background ? <FaChevronDown /> : <FaChevronUp />}
                    </div>
                    {!collapsedSections.background && (
                        <div className='menu-section canvas-section'>
                            <div className="settings-subsection">
                                <span className="canvas-color-label">Color</span>
                                <div className="canvas-color-input-group">
                                    <ColorPicker
                                        value={canvasBackgroundColor || '#000000'}
                                        onChange={(color) => onCanvasBackgroundColorChange?.(color)}
                                        className="canvas-color-picker"
                                    />
                                    <input
                                        type="text"
                                        value={canvasBackgroundColorText || ''}
                                        onChange={(e) => onCanvasBackgroundColorTextChange?.(e.target.value)}
                                        placeholder="Variable, HEX, or Image URL"
                                        className="canvas-color-text"
                                    />
                                </div>

                                <div className="canvas-variable-color-container">
                                    <span className="canvas-color-label">Variable Background Color</span>
                                    <div className="canvas-variable-color-section">
                                        {(canvasBackgroundVariableColors || []).map(vc => (
                                            <div key={vc.id} className="canvas-variable-color-row">
                                                <input
                                                    type="text"
                                                    value={vc.variable}
                                                    onChange={(e) => updateCanvasVariableColor(vc.id, 'variable', e.target.value)}
                                                    placeholder="Variable"
                                                    className="canvas-variable-input"
                                                />
                                                <select
                                                    value={vc.operator}
                                                    onChange={(e) => updateCanvasVariableColor(vc.id, 'operator', e.target.value as ComparisonOperator)}
                                                    className="canvas-operator-select"
                                                >
                                                    <option value="==">=</option>
                                                    <option value="!=">≠</option>
                                                    <option value="<">&lt;</option>
                                                    <option value="<=">&lt;=</option>
                                                    <option value=">">&gt;</option>
                                                    <option value=">=">&gt;=</option>
                                                </select>
                                                <input
                                                    type="text"
                                                    value={vc.value}
                                                    onChange={(e) => updateCanvasVariableColor(vc.id, 'value', e.target.value)}
                                                    placeholder="Value"
                                                    className="canvas-value-input"
                                                />
                                                <ColorPicker
                                                    value={vc.color}
                                                    onChange={(color) => updateCanvasVariableColor(vc.id, 'color', color)}
                                                    className="canvas-variable-color-picker"
                                                />
                                                <button
                                                    type="button"
                                                    className="canvas-remove-variable-color-button"
                                                    onClick={(e) => removeCanvasVariableColor(vc.id, e)}
                                                >
                                                    <FaX style={{ fontSize: '16px' }} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        className="canvas-add-variable-color-button"
                                        onClick={addCanvasVariableColor}
                                    >
                                        ADD
                                    </button>
                                </div>
                            </div>

                            <div className="canvas-image-group">
                                <span className="canvas-color-label">Background Image</span>
                                <div className="canvas-image-controls">
                                    <button
                                        type="button"
                                        onClick={handleBackgroundImageBrowse}
                                        className="canvas-browse-button"
                                    >
                                        Browse Image
                                    </button>
                                    {canvasBackgroundColorText && canvasBackgroundColorText.startsWith('./src/assets/background_') && (
                                        <button
                                            type="button"
                                            onClick={clearCachedBackground}
                                            className="canvas-clear-button"
                                        >
                                            Clear Image
                                        </button>
                                    )}
                                </div>
                                <div className="canvas-opacity-controls">
                                    <label htmlFor="canvas-background-opacity">Background Image Opacity (%)</label>
                                    <input
                                        id="canvas-background-opacity"
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={canvasBackgroundImageOpacity || 100}
                                        onChange={(e) => onCanvasBackgroundImageOpacityChange?.(parseInt(e.target.value) || 100)}
                                        className="canvas-opacity-input"
                                    />
                                </div>
                                <div className="canvas-image-size-controls">
                                    <label htmlFor="canvas-image-size">Background Image Size</label>
                                    <select
                                        id="canvas-image-size"
                                        value={canvasBackgroundImageSize || 'cover'}
                                        onChange={(e) => onCanvasBackgroundImageSizeChange?.(e.target.value as 'cover' | 'contain' | 'width')}
                                    >
                                        <option value="cover">Cover (fill canvas)</option>
                                        <option value="contain">Contain (fit entire image)</option>
                                        <option value="width">Custom Width</option>
                                    </select>
                                </div>
                                {canvasBackgroundImageSize === 'width' && (
                                    <div className="canvas-image-size-controls">
                                        <label htmlFor="canvas-image-width">Custom Width (px)</label>
                                        <input
                                            id="canvas-image-width"
                                            type="number"
                                            min="100"
                                            max="10000"
                                            value={canvasBackgroundImageWidth || 1920}
                                            onChange={(e) => onCanvasBackgroundImageWidthChange?.(parseInt(e.target.value) || 1920)}
                                        />
                                    </div>
                                )}
                            </div>

                            {videoDevices.length > 0 && (
                                <div className="canvas-image-group">
                                    <span className="canvas-color-label">Background Video</span>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                                        <select
                                            value={canvasBackgroundVideoDeviceId || ''}
                                            onChange={(e) => onCanvasBackgroundVideoDeviceIdChange?.(e.target.value)}
                                            style={{
                                                flex: 1,
                                                height: '40px',
                                                padding: '0 8px',
                                                backgroundColor: '#1a1a1a',
                                                color: 'white',
                                                border: '1px solid #61BAFA',
                                                borderRadius: '4px',
                                                fontSize: '14px',
                                                boxSizing: 'border-box',
                                                margin: 0
                                            }}
                                        >
                                            <option value="">No Video</option>
                                            {videoDevices.map(device => (
                                                <option key={device.deviceId} value={device.deviceId}>
                                                    {device.label}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={refreshVideoDevices}
                                            style={{
                                                height: '40px',
                                                padding: '0 16px',
                                                backgroundColor: '#444',
                                                color: 'white',
                                                border: '1px solid #61BAFA',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '14px',
                                                whiteSpace: 'nowrap',
                                                boxSizing: 'border-box',
                                                margin: 0
                                            }}
                                        >
                                            Refresh
                                        </button>
                                    </div>
                                    {canvasBackgroundVideoDeviceId && (
                                        <>
                                            <div className="canvas-image-size-controls" style={{ marginTop: '10px' }}>
                                                <label htmlFor="canvas-video-size">Background Video Size</label>
                                                <select
                                                    id="canvas-video-size"
                                                    value={canvasBackgroundVideoSize || 'cover'}
                                                    onChange={(e) => onCanvasBackgroundVideoSizeChange?.(e.target.value as 'cover' | 'contain')}
                                                >
                                                    <option value="cover">Cover</option>
                                                    <option value="contain">Contain</option>
                                                </select>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setShowCanvasROIModal(true)}
                                                style={{
                                                    marginTop: '10px',
                                                    height: '40px',
                                                    padding: '0 16px',
                                                    backgroundColor: '#444',
                                                    color: 'white',
                                                    border: '1px solid #61BAFA',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '14px',
                                                    width: '100%',
                                                    boxSizing: 'border-box'
                                                }}
                                            >
                                                Set Region of Interest
                                            </button>
                                            {canvasBackgroundVideoROI && (
                                                <button
                                                    type="button"
                                                    onClick={() => onCanvasBackgroundVideoROIChange?.(undefined)}
                                                    style={{
                                                        marginTop: '5px',
                                                        height: '40px',
                                                        padding: '0 16px',
                                                        backgroundColor: '#333',
                                                        color: 'white',
                                                        border: '1px solid #666',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '12px',
                                                        width: '100%',
                                                        boxSizing: 'border-box'
                                                    }}
                                                >
                                                    Clear Region of Interest
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className='section-label-container' onClick={(e) => { e.stopPropagation(); toggleSection('boxes'); }}>
                        <span className='section-label'>Boxes</span>
                        {collapsedSections.boxes ? <FaChevronDown /> : <FaChevronUp />}
                    </div>
                    {!collapsedSections.boxes && (
                        <div className='menu-section'>
                            <button onClick={onNewBox}>NEW BOX</button>
                            <button
                                onClick={() => {
                                    const confirmed = window.confirm("Are you sure you want to clear all of the boxes?");
                                    if (confirmed) {
                                        onDeleteAllBoxes();
                                    }
                                }}
                                className='clear-boxes'
                            >
                                CLEAR ALL
                            </button>
                        </div>
                    )}

                    {showWebServer && (
                        <>
                            <div className='section-label-container' onClick={(e) => { e.stopPropagation(); toggleSection('webServer'); }}>
                                <span className='section-label'>WEB SERVER</span>
                                {collapsedSections.webServer ? <FaChevronDown /> : <FaChevronUp />}
                            </div>
                            {!collapsedSections.webServer && (
                                <>
                                    <div className='menu-section'>
                                        <div className="settings-subsection">
                                            <div className="web-server-controls">
                                                <div className="web-server-port-container">
                                                    <label htmlFor="web-server-hostname">mDNS:</label>
                                                    <input
                                                        id="web-server-hostname"
                                                        type="text"
                                                        value={webServerHostname}
                                                        onChange={(e) => setWebServerHostname(e.target.value)}
                                                        disabled={webServerRunning}
                                                        placeholder="dashboard"
                                                        style={{ width: '120px', marginLeft: '10px' }}
                                                    />
                                                    <span style={{ marginLeft: '5px', opacity: 0.6 }}>.local</span>
                                                </div>
                                                <div className="web-server-port-container">
                                                    <label htmlFor="web-server-port">Port:</label>
                                                    <input
                                                        id="web-server-port"
                                                        type="number"
                                                        min="1"
                                                        max="65535"
                                                        value={webServerPort}
                                                        onChange={(e) => {
                                                            const port = parseInt(e.target.value, 10);
                                                            if (!isNaN(port)) {
                                                                setWebServerPort(port);
                                                            }
                                                        }}
                                                        disabled={webServerRunning}
                                                        style={{ width: '80px', marginLeft: '10px' }}
                                                    />
                                                </div>
                                                <div className="web-server-actions">
                                                    {webServerRunning ? (
                                                        <button onClick={stopWebServer} className="web-server-stop">
                                                            STOP SERVER
                                                        </button>
                                                    ) : (
                                                        <button onClick={startWebServer} className="web-server-start">
                                                            START SERVER
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="web-server-status">
                                                    Status: {webServerStatus}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {webServerRunning && webServerEndpoints.length > 0 && (() => {
                                        // Group endpoints by base URL
                                        const interfaceMap = new Map<string, { baseUrl: string; endpoints: any[] }>();

                                        webServerEndpoints.forEach(endpoint => {
                                            const url = new URL(endpoint.url);
                                            const baseUrl = `${url.protocol}//${url.host}`;

                                            if (!interfaceMap.has(baseUrl)) {
                                                interfaceMap.set(baseUrl, { baseUrl, endpoints: [] });
                                            }
                                            interfaceMap.get(baseUrl)!.endpoints.push(endpoint);
                                        });

                                        const interfaces = Array.from(interfaceMap.values());
                                        const currentInterface = selectedInterface ?
                                            interfaces.find(i => i.baseUrl === selectedInterface) :
                                            interfaces[0];

                                        return (
                                            <>
                                                <div className='menu-section' style={{ marginTop: '15px' }}>
                                                    <div className="settings-subsection">
                                                        <div style={{ display: 'flex', gap: '15px' }}>
                                                            {/* Left Column: Network Interfaces */}
                                                            <div style={{ flex: '0 0 140px', borderRight: '1px solid #333', paddingRight: '15px' }}>
                                                                {interfaces.map((iface, index) => {
                                                                    const displayUrl = iface.baseUrl.replace(/^https?:\/\//, '');
                                                                    return (
                                                                        <div
                                                                            key={index}
                                                                            onClick={() => setSelectedInterface(iface.baseUrl)}
                                                                            style={{
                                                                                padding: '10px 12px',
                                                                                margin: '0 0 8px 0',
                                                                                backgroundColor: currentInterface?.baseUrl === iface.baseUrl ? '#1a1a1a' : 'transparent',
                                                                                border: currentInterface?.baseUrl === iface.baseUrl ? '1px solid #61BAFA' : '1px solid #333',
                                                                                borderRadius: '6px',
                                                                                cursor: 'pointer',
                                                                                fontSize: '11px',
                                                                                transition: 'all 0.2s',
                                                                                color: '#61BAFA',
                                                                            }}
                                                                            onMouseEnter={(e) => {
                                                                                if (currentInterface?.baseUrl !== iface.baseUrl) {
                                                                                    e.currentTarget.style.backgroundColor = '#1a1a1a';
                                                                                    e.currentTarget.style.borderColor = '#444';
                                                                                }
                                                                            }}
                                                                            onMouseLeave={(e) => {
                                                                                if (currentInterface?.baseUrl !== iface.baseUrl) {
                                                                                    e.currentTarget.style.backgroundColor = 'transparent';
                                                                                    e.currentTarget.style.borderColor = '#333';
                                                                                }
                                                                            }}
                                                                        >
                                                                            {displayUrl}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>

                                                            {/* Right Column: Endpoints for Selected Interface */}
                                                            <div style={{ flex: '1' }}>
                                                                {currentInterface && (
                                                                    <>
                                                                        {/* Display View */}
                                                                        {currentInterface.endpoints.filter(e => e.type === 'read-only').map((endpoint, index) => {
                                                                            const displayUrl = endpoint.url.replace(/^https?:\/\//, '');
                                                                            return (
                                                                                <div key={`ro-${index}`} style={{
                                                                                    padding: '12px 0',
                                                                                    borderBottom: '1px solid #333',
                                                                                }}>
                                                                                    <div style={{
                                                                                        display: 'flex',
                                                                                        justifyContent: 'space-between',
                                                                                        alignItems: 'center',
                                                                                        marginBottom: '8px'
                                                                                    }}>
                                                                                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>
                                                                                            Display
                                                                                        </div>
                                                                                        <div
                                                                                            onClick={(e) => handleCopyUrl(endpoint.url, e)}
                                                                                            style={{
                                                                                                color: '#61BAFA',
                                                                                                cursor: 'pointer',
                                                                                                fontSize: '20px',
                                                                                                opacity: 0.7,
                                                                                                transition: 'all 0.2s ease',
                                                                                                display: 'flex',
                                                                                                alignItems: 'center'
                                                                                            }}
                                                                                            onMouseEnter={(e) => {
                                                                                                e.currentTarget.style.opacity = '1';
                                                                                            }}
                                                                                            onMouseLeave={(e) => {
                                                                                                e.currentTarget.style.opacity = '0.7';
                                                                                            }}
                                                                                            title="Copy URL to clipboard"
                                                                                        >
                                                                                            <FaCopy />
                                                                                        </div>
                                                                                    </div>
                                                                                    <a
                                                                                        href="#"
                                                                                        onClick={(e) => {
                                                                                            e.preventDefault();
                                                                                            if ((window as any).electronAPI?.openExternal) {
                                                                                                (window as any).electronAPI.openExternal(endpoint.url);
                                                                                            } else {
                                                                                                window.open(endpoint.url, '_blank', 'noopener,noreferrer');
                                                                                            }
                                                                                        }}
                                                                                        style={{
                                                                                            color: '#61BAFA',
                                                                                            textDecoration: 'none',
                                                                                            fontSize: '11px',
                                                                                            opacity: 0.8,
                                                                                            display: 'block',
                                                                                            wordBreak: 'break-all'
                                                                                        }}
                                                                                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                                                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                                                                                    >
                                                                                        {displayUrl}
                                                                                    </a>
                                                                                </div>
                                                                            );
                                                                        })}

                                                                        {/* Control View */}
                                                                        {currentInterface.endpoints.filter(e => e.type === 'full-app').map((endpoint, index) => {
                                                                            const displayUrl = endpoint.url.replace(/^https?:\/\//, '');
                                                                            return (
                                                                                <div key={`fa-${index}`} style={{
                                                                                    padding: '12px 0',
                                                                                    borderBottom: '1px solid #333',
                                                                                }}>
                                                                                    <div style={{
                                                                                        display: 'flex',
                                                                                        justifyContent: 'space-between',
                                                                                        alignItems: 'center',
                                                                                        marginBottom: '8px'
                                                                                    }}>
                                                                                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>
                                                                                            Control
                                                                                        </div>
                                                                                        <div
                                                                                            onClick={(e) => handleCopyUrl(endpoint.url, e)}
                                                                                            style={{
                                                                                                color: '#61BAFA',
                                                                                                cursor: 'pointer',
                                                                                                fontSize: '20px',
                                                                                                opacity: 0.7,
                                                                                                transition: 'all 0.2s ease',
                                                                                                display: 'flex',
                                                                                                alignItems: 'center'
                                                                                            }}
                                                                                            onMouseEnter={(e) => {
                                                                                                e.currentTarget.style.opacity = '1';
                                                                                            }}
                                                                                            onMouseLeave={(e) => {
                                                                                                e.currentTarget.style.opacity = '0.7';
                                                                                            }}
                                                                                            title="Copy URL to clipboard"
                                                                                        >
                                                                                            <FaCopy />
                                                                                        </div>
                                                                                    </div>
                                                                                    <a
                                                                                        href="#"
                                                                                        onClick={(e) => {
                                                                                            e.preventDefault();
                                                                                            if ((window as any).electronAPI?.openExternal) {
                                                                                                (window as any).electronAPI.openExternal(endpoint.url);
                                                                                            } else {
                                                                                                window.open(endpoint.url, '_blank', 'noopener,noreferrer');
                                                                                            }
                                                                                        }}
                                                                                        style={{
                                                                                            color: '#61BAFA',
                                                                                            textDecoration: 'none',
                                                                                            fontSize: '11px',
                                                                                            opacity: 0.8,
                                                                                            display: 'block',
                                                                                            wordBreak: 'break-all'
                                                                                        }}
                                                                                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                                                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                                                                                    >
                                                                                        {displayUrl}
                                                                                    </a>
                                                                                </div>
                                                                            );
                                                                        })}

                                                                        {/* Individual Pages - only show if more than one page */}
                                                                        {pages.length > 1 && currentInterface.endpoints.filter(e => e.type === 'page').map((endpoint, index) => {
                                                                            const displayUrl = endpoint.url.replace(/^https?:\/\//, '');
                                                                            return (
                                                                                <div key={`page-${index}`} style={{
                                                                                    padding: '12px 0',
                                                                                    borderBottom: '1px solid #333',
                                                                                }}>
                                                                                    <div style={{
                                                                                        display: 'flex',
                                                                                        justifyContent: 'space-between',
                                                                                        alignItems: 'center',
                                                                                        marginBottom: '8px'
                                                                                    }}>
                                                                                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>
                                                                                            {endpoint.pageName}
                                                                                        </div>
                                                                                        <div
                                                                                            onClick={(e) => handleCopyUrl(endpoint.url, e)}
                                                                                            style={{
                                                                                                color: '#61BAFA',
                                                                                                cursor: 'pointer',
                                                                                                fontSize: '20px',
                                                                                                opacity: 0.7,
                                                                                                transition: 'all 0.2s ease',
                                                                                                display: 'flex',
                                                                                                alignItems: 'center'
                                                                                            }}
                                                                                            onMouseEnter={(e) => {
                                                                                                e.currentTarget.style.opacity = '1';
                                                                                            }}
                                                                                            onMouseLeave={(e) => {
                                                                                                e.currentTarget.style.opacity = '0.7';
                                                                                            }}
                                                                                            title="Copy URL to clipboard"
                                                                                        >
                                                                                            <FaCopy />
                                                                                        </div>
                                                                                    </div>
                                                                                    <a
                                                                                        href="#"
                                                                                        onClick={(e) => {
                                                                                            e.preventDefault();
                                                                                            if ((window as any).electronAPI?.openExternal) {
                                                                                                (window as any).electronAPI.openExternal(endpoint.url);
                                                                                            } else {
                                                                                                window.open(endpoint.url, '_blank', 'noopener,noreferrer');
                                                                                            }
                                                                                        }}
                                                                                        style={{
                                                                                            color: '#61BAFA',
                                                                                            textDecoration: 'none',
                                                                                            fontSize: '11px',
                                                                                            opacity: 0.8,
                                                                                            display: 'block',
                                                                                            wordBreak: 'break-all'
                                                                                        }}
                                                                                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                                                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                                                                                    >
                                                                                        {displayUrl}
                                                                                    </a>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </>
                            )}
                        </>
                    )}

                    <div className='section-label-container' onClick={(e) => { e.stopPropagation(); toggleSection('configuration'); }}>
                        <span className='section-label'>CONFIGURATION</span>
                        {collapsedSections.configuration ? <FaChevronDown /> : <FaChevronUp />}
                    </div>
                    {!collapsedSections.configuration && (
                        <>
                            <div className='menu-section'>
                                <button onClick={downloadConfig}>SAVE</button>
                                <button onClick={triggerFileInput}>LOAD</button>
                            </div>
                        </>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleFileRestore}
                        style={{ display: 'none' }}
                    />
                    <input
                        ref={backgroundImageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleBackgroundImageChange}
                        style={{ display: 'none' }}
                    />
                    <span className='footer'>v{packageJson.version}<br />Created by Tom Hillmeyer</span>
                </div>
            </div>

            {/* Config Load Dialog */}
            {showConfigDialog && (
                <div className="config-dialog-overlay">
                    <div className="config-dialog">
                        <h3>LOAD CONFIGURATION FROM FILE</h3>
                        <div className="config-dialog-buttons">
                            <button
                                className="config-dialog-button add-boxes"
                                onClick={handleAddBoxesOnly}
                            >
                                ADD BOXES ONLY
                            </button>
                            <button
                                className="config-dialog-button replace-all"
                                onClick={handleReplaceEntireConfig}
                            >
                                REPLACE EVERYTHING
                            </button>
                        </div>
                        <button
                            className="config-dialog-cancel"
                            onClick={() => {
                                setShowConfigDialog(false);
                                setPendingConfig(null);
                            }}
                        >
                            CANCEL
                        </button>
                    </div>
                </div>
            )}

            {/* Canvas ROI Modal */}
            {showCanvasROIModal && canvasBackgroundVideoDeviceId && (
                <ROIModal
                    deviceId={canvasBackgroundVideoDeviceId}
                    initialROI={canvasBackgroundVideoROI}
                    onSave={(roi: ROI) => {
                        onCanvasBackgroundVideoROIChange?.(roi);
                        setShowCanvasROIModal(false);
                    }}
                    onCancel={() => setShowCanvasROIModal(false)}
                />
            )}
        </div>
    );
});

export default SettingsMenu;