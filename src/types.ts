/**
 * Shared Type Definitions for Companion Dashboard
 *
 * This file contains all shared interfaces and types used across the application.
 * Extracting these here reduces the need to read large component files just to check types.
 */

// ============================================================================
// Connection Types
// ============================================================================

export interface CompanionConnection {
    id: string;
    url: string;
    label: string;
}

// ============================================================================
// Variable Types
// ============================================================================

export type ComparisonOperator = '==' | '!=' | '<' | '<=' | '>' | '>=';

export interface VariableColor {
    id: string;
    variable: string;
    operator: ComparisonOperator;
    value: string;
    color: string;
}

export interface VariableOpacity {
    id: string;
    variable: string;
    operator: ComparisonOperator;
    value: string;
    opacity: number;
}

export interface VariableOverlaySize {
    id: string;
    variable: string;
    operator: ComparisonOperator;
    value: string;
    size: number;
}

// ============================================================================
// Layer Types (Layered Box Elements)
// ============================================================================

export type LayerType = 'video' | 'color' | 'image' | 'text' | 'url';

export interface BaseLayer {
    id: string;
    type: LayerType;
    offsetX: number;
    offsetY: number;
}

export interface LayerOverlay {
    color: string;
    colorText: string;
    variableColors: VariableColor[];
    direction: 'left' | 'right' | 'top' | 'bottom';
    size: number;
    sizeSource: string;
    sizeVariableValues: VariableOverlaySize[];
}

export interface LayerMask {
    top: number;
    bottom: number;
    left: number;
    right: number;
}

export interface LayerRadius {
    topLeft: number;
    topRight: number;
    bottomLeft: number;
    bottomRight: number;
}

export interface ColorLayer extends BaseLayer {
    type: 'color';
    color: string;
    colorText: string;
    variableColors: VariableColor[];
    mask: LayerMask;
    radius?: LayerRadius;
    colorAnimation?: 'none' | 'fade'; // undefined = follow global
}

export interface ImageLayer extends BaseLayer {
    type: 'image';
    imageSrc: string;
    imageSize: 'cover' | 'contain';
    imageOpacity: number;
    overlay: LayerOverlay;
    mask?: LayerMask;
    radius?: LayerRadius;
    backgroundImageAnimation?: AnimationType; // undefined = follow global
}

export interface VideoLayer extends BaseLayer {
    type: 'video';
    deviceId: string;
    videoSize: 'cover' | 'contain';
    roi?: { x: number; y: number; width: number; height: number };
    overlay: LayerOverlay;
    mask?: LayerMask;
    radius?: LayerRadius;
}

export interface TextLayer extends BaseLayer {
    type: 'text';
    source: string;
    size: number;
    align: 'left' | 'center' | 'right';
    alignVertical: 'top' | 'middle' | 'bottom';
    wrap?: 'word' | 'letter' | 'ellipsis' | 'truncate'; // undefined = word wrap
    font: string; // '' = use global font
    color: string;
    colorText: string;
    variableColors: VariableColor[];
    visible: boolean;
    textAnimation?: AnimationType; // undefined = follow global
}

export interface UrlLayer extends BaseLayer {
    type: 'url';
    urlSrc: string;
    urlOpacity: number;
    overlay: LayerOverlay;
    mask?: LayerMask;
    radius?: LayerRadius;
}

export type BoxLayer = ColorLayer | ImageLayer | VideoLayer | TextLayer | UrlLayer;

// ============================================================================
// Box Data Type
// ============================================================================

export interface BoxData {
    // Identity
    id: string;

    // Page Assignment
    pageId: string;

    // Layout
    frame: { translate: [number, number]; width: number; height: number };
    anchorPoint: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    zIndex: number;

    // Opacity
    opacity: number;
    opacitySource: string;
    opacityVariableValues: VariableOpacity[];

    // Layers (list order = top-first: index 0 paints on top)
    layers: BoxLayer[];

    // Border
    borderColor: string;
    borderColorText: string;
    borderVariableColors: VariableColor[];
    noBorder: boolean;
    borderRadius: number;

    // Companion Integration
    companionButtonLocation?: string; // Format: "page/row/column"
    companionButtonConnectionId?: string; // Which connection to use for click action (defaults to main if not set)
}

// ============================================================================
// Page Type
// ============================================================================

export interface PageData {
    id: string;
    name: string;
    order: number;
}

// ============================================================================
// Canvas Settings Type
// ============================================================================

export interface CanvasSettings {
    canvasBackgroundColor: string;
    canvasBackgroundColorText: string;
    canvasBackgroundVariableColors: VariableColor[];
    canvasBackgroundImageOpacity: number;
    canvasBackgroundImageSize: 'cover' | 'contain';
    canvasBackgroundImageWidth: number;
    canvasBackgroundVideoDeviceId: string;
    canvasBackgroundVideoSize: 'cover' | 'contain';
    canvasBackgroundVideoROI?: { x: number; y: number; width: number; height: number };
    refreshRateMs: number;
}

// ============================================================================
// Configuration Export/Import Type
// ============================================================================

// ============================================================================
// Animation Types
// ============================================================================

export type AnimationType = 'none' | 'fade' | 'grow' | 'slide' | 'slide-bottom' | 'slide-left' | 'slide-right';

export interface AnimationSettings {
    textAnimation: AnimationType;
    backgroundImageAnimation: AnimationType;
    colorAnimation: 'none' | 'fade';
    animationDuration: number; // milliseconds
}

// ============================================================================
// Configuration Export/Import Type
// ============================================================================

export interface DashboardConfig {
    version: string;
    timestamp: string;
    boxes: BoxData[];
    pages: PageData[];
    companion_connection_url: string;
    companion_connections: CompanionConnection[];
    canvas_settings: Partial<CanvasSettings>;
    background_image_data: string | null;
    font_family: string;
    scale_enabled: boolean;
    design_width: number;
    animation_settings?: Partial<AnimationSettings>;
}

// ============================================================================
// Font Info Type (from font-list library)
// ============================================================================

export interface FontInfo {
    name: string;
    familyName: string;
    postScriptName: string;
    weight: string;
    style: string;
    width: string;
    monospace: boolean;
}

// ============================================================================
// ROI (Region of Interest) Type
// ============================================================================

export interface ROI {
    x: number;
    y: number;
    width: number;
    height: number;
}

// ============================================================================
// Web Server Types
// ============================================================================

export interface WebServerEndpoint {
    type: 'read-only' | 'full-app';
    url: string;
}

export interface WebServerStatus {
    isRunning: boolean;
    port: number;
    hostname?: string;
    endpoints: WebServerEndpoint[];
    mdnsConflict?: boolean;
}

// ============================================================================
// WebRTC Signaling Types
// ============================================================================

export interface WebRTCSignalData {
    type: 'request-video-stream' | 'webrtc-offer' | 'webrtc-answer' | 'webrtc-ice-candidate';
    deviceId: string;
    streamId: string;
    clientId: string;
    offer?: RTCSessionDescriptionInit;
    answer?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
}

// ============================================================================
// Window API Type (Electron)
// ============================================================================

declare global {
    interface Window {
        electronAPI?: {
            windowId: string;
            isKioskMode: boolean;
            webServer: {
                start: (port: number, hostname: string) => Promise<any>;
                stop: () => Promise<any>;
                getStatus: () => Promise<WebServerStatus>;
                updateState: (state: any) => Promise<any>;
                updateVariables: (variableValues: any, variableHtmlValues: any) => Promise<any>;
                sendWebRTCSignal: (data: WebRTCSignalData) => Promise<any>;
            };
            onSyncStateFromBrowser: (callback: (data: any) => void) => void;
            onWebRTCSignaling: (callback: (data: WebRTCSignalData) => void) => void;
            onMDNSStatusChanged: (callback: () => void) => void;
            openExternal: (url: string) => Promise<any>;
            getSystemFonts: () => Promise<FontInfo[]>;
        };
    }
}
