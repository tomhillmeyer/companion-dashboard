import { Capacitor } from '@capacitor/core';

// True Electron host/desktop app (has the preload bridge).
export const isElectron = (): boolean =>
    typeof window !== 'undefined' && !!(window as any).electronAPI;

// Capacitor native app (iOS/iPadOS/Android).
export const isNative = (): boolean => Capacitor.isNativePlatform();

// Browser client served by the Electron web server: receives state over
// WebSocket and owns no local configuration.
export const isWebClient = (): boolean => !isElectron() && !isNative();

// A device that owns its configuration and fetches Companion directly
// (Electron host or native app).
export const isLocalHost = (): boolean => isElectron() || isNative();

// Video capture/relay is only available outside the native app.
export const supportsVideo = (): boolean => !isNative();
