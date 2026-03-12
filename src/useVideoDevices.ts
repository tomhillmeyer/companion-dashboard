import { useState, useEffect, useCallback } from 'react';

export interface VideoDevice {
    deviceId: string;
    label: string;
}

export function useVideoDevices(): { devices: VideoDevice[]; refresh: () => Promise<void> } {
    const [devices, setDevices] = useState<VideoDevice[]>([]);

    const getDevices = useCallback(async () => {
        try {
            // Check if mediaDevices API is available (not available in non-secure contexts)
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                setDevices([]);
                return;
            }

            // Request permission to access media devices
            await navigator.mediaDevices.getUserMedia({ video: true });

            // Enumerate devices
            const deviceInfos = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = deviceInfos
                .filter(device => device.kind === 'videoinput')
                .map((device, index) => ({
                    deviceId: device.deviceId,
                    label: device.label || `Camera ${index + 1}`
                }));

            setDevices(videoDevices);
        } catch (error) {
            console.error('Error enumerating video devices:', error);
            setDevices([]);
        }
    }, []);

    useEffect(() => {
        getDevices();

        // Listen for device changes (only if mediaDevices API is available)
        if (!navigator.mediaDevices) {
            return;
        }

        const handleDeviceChange = () => {
            getDevices();
        };

        navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

        return () => {
            if (navigator.mediaDevices) {
                navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
            }
        };
    }, [getDevices]);

    return { devices, refresh: getDevices };
}
