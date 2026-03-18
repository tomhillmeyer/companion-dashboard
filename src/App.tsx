import { useState, useEffect, useRef } from 'react';
import { v4 as uuid } from 'uuid';
import Box from './Box.tsx';
import SettingsMenu from './SettingsMenu.tsx';
import FindReplaceModal from './FindReplaceModal.tsx';
import { PageTabs } from './PageTabs.tsx';
import './App.css';
import defaultBoxes from './defaultBoxes.json';
import dashboardLogo from './assets/dashboard.png';
import { useVariableFetcher } from './useVariableFetcher';
import { TitleBar } from './TitleBar.tsx';
import { Capacitor } from '@capacitor/core';
import { VideoRelayManager } from './VideoRelayManager';
import type { BoxData, CompanionConnection, VariableColor, PageData } from './types';
import Moveable from 'react-moveable';
import { evaluateComparison } from './variableComparison';


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
const PAGES_STORAGE_KEY = `window_${windowId}_pages`;
const CURRENT_PAGE_STORAGE_KEY = `window_${windowId}_current_page`;
const CANVAS_STORAGE_KEY = `window_${windowId}_canvas_settings`;
const CONNECTIONS_STORAGE_KEY = `window_${windowId}_companion_connections`;
const FONT_STORAGE_KEY = `global_font_family`;
const LOCK_STORAGE_KEY = `window_${windowId}_boxes_locked`;
const SCALE_ENABLED_KEY = `window_${windowId}_scale_enabled`;
const DESIGN_WIDTH_KEY = `window_${windowId}_design_width`;

// Type definitions now imported from ./types.ts





export default function App() {
    // Helper function to add default operator to variable conditions
    const migrateVariableConditions = (conditions: any[] | undefined) => {
        if (!conditions) return [];
        return conditions.map((cond: any) => ({
            ...cond,
            operator: cond.operator ?? '=='
        }));
    };

    // Initialize pages state with localStorage data
    const [pages, setPages] = useState<PageData[]>(() => {
        const savedPages = localStorage.getItem(PAGES_STORAGE_KEY);
        if (savedPages) {
            try {
                return JSON.parse(savedPages);
            } catch (error) {
                console.error('Failed to parse saved pages:', error);
                return [{ id: uuid(), name: 'Page 1', order: 0 }];
            }
        } else {
            return [{ id: uuid(), name: 'Page 1', order: 0 }];
        }
    });

    // Initialize current page
    const [currentPageId, setCurrentPageId] = useState<string>(() => {
        const savedCurrentPage = localStorage.getItem(CURRENT_PAGE_STORAGE_KEY);
        if (savedCurrentPage && pages.some(p => p.id === savedCurrentPage)) {
            return savedCurrentPage;
        }
        return pages[0]?.id || '';
    });

    // Initialize state with localStorage data immediately
    const [boxes, setBoxes] = useState<BoxData[]>(() => {
        const savedBoxes = localStorage.getItem(STORAGE_KEY);
        const defaultPageId = pages[0]?.id || '';
        if (savedBoxes) {
            try {
                const parsed = JSON.parse(savedBoxes);
                // Ensure all boxes have required fields (migration for older boxes)
                return parsed.map((box: BoxData) => ({
                    ...box,
                    pageId: box.pageId ?? defaultPageId, // Migrate old boxes to first page
                    anchorPoint: box.anchorPoint ?? 'top-left',
                    leftRightRatio: box.leftRightRatio ?? 50,
                    leftVisible: box.leftVisible ?? true,
                    rightVisible: box.rightVisible ?? true,
                    opacity: box.opacity ?? 100,
                    opacitySource: box.opacitySource ?? "",
                    opacityVariableValues: migrateVariableConditions(box.opacityVariableValues),
                    overlayColor: box.overlayColor ?? "#00000000",
                    overlayColorText: box.overlayColorText ?? "",
                    overlayVariableColors: migrateVariableConditions(box.overlayVariableColors),
                    overlayDirection: box.overlayDirection ?? 'bottom',
                    overlaySize: box.overlaySize ?? 100,
                    overlaySizeSource: box.overlaySizeSource ?? "",
                    overlaySizeVariableValues: migrateVariableConditions(box.overlaySizeVariableValues),
                    backgroundVariableColors: migrateVariableConditions(box.backgroundVariableColors),
                    borderVariableColors: migrateVariableConditions(box.borderVariableColors),
                    headerVariableColors: migrateVariableConditions(box.headerVariableColors),
                    headerLabelVariableColors: migrateVariableConditions(box.headerLabelVariableColors),
                    leftLabelVariableColors: migrateVariableConditions(box.leftLabelVariableColors),
                    rightLabelVariableColors: migrateVariableConditions(box.rightLabelVariableColors)
                }));
            } catch (error) {
                console.error('Failed to parse saved boxes:', error);
                return defaultBoxes.map(box => ({ ...box, pageId: defaultPageId }));
            }
        } else {
            return defaultBoxes.map(box => ({ ...box, pageId: defaultPageId }));
        }
    });




    const handleConfigRestore = (newBoxes: BoxData[], newConnectionUrl: string, canvasSettings?: any, importedPages?: PageData[]) => {
        // Migrate boxes during restore
        const defaultPageId = pages[0]?.id || '';
        const migratedBoxes = newBoxes.map((box: BoxData) => ({
            ...box,
            pageId: box.pageId ?? defaultPageId, // Assign to first page if no pageId
            opacityVariableValues: migrateVariableConditions(box.opacityVariableValues),
            overlayVariableColors: migrateVariableConditions(box.overlayVariableColors),
            overlaySizeVariableValues: migrateVariableConditions(box.overlaySizeVariableValues),
            backgroundVariableColors: migrateVariableConditions(box.backgroundVariableColors),
            borderVariableColors: migrateVariableConditions(box.borderVariableColors),
            headerVariableColors: migrateVariableConditions(box.headerVariableColors),
            headerLabelVariableColors: migrateVariableConditions(box.headerLabelVariableColors),
            leftLabelVariableColors: migrateVariableConditions(box.leftLabelVariableColors),
            rightLabelVariableColors: migrateVariableConditions(box.rightLabelVariableColors)
        }));

        setBoxes(migratedBoxes);
        setCompanionBaseUrl(newConnectionUrl);
        setSelectedBoxIds([]); // Clear any selection

        // Handle pages import if provided
        if (importedPages && importedPages.length > 0) {
            setPages(importedPages);
            // Set current page to first imported page
            setCurrentPageId(importedPages[0].id);
        }

        // Apply canvas settings if provided
        if (canvasSettings) {
            if (canvasSettings.canvasBackgroundColor !== undefined) {
                setCanvasBackgroundColor(canvasSettings.canvasBackgroundColor);
            }
            if (canvasSettings.canvasBackgroundColorText !== undefined) {
                setCanvasBackgroundColorText(canvasSettings.canvasBackgroundColorText);
            }
            if (canvasSettings.canvasBackgroundVariableColors !== undefined) {
                setCanvasBackgroundVariableColors(migrateVariableConditions(canvasSettings.canvasBackgroundVariableColors));
            }
            if (canvasSettings.canvasBackgroundImageOpacity !== undefined) {
                setCanvasBackgroundImageOpacity(canvasSettings.canvasBackgroundImageOpacity);
            }
            if (canvasSettings.canvasBackgroundImageSize !== undefined) {
                setCanvasBackgroundImageSize(canvasSettings.canvasBackgroundImageSize);
            }
            if (canvasSettings.canvasBackgroundImageWidth !== undefined) {
                setCanvasBackgroundImageWidth(canvasSettings.canvasBackgroundImageWidth);
            }
            if (canvasSettings.canvasBackgroundVideoDeviceId !== undefined) {
                setCanvasBackgroundVideoDeviceId(canvasSettings.canvasBackgroundVideoDeviceId);
            }
            if (canvasSettings.canvasBackgroundVideoSize !== undefined) {
                setCanvasBackgroundVideoSize(canvasSettings.canvasBackgroundVideoSize);
            }
            if (canvasSettings.canvasBackgroundVideoROI !== undefined) {
                setCanvasBackgroundVideoROI(canvasSettings.canvasBackgroundVideoROI);
            }
            if (canvasSettings.refreshRateMs !== undefined) {
                setRefreshRateMs(canvasSettings.refreshRateMs);
            }
        }
    };

    const deleteAllBoxes = () => {
        setBoxes([]);
        setSelectedBoxIds([]); // Clear any selection
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
            },
            // Ensure leftRightRatio has a valid value
            leftRightRatio: originalBoxData.leftRightRatio ?? 50
        };
        setBoxes((prev) => [...prev, duplicatedBox]);
    };

    // Page management handlers
    const handlePageAdd = () => {
        const newPage: PageData = {
            id: uuid(),
            name: `Page ${pages.length + 1}`,
            order: pages.length
        };
        setPages(prev => [...prev, newPage]);
        setCurrentPageId(newPage.id);
    };

    const handlePageChange = (pageId: string) => {
        if (isDisplayMode) {
            // In display mode, update separate state (doesn't persist to localStorage)
            setDisplayModePageId(pageId);
        } else {
            // In control mode, update localStorage-backed state
            setCurrentPageId(pageId);
        }
        setSelectedBoxIds([]); // Clear selection when changing pages
    };

    const handlePageRename = (pageId: string, newName: string) => {
        setPages(prev => prev.map(page =>
            page.id === pageId ? { ...page, name: newName } : page
        ));
    };

    const handlePageDelete = (pageId: string) => {
        // Don't allow deleting the last page
        if (pages.length <= 1) return;

        // Delete all boxes on this page
        setBoxes(prev => prev.filter(box => box.pageId !== pageId));

        // Remove the page
        setPages(prev => prev.filter(page => page.id !== pageId));

        // If we're deleting the current page, switch to the first remaining page
        if (currentPageId === pageId) {
            const remainingPages = pages.filter(page => page.id !== pageId);
            if (remainingPages.length > 0) {
                setCurrentPageId(remainingPages[0].id);
            }
        }
    };


    const [selectedBoxIds, setSelectedBoxIds] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [findReplaceModalOpen, setFindReplaceModalOpen] = useState<boolean>(false);
    const [isConnected, setIsConnected] = useState<boolean>(true);
    const reconnectIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const webSocketRef = useRef<WebSocket | null>(null);
    const hasReceivedInitialStateRef = useRef<boolean>(false);
    const videoRelayManagerRef = useRef<VideoRelayManager | null>(null);
    const [videoRelayManagerReady, setVideoRelayManagerReady] = useState(false);
    const boxRefsMap = useRef<Record<string, HTMLDivElement | null>>({});

    // Mouse movement tracking for auto-hide page tabs
    const [showPageTabs, setShowPageTabs] = useState<boolean>(false);
    const mouseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Grid lines for snapping (same as Box component)
    const getGridLines = (gridSize: number) => {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const numVerticalLines = Math.ceil(viewportWidth / gridSize);
        const numHorizontalLines = Math.ceil(viewportHeight / gridSize);
        return {
            verticalGridLines: Array.from({ length: numVerticalLines + 1 }, (_, i) => i * gridSize),
            horizontalGridLines: Array.from({ length: numHorizontalLines + 1 }, (_, i) => i * gridSize),
        };
    };
    const [gridLines, setGridLines] = useState(() => getGridLines(15));

    // Update grid lines on window resize
    useEffect(() => {
        const handleResize = () => {
            setGridLines(getGridLines(15));
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Mouse movement tracking for auto-hide page tabs
    useEffect(() => {
        const handleMouseMove = () => {
            setShowPageTabs(true);
            if (mouseTimeoutRef.current) {
                clearTimeout(mouseTimeoutRef.current);
            }
            mouseTimeoutRef.current = setTimeout(() => {
                setShowPageTabs(false);
            }, 3000);
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            if (mouseTimeoutRef.current) {
                clearTimeout(mouseTimeoutRef.current);
            }
        };
    }, []);

    // Track dragging state globally for WebSocket sync
    useEffect(() => {
        (window as any).isDraggingBox = isDragging;
    }, [isDragging]);
    const [companionBaseUrl, setCompanionBaseUrl] = useState<string>(() => {
        // Web clients don't fetch directly - they get URL via WebSocket
        const isWebClient = typeof window !== 'undefined' && !(window as any).electronAPI;
        if (isWebClient) {
            return '';
        }
        return localStorage.getItem('companion_connection_url') || '';
    });
    const [mainConnectionValid, setMainConnectionValid] = useState<boolean | null>(null);
    const [additionalConnectionValidities, setAdditionalConnectionValidities] = useState<{ [key: string]: boolean | null }>({});
    const [connections, setConnections] = useState<CompanionConnection[]>(() => {
        // Web clients don't fetch directly - they get connections via WebSocket
        const isWebClient = typeof window !== 'undefined' && !(window as any).electronAPI;
        if (isWebClient) {
            return [];
        }
        // Load from localStorage for Electron only
        const saved = localStorage.getItem(CONNECTIONS_STORAGE_KEY);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (error) {
                return [];
            }
        }
        return [];
    });

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
                return migrateVariableConditions(parsed.canvasBackgroundVariableColors);
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
    const [canvasBackgroundImageSize, setCanvasBackgroundImageSize] = useState<'cover' | 'contain' | 'width'>(() => {
        const saved = localStorage.getItem(CANVAS_STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return parsed.canvasBackgroundImageSize || 'cover';
            } catch (error) {
                return 'cover';
            }
        }
        return 'cover';
    });
    const [canvasBackgroundImageWidth, setCanvasBackgroundImageWidth] = useState<number>(() => {
        const saved = localStorage.getItem(CANVAS_STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return parsed.canvasBackgroundImageWidth || 1920;
            } catch (error) {
                return 1920;
            }
        }
        return 1920;
    });
    const [canvasBackgroundVideoDeviceId, setCanvasBackgroundVideoDeviceId] = useState<string>(() => {
        const saved = localStorage.getItem(CANVAS_STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return parsed.canvasBackgroundVideoDeviceId || '';
            } catch (error) {
                return '';
            }
        }
        return '';
    });
    const [canvasBackgroundVideoSize, setCanvasBackgroundVideoSize] = useState<'cover' | 'contain'>(() => {
        const saved = localStorage.getItem(CANVAS_STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return parsed.canvasBackgroundVideoSize || 'cover';
            } catch (error) {
                return 'cover';
            }
        }
        return 'cover';
    });
    const [canvasBackgroundVideoROI, setCanvasBackgroundVideoROI] = useState<{ x: number; y: number; width: number; height: number } | undefined>(() => {
        const saved = localStorage.getItem(CANVAS_STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return parsed.canvasBackgroundVideoROI;
            } catch (error) {
                return undefined;
            }
        }
        return undefined;
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

    // Scaling state - initialize from localStorage
    const [scaleEnabled, setScaleEnabled] = useState<boolean>(() => {
        const saved = localStorage.getItem(SCALE_ENABLED_KEY);
        return saved === 'true';
    });

    const [designWidth, setDesignWidth] = useState<number>(() => {
        const saved = localStorage.getItem(DESIGN_WIDTH_KEY);
        return saved ? parseInt(saved) : 1920;
    });

    const [scale, setScale] = useState<number>(1);

    // Check if we're in display mode (root path with optional ?page param, not /control)
    const [isDisplayMode] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        const pathname = window.location.pathname;
        const isRootPath = pathname === '/';
        const isElectron = !!(window as any).electronAPI;
        const isCapacitor = Capacitor.isNativePlatform();
        return isRootPath && !isElectron && !isCapacitor;
    });

    // Extract page slug from URL query parameter (?page=slug)
    const initialPageSlugFromUrl = (() => {
        if (typeof window === 'undefined') return null;
        const params = new URLSearchParams(window.location.search);
        return params.get('page');
    })();

    // Track whether URL has a page parameter (for hiding tabs)
    const hasPageParamInUrl = initialPageSlugFromUrl !== null;

    // State for current page in display mode (allows navigation without localStorage)
    const [displayModePageId, setDisplayModePageId] = useState<string | null>(null);

    // Helper function to convert page name to URL slug
    const pageNameToSlug = (name: string): string => {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
            .replace(/^-+|-+$/g, ''); // Trim hyphens from start/end
    };

    // Find page ID from slug when in page-specific mode
    const pageIdFromSlug = initialPageSlugFromUrl ?
        pages.find(p => pageNameToSlug(p.name) === initialPageSlugFromUrl)?.id : null;

    // Override current page if we're on a page-specific URL
    // If in display mode without a page param, use displayModePageId or default to first page
    const effectiveCurrentPageId = pageIdFromSlug ||
        (isDisplayMode && pages.length > 0 ? (displayModePageId || pages[0]?.id) : currentPageId);

    // Boxes locked state - initialize from localStorage, but force true in display mode
    const [boxesLocked, setBoxesLocked] = useState<boolean>(() => {
        if (isDisplayMode) {
            return true; // Always locked in display mode
        }
        const saved = localStorage.getItem(LOCK_STORAGE_KEY);
        return saved === 'true';
    });

    // Apply font immediately on component mount
    useEffect(() => {
        const savedFont = localStorage.getItem(FONT_STORAGE_KEY) || 'Work Sans';
        document.documentElement.style.setProperty('--box-font-family', `"${savedFont}", system-ui, Avenir, Helvetica, Arial, sans-serif`);
    }, []);

    const settingsMenuRef = useRef<{ toggle: () => void }>(null);
    const canvasVideoRef = useRef<HTMLVideoElement>(null);

    // Save boxes to localStorage whenever boxes state changes
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(boxes));
    }, [boxes]);

    // Save pages to localStorage whenever pages state changes
    useEffect(() => {
        localStorage.setItem(PAGES_STORAGE_KEY, JSON.stringify(pages));
    }, [pages]);

    // Save current page to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem(CURRENT_PAGE_STORAGE_KEY, currentPageId);
    }, [currentPageId]);

    // Save canvas settings to localStorage whenever canvas state changes
    useEffect(() => {
        const canvasSettings = {
            canvasBackgroundColor,
            canvasBackgroundColorText,
            canvasBackgroundVariableColors,
            canvasBackgroundImageOpacity,
            canvasBackgroundImageSize,
            canvasBackgroundImageWidth,
            canvasBackgroundVideoDeviceId,
            canvasBackgroundVideoSize,
            canvasBackgroundVideoROI,
            refreshRateMs
        };
        localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify(canvasSettings));
    }, [canvasBackgroundColor, canvasBackgroundColorText, canvasBackgroundVariableColors, canvasBackgroundImageOpacity, canvasBackgroundImageSize, canvasBackgroundImageWidth, canvasBackgroundVideoDeviceId, canvasBackgroundVideoSize, canvasBackgroundVideoROI, refreshRateMs]);

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

    // Save boxes locked state to localStorage whenever it changes (except in display mode)
    useEffect(() => {
        if (!isDisplayMode) {
            localStorage.setItem(LOCK_STORAGE_KEY, boxesLocked.toString());
        }
    }, [boxesLocked, isDisplayMode]);

    // Save scaling settings to localStorage
    useEffect(() => {
        localStorage.setItem(SCALE_ENABLED_KEY, scaleEnabled.toString());
    }, [scaleEnabled]);

    useEffect(() => {
        localStorage.setItem(DESIGN_WIDTH_KEY, designWidth.toString());
    }, [designWidth]);

    // Handle canvas video stream setup and cleanup
    useEffect(() => {
        const isWebClient = typeof window !== 'undefined' && !(window as any).electronAPI;
        const canvasStreamId = 'canvas-background'; // Unique ID for canvas video stream

        console.log('[Canvas Video Effect] Running - isWebClient:', isWebClient, 'deviceId:', canvasBackgroundVideoDeviceId, 'videoRelayManagerReady:', videoRelayManagerReady);

        const setupVideoStream = async () => {
            // If no device ID is set, clean up and stop here
            if (!canvasBackgroundVideoDeviceId) {
                console.log('[Canvas Video Effect] No device ID set, skipping');
                if (canvasVideoRef.current) {
                    canvasVideoRef.current.srcObject = null;
                }
                return;
            }

            // Clean up any existing stream first (just clear the reference, don't stop tracks)
            // VideoRelayManager is responsible for managing track lifecycle
            if (canvasVideoRef.current && canvasVideoRef.current.srcObject) {
                canvasVideoRef.current.srcObject = null;
            }

            // Web client: Request video stream via WebRTC
            if (isWebClient) {
                if (!videoRelayManagerRef.current) {
                    // VideoRelayManager initializes when WebSocket connects
                    return;
                }
                console.log(`[Web Client] Requesting canvas video stream for device: ${canvasBackgroundVideoDeviceId}`);
                videoRelayManagerRef.current.requestVideoStream(canvasBackgroundVideoDeviceId, canvasStreamId, (stream) => {
                    console.log(`[Web Client] Received canvas video stream for device: ${canvasBackgroundVideoDeviceId}`);
                    if (canvasVideoRef.current) {
                        canvasVideoRef.current.srcObject = stream;
                    }
                });
                return;
            }

            // Electron host: Get stream from VideoRelayManager (which manages device capture)
            if (videoRelayManagerRef.current) {
                console.log(`[Electron Host] Requesting canvas stream for device: ${canvasBackgroundVideoDeviceId}`);

                // Increment reference count for this device
                videoRelayManagerRef.current.incrementDeviceRef(canvasBackgroundVideoDeviceId);

                // Start broadcasting (will only capture once if not already broadcasting)
                await videoRelayManagerRef.current.startBroadcasting(canvasBackgroundVideoDeviceId);

                // Get the stream from VideoRelayManager
                const stream = videoRelayManagerRef.current.getLocalStream(canvasBackgroundVideoDeviceId);

                if (stream && canvasVideoRef.current) {
                    canvasVideoRef.current.srcObject = stream;
                    console.log(`[Electron Host] Set canvas video stream`);
                } else {
                    console.error(`[Electron Host] Failed to get stream for canvas device: ${canvasBackgroundVideoDeviceId}`);
                }
            }
        };

        setupVideoStream();

        // Cleanup function
        return () => {
            // Clear video element
            if (canvasVideoRef.current) {
                canvasVideoRef.current.srcObject = null;
            }

            // Cleanup WebRTC connections when device changes or component unmounts
            if (videoRelayManagerRef.current && canvasBackgroundVideoDeviceId) {
                if (isWebClient) {
                    console.log(`[Web Client] Closing canvas peer connection for device: ${canvasBackgroundVideoDeviceId}`);
                    videoRelayManagerRef.current.closePeerConnection(canvasBackgroundVideoDeviceId, canvasStreamId);
                } else {
                    console.log(`[Electron Host] Decrementing ref count for canvas device: ${canvasBackgroundVideoDeviceId}`);
                    videoRelayManagerRef.current.decrementDeviceRef(canvasBackgroundVideoDeviceId);
                }
            }
        };
    }, [canvasBackgroundVideoDeviceId, videoRelayManagerReady]);

    // Update scale factor when window resizes or settings change
    useEffect(() => {
        const updateScale = () => {
            if (scaleEnabled && typeof window !== 'undefined') {
                setScale(window.innerWidth / designWidth);
            } else {
                setScale(1);
            }
        };

        updateScale();
        window.addEventListener('resize', updateScale);
        return () => window.removeEventListener('resize', updateScale);
    }, [scaleEnabled, designWidth]);

    // Wrapper for setBoxesLocked that prevents changes in display mode
    const handleBoxesLockedChange = (locked: boolean) => {
        if (!isDisplayMode) {
            setBoxesLocked(locked);
        }
    };

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

    // Detect if running in web client mode (not Electron)
    const isWebClient = typeof window !== 'undefined' && !(window as any).electronAPI;

    // State for variables received via WebSocket (web clients only)
    const [receivedVariableValues, setReceivedVariableValues] = useState<{ [key: string]: string }>({});
    const [receivedVariableHtmlValues, setReceivedVariableHtmlValues] = useState<{ [key: string]: string }>({});

    // Use variable fetcher for all variables (Electron only - web clients get variables via WebSocket)
    const fetchedVariables = useVariableFetcher(
        isWebClient ? '' : companionBaseUrl, // Web clients don't fetch directly
        isWebClient ? {} : getAllVariableNames(), // Web clients don't fetch - pass empty sources
        isWebClient ? [] : connections, // Web clients don't use connections
        refreshRateMs,
        isDragging
    );

    // Use either fetched (Electron) or received (web client) variables
    const allVariableValues = isWebClient ? receivedVariableValues : fetchedVariables.values;
    const allHtmlVariableValues = isWebClient ? receivedVariableHtmlValues : fetchedVariables.htmlValues;

    // Broadcast variable updates to web clients (Electron only)
    useEffect(() => {
        const broadcastVariables = async () => {
            const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;
            if (!isElectron) {
                return; // Only Electron app broadcasts variables
            }

            try {
                // @ts-ignore - electronAPI is available via preload script
                await window.electronAPI?.webServer.updateVariables(allVariableValues, allHtmlVariableValues);
            } catch (error) {
                // Silently fail if web server is not available or not running
                console.debug('Variable broadcast failed:', error);
            }
        };

        broadcastVariables();
    }, [allVariableValues, allHtmlVariableValues]);

    // Update web server state when dashboard state changes
    useEffect(() => {
        const updateWebServer = async () => {
            const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;
            if (!isElectron) {
                return; // Only Electron broadcasts to web server
            }

            try {
                const canvasSettings = {
                    canvasBackgroundColor,
                    canvasBackgroundColorText,
                    canvasBackgroundVariableColors,
                    canvasBackgroundImageOpacity,
                    canvasBackgroundImageSize,
                    canvasBackgroundImageWidth,
                    canvasBackgroundVideoDeviceId,
                    canvasBackgroundVideoSize,
                    canvasBackgroundVideoROI,
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
                    pages,
                    canvasSettings,
                    connections,
                    companionBaseUrl,
                    variableValues: allVariableValues,
                    htmlVariableValues: allHtmlVariableValues,
                    imageData,
                    fontFamily,
                    scaleEnabled,
                    designWidth,
                    mainConnectionValid,
                    additionalConnectionValidities
                };

                // @ts-ignore - electronAPI is available via preload script
                await window.electronAPI?.webServer.updateState(state);
            } catch (error) {
                // Silently fail if web server is not available or not running
                console.debug('Web server update failed:', error);
            }
        };

        updateWebServer();
    }, [boxes, pages, canvasBackgroundColor, canvasBackgroundColorText, canvasBackgroundVariableColors, canvasBackgroundImageOpacity, canvasBackgroundImageSize, canvasBackgroundImageWidth, canvasBackgroundVideoDeviceId, canvasBackgroundVideoSize, canvasBackgroundVideoROI, refreshRateMs, connections, companionBaseUrl, allVariableValues, allHtmlVariableValues, fontFamily, scaleEnabled, designWidth, mainConnectionValid, additionalConnectionValidities]);

    // WebSocket sync for full app server (when running in browser)
    useEffect(() => {
        const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;
        const isCapacitor = Capacitor.isNativePlatform();
        // If running in Electron, listen for state changes from browser clients
        if (isElectron) {
            (window as any).electronAPI.onSyncStateFromBrowser(async (stateData: any) => {

                // Don't update while dragging - prevents flicker from echoed updates
                if ((window as any).isDraggingBox) {
                    return;
                }

                // Set flag to prevent sending this update back
                // Use a timestamp to batch all state updates from this message
                const batchId = Date.now();
                (window as any).isReceivingUpdate = batchId;

                // Update all state from incoming browser data
                if (stateData.boxes) {
                    setBoxes(stateData.boxes);
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateData.boxes));
                }

                if (stateData.canvasSettings) {
                    const cs = stateData.canvasSettings;
                    if (cs.canvasBackgroundColor !== undefined) setCanvasBackgroundColor(cs.canvasBackgroundColor);
                    if (cs.canvasBackgroundColorText !== undefined) setCanvasBackgroundColorText(cs.canvasBackgroundColorText);
                    if (cs.canvasBackgroundVariableColors !== undefined) setCanvasBackgroundVariableColors(migrateVariableConditions(cs.canvasBackgroundVariableColors));
                    if (cs.canvasBackgroundImageOpacity !== undefined) setCanvasBackgroundImageOpacity(cs.canvasBackgroundImageOpacity);
                    if (cs.canvasBackgroundImageSize !== undefined) setCanvasBackgroundImageSize(cs.canvasBackgroundImageSize);
                    if (cs.canvasBackgroundImageWidth !== undefined) setCanvasBackgroundImageWidth(cs.canvasBackgroundImageWidth);
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

                // Store image data in IndexedDB
                if (stateData.imageData) {
                    for (const [filename, data] of Object.entries(stateData.imageData)) {
                        if (typeof data === 'string') {
                            await storeImageInDB(filename, data);
                        }
                    }
                }

                if (stateData.scaleEnabled !== undefined) {
                    setScaleEnabled(stateData.scaleEnabled);
                    localStorage.setItem(SCALE_ENABLED_KEY, stateData.scaleEnabled.toString());
                }

                if (stateData.designWidth !== undefined) {
                    setDesignWidth(stateData.designWidth);
                    localStorage.setItem(DESIGN_WIDTH_KEY, stateData.designWidth.toString());
                }

                // Clear the receiving flag after a short delay to ensure all state updates are processed
                setTimeout(() => {
                    if ((window as any).isReceivingUpdate === batchId) {
                        (window as any).isReceivingUpdate = false;
                    }
                }, 100);
            });
        }

        // If running in browser (not Electron and not Capacitor), connect to WebSocket
        if (!isElectron && !isCapacitor) {

            const connectWebSocket = () => {
                // Close existing WebSocket if it exists
                if (webSocketRef.current && webSocketRef.current.readyState !== WebSocket.CLOSED) {
                    webSocketRef.current.close();
                }

                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                // Include the current path so server knows if this is /control or read-only
                const path = window.location.pathname.startsWith('/control') ? '/control' : '/';
                const wsUrl = `${protocol}//${window.location.host}${path}`;

                const ws = new WebSocket(wsUrl);
                webSocketRef.current = ws;

                ws.onopen = () => {
                    setIsConnected(true);

                    // Initialize VideoRelayManager for web clients
                    if (!videoRelayManagerRef.current) {
                        videoRelayManagerRef.current = new VideoRelayManager(false); // false = web client
                    }
                    videoRelayManagerRef.current.setWebSocket(ws);
                    setVideoRelayManagerReady(true); // Trigger re-render of Box components

                    // Clear reconnect interval if it exists
                    if (reconnectIntervalRef.current) {
                        clearInterval(reconnectIntervalRef.current);
                        reconnectIntervalRef.current = null;
                    }
                };

                ws.onmessage = async (event) => {
                    try {
                        const message = JSON.parse(event.data);

                        if (message.type === 'variableUpdate' && message.data) {
                            // Receive variable updates from Electron app
                            const { variableValues, variableHtmlValues } = message.data;
                            setReceivedVariableValues(variableValues);
                            setReceivedVariableHtmlValues(variableHtmlValues);
                            return;
                        }

                        if (message.type === 'stateUpdate' && message.data) {
                            const data = message.data;

                            // If user is actively dragging, ignore incoming updates completely
                            if ((window as any).isDraggingBox) {
                                return;
                            }

                            // Mark that we've received initial state
                            hasReceivedInitialStateRef.current = true;

                            // Set flag to prevent sending this update back
                            // Use a timestamp to batch all state updates from this message
                            const batchId = Date.now();
                            (window as any).isReceivingUpdate = batchId;

                            // Update boxes
                            if (data.boxes) {
                                setBoxes(data.boxes);
                                localStorage.setItem(STORAGE_KEY, JSON.stringify(data.boxes));
                            }

                            // Update pages
                            if (data.pages) {
                                setPages(data.pages);
                                localStorage.setItem(PAGES_STORAGE_KEY, JSON.stringify(data.pages));
                            }

                            // Update canvas settings
                            if (data.canvasSettings) {
                                const cs = data.canvasSettings;
                                if (cs.canvasBackgroundColor !== undefined) setCanvasBackgroundColor(cs.canvasBackgroundColor);
                                if (cs.canvasBackgroundColorText !== undefined) setCanvasBackgroundColorText(cs.canvasBackgroundColorText);
                                if (cs.canvasBackgroundVariableColors !== undefined) setCanvasBackgroundVariableColors(migrateVariableConditions(cs.canvasBackgroundVariableColors));
                                if (cs.canvasBackgroundImageOpacity !== undefined) setCanvasBackgroundImageOpacity(cs.canvasBackgroundImageOpacity);
                                if (cs.canvasBackgroundImageSize !== undefined) setCanvasBackgroundImageSize(cs.canvasBackgroundImageSize);
                                if (cs.canvasBackgroundImageWidth !== undefined) setCanvasBackgroundImageWidth(cs.canvasBackgroundImageWidth);
                                if (cs.canvasBackgroundVideoDeviceId !== undefined) setCanvasBackgroundVideoDeviceId(cs.canvasBackgroundVideoDeviceId);
                                if (cs.canvasBackgroundVideoSize !== undefined) setCanvasBackgroundVideoSize(cs.canvasBackgroundVideoSize);
                                if (cs.canvasBackgroundVideoROI !== undefined) setCanvasBackgroundVideoROI(cs.canvasBackgroundVideoROI);
                                if (cs.refreshRateMs !== undefined) setRefreshRateMs(cs.refreshRateMs);
                                localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify(cs));
                            }

                            // Update connections (web clients don't save to localStorage - they're just remote views)
                            if (data.connections) {
                                setConnections(data.connections);
                            }

                            // Update companion base URL (web clients don't save to localStorage - they're just remote views)
                            if (data.companionBaseUrl !== undefined) {
                                setCompanionBaseUrl(data.companionBaseUrl);
                            }

                            // Update font family (web clients don't save to localStorage - they're just remote views)
                            if (data.fontFamily !== undefined) {
                                setFontFamily(data.fontFamily);
                                document.documentElement.style.setProperty('--box-font-family', `"${data.fontFamily}", system-ui, Avenir, Helvetica, Arial, sans-serif`);
                            }

                            // Store image data in IndexedDB
                            if (data.imageData) {
                                for (const [filename, imageData] of Object.entries(data.imageData)) {
                                    if (typeof imageData === 'string') {
                                        await storeImageInDB(filename, imageData);
                                    }
                                }
                            }

                            // Update scaling settings
                            if (data.scaleEnabled !== undefined) {
                                setScaleEnabled(data.scaleEnabled);
                                localStorage.setItem(SCALE_ENABLED_KEY, data.scaleEnabled.toString());
                            }

                            if (data.designWidth !== undefined) {
                                setDesignWidth(data.designWidth);
                                localStorage.setItem(DESIGN_WIDTH_KEY, data.designWidth.toString());
                            }

                            // Update variable values (initial state)
                            if (data.variableValues) {
                                setReceivedVariableValues(data.variableValues);
                            }
                            if (data.htmlVariableValues) {
                                setReceivedVariableHtmlValues(data.htmlVariableValues);
                            }

                            // Update connection validities
                            if (data.mainConnectionValid !== undefined) {
                                setMainConnectionValid(data.mainConnectionValid);
                            }
                            if (data.additionalConnectionValidities) {
                                setAdditionalConnectionValidities(data.additionalConnectionValidities);
                            }

                            // Clear the receiving flag after a short delay to ensure all state updates are processed
                            setTimeout(() => {
                                if ((window as any).isReceivingUpdate === batchId) {
                                    (window as any).isReceivingUpdate = false;
                                }
                            }, 100);
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
                    setIsConnected(false);

                    // Start reconnection attempts
                    if (!reconnectIntervalRef.current) {
                        reconnectIntervalRef.current = setInterval(() => {
                            connectWebSocket();
                        }, 3000);
                    }
                };

                // Store WebSocket instance for sending changes (also accessible via ref)
                (window as any).fullAppServerWS = ws;
            };

            connectWebSocket();

            return () => {
                if (reconnectIntervalRef.current) {
                    clearInterval(reconnectIntervalRef.current);
                    reconnectIntervalRef.current = null;
                }
                if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
                    webSocketRef.current.close();
                }
                webSocketRef.current = null;
                // Cleanup video relay manager
                if (videoRelayManagerRef.current) {
                    videoRelayManagerRef.current.cleanup();
                    videoRelayManagerRef.current = null;
                }
            };
        } else if (isElectron) {
            // Initialize VideoRelayManager for Electron host
            videoRelayManagerRef.current = new VideoRelayManager(true); // true = Electron host
            videoRelayManagerRef.current.setupElectronHostSignaling();
            setVideoRelayManagerReady(true); // Trigger re-render of Box components
        }
    }, []);

    // Send state changes from browser to Electron via WebSocket
    useEffect(() => {
        const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;

        // Don't send while dragging
        if (isDragging) {
            return;
        }

        // Don't send until we've received initial state from Electron (prevents sending stale values on connect)
        if (!isElectron && !hasReceivedInitialStateRef.current) {
            return;
        }

        // Don't echo back updates we just received from Electron
        if (!isElectron && (window as any).isReceivingUpdate) {
            return;
        }

        if (!isElectron && (window as any).fullAppServerWS) {
            const ws = (window as any).fullAppServerWS;

            if (ws.readyState === WebSocket.OPEN) {
                const stateData = {
                    boxes,
                    canvasSettings: {
                        canvasBackgroundColor,
                        canvasBackgroundColorText,
                        canvasBackgroundVariableColors,
                        canvasBackgroundImageOpacity,
                        canvasBackgroundImageSize,
                        canvasBackgroundImageWidth,
                        canvasBackgroundVideoDeviceId,
                        canvasBackgroundVideoSize,
                        canvasBackgroundVideoROI,
                        refreshRateMs
                    },
                    connections,
                    companionBaseUrl,
                    fontFamily,
                    scaleEnabled,
                    designWidth
                };

                ws.send(JSON.stringify({
                    type: 'stateChange',
                    data: stateData
                }));
            }
        }
    }, [boxes, canvasBackgroundColor, canvasBackgroundColorText, canvasBackgroundVariableColors, canvasBackgroundImageOpacity, canvasBackgroundImageSize, canvasBackgroundImageWidth, canvasBackgroundVideoDeviceId, canvasBackgroundVideoSize, canvasBackgroundVideoROI, refreshRateMs, connections, companionBaseUrl, fontFamily, scaleEnabled, designWidth, isDragging]);

    // Canvas color resolution function (same as Box component)
    const resolveCanvasColor = (variableColors: VariableColor[], colorText: string, fallbackColor: string) => {
        // 1. Check variable colors first - find first matching variable that evaluates to true
        if (variableColors && Array.isArray(variableColors)) {
            for (const varColor of variableColors) {
                if (varColor && varColor.variable && varColor.value) {
                    const variableValue = allVariableValues[varColor.variable] || '';
                    if (evaluateComparison(variableValue, varColor.operator, varColor.value)) {
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

    // IndexedDB helper functions for App.tsx
    const storeImageInDB = async (filename: string, base64Data: string): Promise<void> => {
        const request = indexedDB.open('CompanionDashboardImages', 3);
        return new Promise((resolve, reject) => {
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction(['images'], 'readwrite');
                const store = transaction.objectStore('images');
                const imageData = { id: filename, data: base64Data };
                store.put(imageData);
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            };
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains('images')) {
                    db.createObjectStore('images', { keyPath: 'id' });
                }
            };
        });
    };

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

        // Determine background-size based on sizing mode
        let backgroundSize: string;
        let backgroundPosition: string;

        if (canvasBackgroundImageSize === 'cover') {
            backgroundSize = 'cover';
            backgroundPosition = 'center';
        } else if (canvasBackgroundImageSize === 'contain') {
            backgroundSize = 'contain';
            backgroundPosition = 'top left';
        } else { // width - apply scale factor if scaling is enabled
            const scaledWidth = scaleEnabled ? canvasBackgroundImageWidth * scale : canvasBackgroundImageWidth;
            backgroundSize = `${scaledWidth}px auto`;
            backgroundPosition = 'top left';
        }

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
                '--canvas-background-opacity': opacity,
                '--canvas-background-size': backgroundSize,
                '--canvas-background-position': backgroundPosition
            };
        }

        // If there's a manually uploaded background image, use it
        if (loadedBackgroundImage && typeof loadedBackgroundImage === 'string') {
            return {
                backgroundColor: canvasBackgroundColor, // Always use the solid color picker value as base
                position: 'relative' as const,
                '--canvas-background-image': `url(${loadedBackgroundImage})`,
                '--canvas-background-opacity': opacity,
                '--canvas-background-size': backgroundSize,
                '--canvas-background-position': backgroundPosition
            };
        }

        return {
            backgroundColor: baseColor
        };
    };

    const createNewBox = () => {
        const newBox: BoxData = {
            id: uuid(),
            pageId: currentPageId,
            frame: {
                translate: [30, 60] as [number, number],
                width: 600,
                height: 105,
            },
            anchorPoint: 'top-left',
            zIndex: 1,
            opacity: 100,
            opacitySource: "",
            opacityVariableValues: [],
            backgroundColor: "#262626",
            backgroundColorText: "",
            backgroundVariableColors: [],
            overlayColor: "#00000000",
            overlayColorText: "",
            overlayVariableColors: [],
            overlayDirection: 'left',
            overlaySize: 100,
            overlaySizeSource: "",
            overlaySizeVariableValues: [],
            borderColor: "#61BAFA",
            borderColorText: "",
            borderVariableColors: [],
            noBorder: true,
            borderRadius: 15,
            headerColor: '#19325c',
            headerColorText: "",
            headerVariableColors: [],
            headerLabelSource: 'Time of Day',
            headerLabel: 'NO CONNECTION',
            headerLabelSize: 16,
            headerLabelColor: '#ffffff',
            headerLabelColorText: "",
            headerLabelVariableColors: [],
            headerLabelVisible: true,
            headerLabelAlign: 'center',
            leftLabelSource: 'Time',
            leftLabel: '',
            leftLabelSize: 14,
            leftLabelColor: '#FFFFFF',
            leftLabelColorText: "",
            leftLabelVariableColors: [],
            leftVisible: true,
            leftLabelAlign: 'left',
            rightLabelSource: '$(internal:time_hms_12)',
            rightLabel: '',
            rightLabelSize: 20,
            rightLabelColor: '#FFFFFF',
            rightLabelColorText: "",
            rightLabelVariableColors: [],
            rightVisible: true,
            rightLabelAlign: 'right',
            leftRightRatio: 50,
            companionButtonLocation: '',
        };
        setBoxes((prev) => [...prev, newBox]);
    };


    // Handle find and replace
    const handleFindReplace = (findText: string, replaceText: string, targetBoxIds: string[]) => {
        setBoxes(prev => prev.map(box => {
            if (!targetBoxIds.includes(box.id)) return box;

            // Create a copy of the box to modify
            const updatedBox = { ...box };

            // Helper function to replace text in a string
            const replaceInString = (str: string | undefined): string => {
                if (!str) return '';
                return str.split(findText).join(replaceText);
            };

            // Replace in all text fields (excluding button press text)
            // Header text
            updatedBox.headerLabel = replaceInString(updatedBox.headerLabel);
            updatedBox.headerLabelSource = replaceInString(updatedBox.headerLabelSource);

            // Left text
            updatedBox.leftLabel = replaceInString(updatedBox.leftLabel);
            updatedBox.leftLabelSource = replaceInString(updatedBox.leftLabelSource);

            // Right text
            updatedBox.rightLabel = replaceInString(updatedBox.rightLabel);
            updatedBox.rightLabelSource = replaceInString(updatedBox.rightLabelSource);

            // Color text fields
            updatedBox.backgroundColorText = replaceInString(updatedBox.backgroundColorText);
            updatedBox.headerColorText = replaceInString(updatedBox.headerColorText);
            updatedBox.headerLabelColorText = replaceInString(updatedBox.headerLabelColorText);
            updatedBox.leftLabelColorText = replaceInString(updatedBox.leftLabelColorText);
            updatedBox.rightLabelColorText = replaceInString(updatedBox.rightLabelColorText);
            updatedBox.borderColorText = replaceInString(updatedBox.borderColorText);
            updatedBox.overlayColorText = replaceInString(updatedBox.overlayColorText);

            // Opacity source
            updatedBox.opacitySource = replaceInString(updatedBox.opacitySource);

            // Overlay size source
            updatedBox.overlaySizeSource = replaceInString(updatedBox.overlaySizeSource);

            // Replace in variable color arrays
            if (updatedBox.backgroundVariableColors) {
                updatedBox.backgroundVariableColors = updatedBox.backgroundVariableColors.map(vc => ({
                    ...vc,
                    variable: replaceInString(vc.variable),
                    value: replaceInString(vc.value)
                }));
            }
            if (updatedBox.headerVariableColors) {
                updatedBox.headerVariableColors = updatedBox.headerVariableColors.map(vc => ({
                    ...vc,
                    variable: replaceInString(vc.variable),
                    value: replaceInString(vc.value)
                }));
            }
            if (updatedBox.headerLabelVariableColors) {
                updatedBox.headerLabelVariableColors = updatedBox.headerLabelVariableColors.map(vc => ({
                    ...vc,
                    variable: replaceInString(vc.variable),
                    value: replaceInString(vc.value)
                }));
            }
            if (updatedBox.leftLabelVariableColors) {
                updatedBox.leftLabelVariableColors = updatedBox.leftLabelVariableColors.map(vc => ({
                    ...vc,
                    variable: replaceInString(vc.variable),
                    value: replaceInString(vc.value)
                }));
            }
            if (updatedBox.rightLabelVariableColors) {
                updatedBox.rightLabelVariableColors = updatedBox.rightLabelVariableColors.map(vc => ({
                    ...vc,
                    variable: replaceInString(vc.variable),
                    value: replaceInString(vc.value)
                }));
            }
            if (updatedBox.borderVariableColors) {
                updatedBox.borderVariableColors = updatedBox.borderVariableColors.map(vc => ({
                    ...vc,
                    variable: replaceInString(vc.variable),
                    value: replaceInString(vc.value)
                }));
            }
            if (updatedBox.overlayVariableColors) {
                updatedBox.overlayVariableColors = updatedBox.overlayVariableColors.map(vc => ({
                    ...vc,
                    variable: replaceInString(vc.variable),
                    value: replaceInString(vc.value)
                }));
            }

            // Replace in opacity variable values
            if (updatedBox.opacityVariableValues) {
                updatedBox.opacityVariableValues = updatedBox.opacityVariableValues.map(ov => ({
                    ...ov,
                    variable: replaceInString(ov.variable),
                    value: replaceInString(ov.value)
                }));
            }

            // Replace in overlay size variable values
            if (updatedBox.overlaySizeVariableValues) {
                updatedBox.overlaySizeVariableValues = updatedBox.overlaySizeVariableValues.map(osv => ({
                    ...osv,
                    variable: replaceInString(osv.variable),
                    value: replaceInString(osv.value)
                }));
            }

            return updatedBox;
        }));
    };

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Open find and replace with Cmd+Shift+F (Mac) or Ctrl+Shift+F (Windows/Linux)
            if (event.key === 'f' && (event.metaKey || event.ctrlKey) && event.shiftKey) {
                event.preventDefault();
                setFindReplaceModalOpen(true);
            }
            // Don't process other shortcuts if find/replace modal is open
            else if (findReplaceModalOpen) {
                return;
            }
            // Duplicate selected boxes with Cmd+D (Mac) or Ctrl+D (Windows/Linux)
            else if (event.key === 'd' && (event.metaKey || event.ctrlKey) && selectedBoxIds.length > 0) {
                event.preventDefault();
                event.stopPropagation();
                // Get all selected boxes
                const selectedBoxes = boxes.filter(b => selectedBoxIds.includes(b.id));
                // Create duplicated boxes with new IDs and offset positions
                const duplicatedBoxes = selectedBoxes.map(box => ({
                    ...box,
                    id: uuid(),
                    frame: {
                        ...box.frame,
                        translate: [
                            box.frame.translate[0] + 20,
                            box.frame.translate[1] + 20
                        ] as [number, number]
                    },
                    leftRightRatio: box.leftRightRatio ?? 50
                }));
                // Add duplicated boxes to the boxes array
                setBoxes(prev => [...prev, ...duplicatedBoxes]);
                // Select only the newly duplicated boxes (use setTimeout to ensure state updates after boxes are added)
                setTimeout(() => {
                    setSelectedBoxIds(duplicatedBoxes.map(b => b.id));
                }, 0);
            }
            // Delete selected boxes
            else if (selectedBoxIds.length > 0 && (event.key === 'Backspace' || event.key === 'Delete')) {
                // Prevent default behavior (like navigating back in browser)
                event.preventDefault();
                // Delete all selected boxes
                setBoxes((prev) => prev.filter((b) => !selectedBoxIds.includes(b.id)));
                setSelectedBoxIds([]);
            }
            // Clear selection with Escape
            else if (event.key === 'Escape' && selectedBoxIds.length > 0) {
                event.preventDefault();
                setSelectedBoxIds([]);
            }
            // Create new box with Cmd+N (Mac) or Ctrl+N (Windows/Linux)
            else if (event.key === 'n' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                createNewBox();
            }
            // Toggle settings menu with Cmd+, (Mac) or Ctrl+, (Windows/Linux) - disabled in display mode
            else if (event.key === ',' && (event.metaKey || event.ctrlKey) && !isDisplayMode) {
                event.preventDefault();
                settingsMenuRef.current?.toggle();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [selectedBoxIds, findReplaceModalOpen, boxes]);

    const canvasStyle = getCanvasBackgroundStyle();
    const hasBackgroundImage = isImageUrl(actualCanvasBackgroundColor) || (loadedBackgroundImage && typeof loadedBackgroundImage === 'string');

    // Check if we're running in browser (for disconnection overlay)
    // Show overlay when running in browser (both / and /control) and disconnected
    const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;
    const isCapacitorPlatform = Capacitor.isNativePlatform();
    const showDisconnectOverlay = !isElectron && !isCapacitorPlatform && !isConnected;

    return (
        <div
            className={`canvas-container ${hasBackgroundImage ? 'has-background-image' : ''}`}
            style={{
                minHeight: '100vh',
                width: '100%',
                ...canvasStyle
            }}>
            <TitleBar />

            {/* Canvas background video */}
            {canvasBackgroundVideoDeviceId && (() => {
                const roi = canvasBackgroundVideoROI;

                if (!roi) {
                    // No ROI - simple case, use objectFit directly
                    return (
                        <video
                            ref={canvasVideoRef}
                            autoPlay
                            playsInline
                            muted
                            style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                width: '100vw',
                                height: '100vh',
                                objectFit: canvasBackgroundVideoSize || 'cover',
                                pointerEvents: 'none',
                                zIndex: 0
                            }}
                        />
                    );
                }

                // With ROI:
                // Step 1: Create a "cropped video" container with ROI aspect ratio
                // Step 2: Position/scale the actual video to show only the ROI region
                // Step 3: Apply cover/contain to the cropped container

                // Get video dimensions to calculate actual ROI aspect ratio
                const videoWidth = canvasVideoRef.current?.videoWidth || 1920;
                const videoHeight = canvasVideoRef.current?.videoHeight || 1080;

                // Calculate actual pixel dimensions of ROI
                const roiPixelWidth = videoWidth * (roi.width / 100);
                const roiPixelHeight = videoHeight * (roi.height / 100);

                // Calculate actual aspect ratio of the ROI region
                const roiAspectRatio = roiPixelWidth / roiPixelHeight;

                return (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        pointerEvents: 'none',
                        zIndex: 0
                    }}>
                        {/* Container with ROI aspect ratio that applies cover/contain */}
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            aspectRatio: `${roiAspectRatio}`,
                            ...(canvasBackgroundVideoSize === 'contain' ? {
                                // Contain: fit inside box - let aspect ratio determine actual size
                                maxWidth: '100%',
                                maxHeight: '100%',
                                width: 'auto',
                                height: '100%'
                            } : {
                                // Cover: fill entire box
                                minWidth: '100%',
                                minHeight: '100%'
                            }),
                            overflow: 'hidden'
                        }}>
                            {/* The actual video, scaled to fit ROI dimensions */}
                            <video
                                ref={canvasVideoRef}
                                autoPlay
                                playsInline
                                muted
                                style={{
                                    position: 'absolute',
                                    // Scale video so ROI region fills container
                                    width: `${100 / roi.width * 100}%`,
                                    height: `${100 / roi.height * 100}%`,
                                    // Position video so ROI region is at top-left of container
                                    left: `${-roi.x / roi.width * 100}%`,
                                    top: `${-roi.y / roi.height * 100}%`,
                                    objectFit: 'fill',
                                    pointerEvents: 'none'
                                }}
                            />
                        </div>
                    </div>
                );
            })()}

            {/* Disconnection overlay - shown when running in browser and disconnected */}
            {showDisconnectOverlay && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.95)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000,
                    pointerEvents: 'all'
                }}>
                    <div style={{
                        backgroundColor: '#262626',
                        border: '2px solid #61BAFA',
                        borderRadius: '12px',
                        padding: '40px 60px',
                        maxWidth: '500px',
                        textAlign: 'center',
                        boxShadow: '0 8px 32px rgba(97, 186, 250, 0.2)',
                        fontFamily: '"Work Sans", system-ui, Avenir, Helvetica, Arial, sans-serif'
                    }}>
                        <h2 style={{
                            color: '#61BAFA',
                            margin: '0 0 20px 0',
                            fontSize: '28px',
                            fontWeight: '700',
                            letterSpacing: '0.5px'
                        }}>Connection Lost</h2>
                        <p style={{
                            color: '#61BAFA',
                            margin: 0,
                            fontSize: '14px',
                            opacity: 0.8
                        }}>
                            Attempting to reconnect...
                        </p>
                    </div>
                </div>
            )}

            <FindReplaceModal
                isOpen={findReplaceModalOpen}
                onClose={() => setFindReplaceModalOpen(false)}
                boxes={boxes}
                selectedBoxIds={selectedBoxIds}
                onReplace={handleFindReplace}
            />

            <SettingsMenu
                ref={settingsMenuRef}
                onNewBox={createNewBox}
                connectionUrl={companionBaseUrl}
                onConnectionUrlChange={setCompanionBaseUrl}
                onConnectionsChange={setConnections}
                mainConnectionValid={mainConnectionValid}
                onMainConnectionValidChange={setMainConnectionValid}
                additionalConnectionValidities={additionalConnectionValidities}
                onAdditionalConnectionValiditiesChange={setAdditionalConnectionValidities}
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
                canvasBackgroundImageSize={canvasBackgroundImageSize}
                onCanvasBackgroundImageSizeChange={setCanvasBackgroundImageSize}
                canvasBackgroundImageWidth={canvasBackgroundImageWidth}
                onCanvasBackgroundImageWidthChange={setCanvasBackgroundImageWidth}
                canvasBackgroundVideoDeviceId={canvasBackgroundVideoDeviceId}
                onCanvasBackgroundVideoDeviceIdChange={setCanvasBackgroundVideoDeviceId}
                canvasBackgroundVideoSize={canvasBackgroundVideoSize}
                onCanvasBackgroundVideoSizeChange={setCanvasBackgroundVideoSize}
                canvasBackgroundVideoROI={canvasBackgroundVideoROI}
                onCanvasBackgroundVideoROIChange={setCanvasBackgroundVideoROI}
                refreshRateMs={refreshRateMs}
                onRefreshRateMsChange={setRefreshRateMs}
                fontFamily={fontFamily}
                onFontFamilyChange={setFontFamily}
                boxesLocked={boxesLocked}
                onBoxesLockedChange={handleBoxesLockedChange}
                isDisplayMode={isDisplayMode}
                scaleEnabled={scaleEnabled}
                onScaleEnabledChange={setScaleEnabled}
                designWidth={designWidth}
                onDesignWidthChange={setDesignWidth}
                pages={pages}
            />
            <div style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                width: scaleEnabled ? `${designWidth}px` : '100%',
                minHeight: '100vh',
                position: 'relative'
            }}>
                {boxes.filter(box => box.pageId === effectiveCurrentPageId).length === 0 ? (
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
                            left: '120px',
                            color: '#FFF',
                            fontSize: '14px',
                            fontWeight: '500',
                            opacity: .5,
                        }}>
                            Open the menu to add boxes!
                        </div>
                    </div>
                ) : (
                    boxes.filter(box => box.pageId === effectiveCurrentPageId).map((box) => (
                        <Box
                            key={box.id}
                            boxData={box}
                            isSelected={selectedBoxIds.includes(box.id)} // Pass down selection state
                            isMultiSelect={selectedBoxIds.length > 1} // Hide individual Moveable when multi-select
                            onSelect={(event) => {
                                // Multi-select with Cmd/Ctrl/Shift key
                                if (event?.metaKey || event?.ctrlKey || event?.shiftKey) {
                                    setSelectedBoxIds(prev =>
                                        prev.includes(box.id)
                                            ? prev.filter(id => id !== box.id) // Toggle off if already selected
                                            : [...prev, box.id] // Add to selection
                                    );
                                } else {
                                    // Single select (replace selection)
                                    setSelectedBoxIds([box.id]);
                                }
                            }}
                            onDeselect={() => setSelectedBoxIds([])} // Clear all selections
                            onBoxUpdate={(updatedBox) => {
                                setBoxes(prev => prev.map(b => b.id === updatedBox.id ? updatedBox : b));
                            }}
                            onDelete={(boxId) => {
                                setBoxes((prev) => prev.filter((b) => b.id !== boxId));
                                setSelectedBoxIds(prev => prev.filter(id => id !== boxId));
                            }}
                            onDuplicate={duplicateBox}
                            companionBaseUrl={companionBaseUrl}
                            connections={connections}
                            refreshRateMs={refreshRateMs}
                            isDragging={isDragging}
                            onDragStart={() => setIsDragging(true)}
                            onDragEnd={() => setIsDragging(false)}
                            boxesLocked={boxesLocked}
                            centralVariableValues={isWebClient ? receivedVariableValues : undefined}
                            videoRelayManager={videoRelayManagerRef.current}
                            videoRelayManagerReady={videoRelayManagerReady}
                            boxRef={(el) => {
                                if (el) {
                                    boxRefsMap.current[box.id] = el;
                                } else {
                                    delete boxRefsMap.current[box.id];
                                }
                            }}
                            pages={pages}
                        />
                    ))
                )}

                {/* Group Moveable for multi-select */}
                {!boxesLocked && selectedBoxIds.length > 1 && (
                    <Moveable
                        target={selectedBoxIds
                            .map(id => boxRefsMap.current[id])
                            .filter((el): el is HTMLDivElement => el !== null)}
                        draggable
                        resizable
                        snappable
                        snapThreshold={15}
                        snapDirections={{ top: true, left: true, bottom: true, right: true }}
                        verticalGuidelines={gridLines.verticalGridLines}
                        horizontalGuidelines={gridLines.horizontalGridLines}
                        useResizeObserver={true}
                        touchAction="none"
                        dragContainer={document.body}
                        preventDefault={true}
                        stopDragging={false}
                        onDragGroupStart={() => {
                            setIsDragging(true);
                        }}
                        onDragGroup={(e) => {
                            e.events.forEach((ev) => {
                                const target = ev.target as HTMLDivElement;
                                target.style.transform = ev.transform;
                            });
                        }}
                        onDragGroupEnd={(e) => {
                            setIsDragging(false);
                            // Update all box positions
                            e.events.forEach((ev) => {
                                const target = ev.target as HTMLDivElement;
                                const boxId = selectedBoxIds.find(id => boxRefsMap.current[id] === target);
                                if (boxId) {
                                    const box = boxes.find(b => b.id === boxId);
                                    if (box) {
                                        const newFrame = {
                                            ...box.frame,
                                            translate: [ev.lastEvent.beforeTranslate[0], ev.lastEvent.beforeTranslate[1]] as [number, number]
                                        };
                                        setBoxes(prev => prev.map(b =>
                                            b.id === boxId ? { ...b, frame: newFrame } : b
                                        ));
                                    }
                                }
                            });
                        }}
                        onResizeGroupStart={() => {
                            setIsDragging(true);
                        }}
                        onResizeGroup={(e) => {
                            e.events.forEach((ev) => {
                                const target = ev.target as HTMLDivElement;
                                target.style.width = `${ev.width}px`;
                                target.style.height = `${ev.height}px`;
                                target.style.transform = ev.drag.transform;
                            });
                        }}
                        onResizeGroupEnd={(e) => {
                            setIsDragging(false);
                            // Update all box sizes and positions
                            e.events.forEach((ev) => {
                                const target = ev.target as HTMLDivElement;
                                const boxId = selectedBoxIds.find(id => boxRefsMap.current[id] === target);
                                if (boxId) {
                                    const box = boxes.find(b => b.id === boxId);
                                    if (box && ev.lastEvent) {
                                        const newFrame = {
                                            translate: [ev.lastEvent.drag.beforeTranslate[0], ev.lastEvent.drag.beforeTranslate[1]] as [number, number],
                                            width: ev.lastEvent.width,
                                            height: ev.lastEvent.height
                                        };
                                        setBoxes(prev => prev.map(b =>
                                            b.id === boxId ? { ...b, frame: newFrame } : b
                                        ));
                                    }
                                }
                            });
                        }}
                    />
                )}
            </div>

            {/* Page tabs - hide if viewing specific page via ?page= parameter */}
            {!hasPageParamInUrl && (
                <PageTabs
                    pages={pages}
                    currentPageId={effectiveCurrentPageId}
                    onPageChange={handlePageChange}
                    onPageAdd={handlePageAdd}
                    onPageRename={handlePageRename}
                    onPageDelete={handlePageDelete}
                    visible={showPageTabs}
                    readOnly={isDisplayMode}
                />
            )}
        </div >
    );
}

