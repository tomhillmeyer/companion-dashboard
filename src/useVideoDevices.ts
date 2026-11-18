import { useState, useEffect, useCallback } from 'react';
import { isElectron } from './platform';

export interface VideoDevice {
    deviceId: string;
    label: string;
}

// Stable empty list so the web-client sync effect can't re-run every render.
const NO_DEVICES: VideoDevice[] = [];

/**
 * List video inputs without requesting camera permission.
 * Before access is granted Chromium may return placeholder entries with an
 * empty deviceId (and no label), so those are dropped.
 */
async function enumerateVideoDevices(): Promise<VideoDevice[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];

    const deviceInfos = await navigator.mediaDevices.enumerateDevices();
    return deviceInfos
        .filter(device => device.kind === 'videoinput' && !!device.deviceId)
        .map((device, index) => ({
            deviceId: device.deviceId,
            label: device.label || `Camera ${index + 1}`
        }));
}

/**
 * Video device discovery.
 *
 * Only the Electron host owns cameras. Web clients receive the host's device
 * list over the WebSocket state sync (`syncedDevices`), and the native app has
 * no video support — so neither of them ever touches the media APIs.
 *
 * Mounting only *enumerates* devices; it never asks for camera permission.
 * Call `refresh()` when permission is actually needed (explicit user action,
 * or a live video source that has just been configured).
 */
export function useVideoDevices(syncedDevices: VideoDevice[] = NO_DEVICES): { devices: VideoDevice[]; refresh: () => Promise<void> } {
    const canAccessLocalDevices = isElectron();
    const [devices, setDevices] = useState<VideoDevice[]>(canAccessLocalDevices ? NO_DEVICES : syncedDevices);

    const enumerate = useCallback(async () => {
        if (!canAccessLocalDevices) return;
        try {
            setDevices(await enumerateVideoDevices());
        } catch (error) {
            console.error('Error enumerating video devices:', error);
            setDevices([]);
        }
    }, [canAccessLocalDevices]);

    // Web client / native: mirror the list owned by the host.
    useEffect(() => {
        if (!canAccessLocalDevices) {
            setDevices(syncedDevices);
        }
    }, [canAccessLocalDevices, syncedDevices]);

    // Explicit access request: prompt (once per machine grant), then re-list.
    const refresh = useCallback(async () => {
        if (!canAccessLocalDevices) return;

        try {
            if (navigator.mediaDevices?.getUserMedia) {
                // Minimal constraints keep this fast and avoid device-specific
                // failures; the stream is only needed to unlock device labels.
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                    }
                });
                stream.getTracks().forEach(track => track.stop());
            }
        } catch (error) {
            // Denied or no camera available — the list may stay empty.
            console.warn('Camera access was not granted:', error);
        }

        await enumerate();
    }, [canAccessLocalDevices, enumerate]);

    useEffect(() => {
        if (!canAccessLocalDevices) return;

        enumerate();

        // Device hotplug: refresh the list without prompting.
        if (!navigator.mediaDevices?.addEventListener) return;

        const handleDeviceChange = () => {
            enumerate();
        };
        navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

        return () => {
            navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
        };
    }, [canAccessLocalDevices, enumerate]);

    return { devices, refresh };
}
