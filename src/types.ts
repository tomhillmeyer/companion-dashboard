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

export interface VariableColor {
    id: string;
    variable: string;
    value: string;
    color: string;
}

export interface VariableOpacity {
    id: string;
    variable: string;
    value: string;
    opacity: number;
}

export interface VariableOverlaySize {
    id: string;
    variable: string;
    value: string;
    size: number;
}

// ============================================================================
// Box Data Type
// ============================================================================

export interface BoxData {
    // Identity
    id: string;

    // Layout
    frame: { translate: [number, number]; width: number; height: number };
    anchorPoint: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    zIndex: number;

    // Opacity
    opacity: number;
    opacitySource: string;
    opacityVariableValues: VariableOpacity[];

    // Background
    backgroundColor: string;
    backgroundColorText: string;
    backgroundVariableColors: VariableColor[];
    backgroundImage?: string;
    backgroundImageSize?: 'cover' | 'contain';
    backgroundImageOpacity?: number;
    backgroundVideoDeviceId?: string;
    backgroundVideoSize?: 'cover' | 'contain';
    backgroundVideoROI?: { x: number; y: number; width: number; height: number };

    // Overlay
    overlayColor: string;
    overlayColorText: string;
    overlayVariableColors: VariableColor[];
    overlayDirection: 'left' | 'right' | 'top' | 'bottom';
    overlaySize: number;
    overlaySizeSource: string;
    overlaySizeVariableValues: VariableOverlaySize[];

    // Border
    borderColor: string;
    borderColorText: string;
    borderVariableColors: VariableColor[];
    noBorder: boolean;
    borderRadius: number;

    // Header Section
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
    headerLabelAlign?: 'left' | 'center' | 'right';
    headerLabelFont?: string;

    // Left Section
    leftLabelSource: string;
    leftLabel: string;
    leftLabelSize: number;
    leftLabelColor: string;
    leftLabelColorText: string;
    leftLabelVariableColors: VariableColor[];
    leftVisible: boolean;
    leftLabelAlign?: 'left' | 'center' | 'right';
    leftLabelFont?: string;

    // Right Section
    rightLabelSource: string;
    rightLabel: string;
    rightLabelSize: number;
    rightLabelColor: string;
    rightLabelColorText: string;
    rightLabelVariableColors: VariableColor[];
    rightVisible: boolean;
    rightLabelAlign?: 'left' | 'center' | 'right';
    rightLabelFont?: string;

    // Layout Ratio
    leftRightRatio: number; // Percentage for left side (0-100), right will be 100 - this value

    // Companion Integration
    companionButtonLocation?: string; // Format: "page/row/column"
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

export interface DashboardConfig {
    version: string;
    timestamp: string;
    boxes: BoxData[];
    companion_connection_url: string;
    companion_connections: CompanionConnection[];
    canvas_settings: Partial<CanvasSettings>;
    background_image_data: string | null;
    font_family: string;
    scale_enabled: boolean;
    design_width: number;
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
    running: boolean;
    port: number;
    hostname: string;
    endpoints: WebServerEndpoint[];
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
            openExternal: (url: string) => Promise<any>;
            getSystemFonts: () => Promise<FontInfo[]>;
        };
    }
}
