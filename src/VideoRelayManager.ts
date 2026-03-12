/**
 * VideoRelayManager
 *
 * Manages WebRTC video relay from Electron host to web clients
 *
 * Architecture:
 * - Electron host: Captures video devices and broadcasts to web clients
 * - Web clients: Receive video streams via WebRTC peer connections
 * - Signaling: Uses existing WebSocket connection
 */

export class VideoRelayManager {
    private peerConnections: Map<string, RTCPeerConnection> = new Map();
    private localStreams: Map<string, MediaStream> = new Map();
    private isElectronHost: boolean;
    private ws: WebSocket | null = null;
    private requestedDevices: Set<string> = new Set(); // Track which devices have been requested

    constructor(isElectronHost: boolean) {
        this.isElectronHost = isElectronHost;
    }

    /**
     * Set WebSocket for signaling (web clients only)
     */
    setWebSocket(ws: WebSocket) {
        this.ws = ws;
        this.setupWebSocketHandlers();
    }

    /**
     * Set up IPC for signaling (Electron host only)
     */
    setupElectronHostSignaling() {
        if (!this.isElectronHost) {
            console.warn('setupElectronHostSignaling should only be called on Electron host');
            return;
        }

        // Listen for WebRTC signaling from web clients via IPC
        (window as any).electronAPI?.onWebRTCSignaling(async (data: any) => {
            console.log('[Electron Host] Received WebRTC signal from web client:', data.type, 'clientId:', data.clientId);

            switch (data.type) {
                case 'request-video-stream':
                    await this.handleStreamRequest(data.deviceId, data.streamId, data.clientId);
                    break;

                case 'webrtc-answer':
                    await this.handleAnswer(data.deviceId, data.streamId, data.answer, data.clientId);
                    break;

                case 'webrtc-ice-candidate':
                    await this.handleIceCandidate(data.deviceId, data.streamId, data.candidate, data.clientId);
                    break;
            }
        });
    }

    /**
     * Send WebRTC signaling (different method for Electron host vs web client)
     */
    private async sendSignal(data: any) {
        if (this.isElectronHost) {
            // Electron host: Send via IPC to web server
            await (window as any).electronAPI?.webServer.sendWebRTCSignal(data);
        } else {
            // Web client: Send via WebSocket
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(data));
            }
        }
    }

    /**
     * Electron host: Start broadcasting a video device
     */
    async startBroadcasting(deviceId: string): Promise<void> {
        if (!this.isElectronHost) {
            console.warn('Only Electron host can start broadcasting');
            return;
        }

        // Check if already broadcasting this device
        if (this.localStreams.has(deviceId)) {
            console.log(`Already broadcasting device: ${deviceId}, reusing existing stream`);
            return;
        }

        console.log(`Starting to broadcast new device: ${deviceId}`);
        try {
            // Capture video from device
            const stream = await this.captureVideoDevice(deviceId);
            this.localStreams.set(deviceId, stream);

            console.log(`✓ Successfully started broadcasting video device: ${deviceId}`);
        } catch (error) {
            console.error(`✗ Failed to start broadcasting ${deviceId}:`, error);
            throw error; // Re-throw so caller knows it failed
        }
    }

    /**
     * Electron host: Stop broadcasting a video device (with reference counting)
     */
    private deviceRefCounts: Map<string, number> = new Map();

    incrementDeviceRef(deviceId: string) {
        const currentCount = this.deviceRefCounts.get(deviceId) || 0;
        this.deviceRefCounts.set(deviceId, currentCount + 1);
        console.log(`Device ${deviceId} ref count: ${currentCount + 1}`);
    }

    decrementDeviceRef(deviceId: string) {
        const currentCount = this.deviceRefCounts.get(deviceId) || 0;
        if (currentCount <= 1) {
            // No more references, actually stop the device
            this.stopBroadcasting(deviceId);
            this.deviceRefCounts.delete(deviceId);
            console.log(`Device ${deviceId} ref count: 0 (stopped)`);
        } else {
            this.deviceRefCounts.set(deviceId, currentCount - 1);
            console.log(`Device ${deviceId} ref count: ${currentCount - 1}`);
        }
    }

    stopBroadcasting(deviceId: string) {
        const stream = this.localStreams.get(deviceId);
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            this.localStreams.delete(deviceId);
        }

        // Close any peer connections for this device
        const connectionsToClose: string[] = [];
        this.peerConnections.forEach((pc, key) => {
            if (key.startsWith(deviceId)) {
                pc.close();
                connectionsToClose.push(key);
            }
        });
        connectionsToClose.forEach(key => this.peerConnections.delete(key));
    }

    /**
     * Get local stream for a device (for Electron host to display locally)
     */
    getLocalStream(deviceId: string): MediaStream | null {
        return this.localStreams.get(deviceId) || null;
    }

    /**
     * Web client: Request video stream from Electron host
     */
    requestVideoStream(deviceId: string, streamId: string, onStream: (stream: MediaStream) => void) {
        if (this.isElectronHost) {
            console.warn('Electron host should not request streams');
            return;
        }

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            return;
        }

        // Create unique connection ID for this specific box/stream request
        const connectionId = `${deviceId}_${streamId}`;

        // Check if we already have a peer connection for this specific stream
        if (this.peerConnections.has(connectionId)) {
            console.log(`Peer connection already exists for: ${connectionId}`);
            return;
        }

        console.log(`Creating new peer connection for: ${connectionId}`);

        // Create peer connection for receiving
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        this.peerConnections.set(connectionId, pc);

        pc.ontrack = (event) => {
            console.log(`Received video track for: ${connectionId}`);
            if (event.streams[0]) {
                onStream(event.streams[0]);
            }
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignal({
                    type: 'webrtc-ice-candidate',
                    deviceId,
                    streamId,
                    candidate: event.candidate
                });
            }
        };

        pc.onconnectionstatechange = () => {
            console.log(`Peer connection state for ${connectionId}:`, pc.connectionState);
        };

        // Send request to Electron host
        this.sendSignal({
            type: 'request-video-stream',
            deviceId,
            streamId
        });
    }

    /**
     * Setup WebSocket message handlers
     */
    private setupWebSocketHandlers() {
        if (!this.ws) return;

        this.ws.addEventListener('message', async (event) => {
            try {
                const data = JSON.parse(event.data);

                switch (data.type) {
                    case 'request-video-stream':
                        if (this.isElectronHost) {
                            await this.handleStreamRequest(data.deviceId, data.streamId, data.clientId);
                        }
                        break;

                    case 'webrtc-offer':
                        await this.handleOffer(data.deviceId, data.streamId, data.offer);
                        break;

                    case 'webrtc-answer':
                        await this.handleAnswer(data.deviceId, data.streamId, data.answer);
                        break;

                    case 'webrtc-ice-candidate':
                        await this.handleIceCandidate(data.deviceId, data.streamId, data.candidate);
                        break;
                }
            } catch (error) {
                console.error('Error handling WebSocket message:', error);
            }
        });
    }

    /**
     * Electron host: Handle stream request from web client
     */
    private async handleStreamRequest(deviceId: string, streamId: string, clientId: string) {
        console.log(`Handling stream request for device: ${deviceId}, streamId: ${streamId}, clientId: ${clientId}`);

        // Make sure we're broadcasting this device
        await this.startBroadcasting(deviceId);

        const stream = this.localStreams.get(deviceId);
        if (!stream) {
            console.error(`No stream available for device: ${deviceId}`);
            return;
        }

        // Create unique ID for this peer connection
        const connectionId = `${deviceId}_${streamId}`;
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        this.peerConnections.set(connectionId, pc);

        // Add video track to peer connection
        stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignal({
                    type: 'webrtc-ice-candidate',
                    deviceId,
                    streamId,
                    clientId,
                    candidate: event.candidate
                });
            }
        };

        // Create and send offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        this.sendSignal({
            type: 'webrtc-offer',
            deviceId,
            streamId,
            clientId,
            offer
        });
    }

    /**
     * Handle WebRTC offer
     */
    private async handleOffer(deviceId: string, streamId: string, offer: RTCSessionDescriptionInit) {
        const connectionId = `${deviceId}_${streamId}`;
        const pc = this.peerConnections.get(connectionId);
        if (!pc) {
            console.error(`No peer connection for: ${connectionId}`);
            return;
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.sendSignal({
            type: 'webrtc-answer',
            deviceId,
            streamId,
            answer
        });
    }

    /**
     * Handle WebRTC answer
     */
    private async handleAnswer(deviceId: string, streamId: string, answer: RTCSessionDescriptionInit, _clientId?: string) {
        const connectionId = `${deviceId}_${streamId}`;
        const pc = this.peerConnections.get(connectionId);

        if (!pc) {
            console.error(`No peer connection found for: ${connectionId}`);
            return;
        }

        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        // Note: _clientId is received but not needed here since this is the Electron host receiving from web client
    }

    /**
     * Handle ICE candidate
     */
    private async handleIceCandidate(deviceId: string, streamId: string, candidate: RTCIceCandidateInit, _clientId?: string) {
        // Ignore invalid ICE candidates (including end-of-candidates signal)
        // Check for null/undefined values that would make RTCIceCandidate construction fail
        if (!candidate ||
            candidate.candidate === '' ||
            !candidate.sdpMid ||
            candidate.sdpMLineIndex === null ||
            candidate.sdpMLineIndex === undefined) {
            // Silently ignore - this is normal (end-of-candidates signal)
            return;
        }

        const connectionId = `${deviceId}_${streamId}`;
        const pc = this.peerConnections.get(connectionId);

        if (!pc) {
            console.error(`No peer connection found for ICE candidate: ${connectionId}`);
            return;
        }

        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            // Silently ignore errors from invalid candidates
            // These are often end-of-candidates signals that slip through
        }
    }

    /**
     * Capture video from device
     */
    private async captureVideoDevice(deviceId: string): Promise<MediaStream> {
        const resolutionsToTry = [
            { width: 1920, height: 1080 },
            { width: 1280, height: 720 },
            { width: 640, height: 480 }
        ];

        for (const resolution of resolutionsToTry) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        deviceId: { exact: deviceId },
                        width: { ideal: resolution.width },
                        height: { ideal: resolution.height }
                    },
                    audio: false
                });

                const track = stream.getVideoTracks()[0];
                const settings = track.getSettings();

                if (settings.width && settings.width >= 1280) {
                    return stream;
                } else if (resolution === resolutionsToTry[resolutionsToTry.length - 1]) {
                    return stream;
                } else {
                    stream.getTracks().forEach(t => t.stop());
                }
            } catch (e) {
                if (resolution === resolutionsToTry[resolutionsToTry.length - 1]) {
                    throw e;
                }
            }
        }

        throw new Error('Failed to capture video device');
    }

    /**
     * Close peer connection for a specific stream
     */
    closePeerConnection(deviceId: string, streamId: string) {
        const connectionId = `${deviceId}_${streamId}`;
        const pc = this.peerConnections.get(connectionId);
        if (pc) {
            pc.close();
            this.peerConnections.delete(connectionId);
            console.log(`Closed peer connection for: ${connectionId}`);
        }
    }

    /**
     * Cleanup all connections and streams
     */
    cleanup() {
        // Stop all local streams
        this.localStreams.forEach(stream => {
            stream.getTracks().forEach(track => track.stop());
        });
        this.localStreams.clear();

        // Close all peer connections
        this.peerConnections.forEach(pc => pc.close());
        this.peerConnections.clear();
        this.requestedDevices.clear();
    }
}
