import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { Bonjour } from 'bonjour-service';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class DashboardWebServer {
    constructor(onStateChange, electronWindow) {
        this.app = express();
        this.server = null;
        this.wss = null;
        this.port = 8100;
        this.isRunning = false;
        this.clients = new Set();
        this.fullAppClients = new Set(); // Separate tracking for full app clients
        this.onStateChange = onStateChange; // Callback for bidirectional sync from full app
        this.electronWindow = electronWindow; // Reference to Electron window for WebRTC signaling
        this.bonjour = null;
        this.bonjourService = null;
        this.currentState = {
            boxes: [],
            pages: [],
            canvasSettings: {},
            connections: [],
            imageData: {},
            variableValues: {},  // Raw variable values
            variableHtmlValues: {}  // HTML-processed variable values
        };
    }

    start(port = 80, hostname = 'dashboard') {
        if (this.isRunning) {
            console.log('Web server already running');
            return;
        }

        this.port = port;
        this.hostname = hostname;
        
        // Enable CORS
        this.app.use(cors());
        
        // API endpoint to get current dashboard state
        this.app.get('/api/dashboard-state', (req, res) => {
            res.json(this.currentState);
        });
        
        // API endpoint to serve individual images
        this.app.get('/api/image/:filename', (req, res) => {
            const filename = req.params.filename;
            const imageData = this.currentState.imageData[filename];
            
            if (!imageData) {
                return res.status(404).json({ error: 'Image not found' });
            }
            
            // Extract base64 data and mime type
            const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
            if (!matches) {
                return res.status(400).json({ error: 'Invalid image data' });
            }
            
            const mimeType = matches[1];
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');
            
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.send(buffer);
        });
        
        const distPath = path.join(__dirname, '../dist');

        // Serve static assets from dist (CSS, JS, images, etc.)
        this.app.use('/assets', express.static(path.join(distPath, 'assets')));

        // Serve other static files from dist root (like registerSW.js, dashboard.png)
        this.app.use(express.static(distPath, {
            index: false // Don't auto-serve index.html for static files
        }));

        // Serve the read-only locked view at root
        // Supports ?page=<page-slug> parameter to filter to specific page
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });

        // Serve the full interactive app at /control
        this.app.use('/control', express.static(distPath));

        // SPA fallback for /control routes
        this.app.use('/control', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
        
        // Start HTTP server
        this.server = this.app.listen(port, '0.0.0.0', () => {
            console.log(`Dashboard web server running on http://localhost:${port}`);
            this.isRunning = true;

            // Publish mDNS service
            if (this.hostname) {
                try {
                    this.bonjour = new Bonjour();
                    this.bonjourService = this.bonjour.publish({
                        name: this.hostname,
                        type: 'http',
                        port: this.port,
                        host: `${this.hostname}.local`,
                        txt: {
                            service: 'Companion Dashboard'
                        }
                    });
                    const portSuffix = this.port === 80 ? '' : `:${this.port}`;
                    console.log(`mDNS service published: ${this.hostname}.local${portSuffix}`);
                } catch (error) {
                    console.error('Failed to publish mDNS service:', error);
                }
            }
        });

        // Setup WebSocket server
        this.wss = new WebSocketServer({ server: this.server });
        
        this.wss.on('connection', (ws, req) => {
            // Check if this is a full app client or read-only client based on URL
            const isFullAppClient = req.url && req.url.includes('/control');

            // Assign unique ID to this client for WebRTC signaling
            ws.clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            console.log(`Client connected to dashboard web server (${isFullAppClient ? 'full app' : 'read-only'}) with ID:`, ws.clientId);

            if (isFullAppClient) {
                this.fullAppClients.add(ws);
            } else {
                this.clients.add(ws);
            }

            // Send current state to new client (both use same React app now)
            ws.send(JSON.stringify({
                type: 'stateUpdate',
                data: this.currentState
            }));

            // Handle messages from clients
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    console.log('Received message from client:', data.type);

                    // Handle state changes from full app clients
                    if (isFullAppClient && data.type === 'stateChange' && this.onStateChange) {
                        this.onStateChange(data.data);
                    }

                    // Handle WebRTC signaling for video relay
                    if (data.type === 'webrtc-offer' || data.type === 'webrtc-answer' || data.type === 'webrtc-ice-candidate' || data.type === 'request-video-stream') {
                        // Forward WebRTC signaling to Electron host, including client ID
                        if (this.electronWindow && !this.electronWindow.isDestroyed()) {
                            console.log('Forwarding WebRTC message to Electron host:', data.type, 'from client:', ws.clientId);
                            // Add client ID to the message so Electron knows which client to respond to
                            const messageWithClientId = { ...data, clientId: ws.clientId };
                            this.electronWindow.webContents.send('webrtc-signaling', messageWithClientId);
                        }
                    }
                } catch (error) {
                    console.error('Error processing WebSocket message:', error);
                }
            });

            ws.on('close', () => {
                console.log(`Client disconnected from dashboard web server (${isFullAppClient ? 'full app' : 'read-only'})`);
                if (isFullAppClient) {
                    this.fullAppClients.delete(ws);
                } else {
                    this.clients.delete(ws);
                }
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                if (isFullAppClient) {
                    this.fullAppClients.delete(ws);
                } else {
                    this.clients.delete(ws);
                }
            });
        });
        
        this.server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`Port ${port} is already in use`);
            } else {
                console.error('Server error:', error);
            }
        });
    }
    
    stop() {
        if (!this.isRunning) {
            return;
        }

        // Close all WebSocket connections (both read-only and full app)
        this.clients.forEach(client => {
            client.close();
        });
        this.clients.clear();

        this.fullAppClients.forEach(client => {
            client.close();
        });
        this.fullAppClients.clear();
        
        // Unpublish mDNS service
        if (this.bonjourService) {
            try {
                this.bonjourService.stop();
                this.bonjourService = null;
                console.log('mDNS service unpublished');
            } catch (error) {
                console.error('Failed to unpublish mDNS service:', error);
            }
        }

        // Destroy Bonjour instance
        if (this.bonjour) {
            try {
                this.bonjour.destroy();
                console.log('Bonjour instance destroyed');
            } catch (error) {
                console.error('Failed to destroy Bonjour instance:', error);
            } finally {
                this.bonjour = null;
            }
        }

        // Close WebSocket server
        if (this.wss) {
            this.wss.close();
        }

        // Close HTTP server
        if (this.server) {
            this.server.close(() => {
                console.log('Dashboard web server stopped');
                this.isRunning = false;
            });
        }
    }
    
    updateState(newState) {
        this.currentState = { ...this.currentState, ...newState };

        // Broadcast to all clients (both display and control now use same React app)
        const message = JSON.stringify({
            type: 'stateUpdate',
            data: this.currentState
        });

        // Broadcast to display view clients (/)
        this.clients.forEach(client => {
            if (client.readyState === client.OPEN) {
                client.send(message);
            }
        });

        // Broadcast to control view clients (/control)
        this.fullAppClients.forEach(client => {
            if (client.readyState === client.OPEN) {
                client.send(message);
            }
        });
    }

    // Update variable values (called by Electron app's variable fetcher)
    updateVariables(variableValues, variableHtmlValues) {
        this.currentState.variableValues = variableValues;
        this.currentState.variableHtmlValues = variableHtmlValues;

        // Broadcast variable update to all clients
        const message = JSON.stringify({
            type: 'variableUpdate',
            data: {
                variableValues,
                variableHtmlValues
            }
        });

        // Broadcast to display view clients (/)
        this.clients.forEach(client => {
            if (client.readyState === client.OPEN) {
                client.send(message);
            }
        });

        // Broadcast to control view clients (/control)
        this.fullAppClients.forEach(client => {
            if (client.readyState === client.OPEN) {
                client.send(message);
            }
        });
    }
    
    isServerRunning() {
        return this.isRunning;
    }
    
    getPort() {
        return this.port;
    }
    
    getNetworkInterfaces() {
        const interfaces = os.networkInterfaces();
        const addresses = [];

        // Add localhost
        addresses.push({
            name: 'Localhost',
            address: '127.0.0.1',
            url: `http://127.0.0.1:${this.port}`
        });

        // Add all network interfaces
        Object.keys(interfaces).forEach(name => {
            const nets = interfaces[name];
            if (nets) {
                nets.forEach(net => {
                    // Skip internal interfaces and IPv6 addresses for simplicity
                    if (net.family === 'IPv4' && !net.internal) {
                        addresses.push({
                            name: name,
                            address: net.address,
                            url: `http://${net.address}:${this.port}`
                        });
                    }
                });
            }
        });

        return addresses;
    }

    // Convert page name to URL slug
    pageNameToSlug(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
            .replace(/^-+|-+$/g, ''); // Trim hyphens from start/end
    }

    // Get page-specific endpoints
    getPageEndpoints(pages) {
        if (!pages || pages.length === 0) return [];

        const interfaces = os.networkInterfaces();
        const endpoints = [];

        pages.forEach(page => {
            const slug = this.pageNameToSlug(page.name);
            const pageEndpoints = [];

            // Add localhost
            pageEndpoints.push({
                name: 'Localhost',
                address: '127.0.0.1',
                url: `http://127.0.0.1:${this.port}/page/${slug}`,
                pageName: page.name,
                pageId: page.id
            });

            // Add all network interfaces
            Object.keys(interfaces).forEach(name => {
                const nets = interfaces[name];
                if (nets) {
                    nets.forEach(net => {
                        if (net.family === 'IPv4' && !net.internal) {
                            pageEndpoints.push({
                                name: name,
                                address: net.address,
                                url: `http://${net.address}:${this.port}/page/${slug}`,
                                pageName: page.name,
                                pageId: page.id
                            });
                        }
                    });
                }
            });

            endpoints.push({
                page: page,
                slug: slug,
                endpoints: pageEndpoints
            });
        });

        return endpoints;
    }
    
    // Send WebRTC signaling from Electron host to specific web client
    sendWebRTCSignal(data) {
        const { clientId, ...messageData } = data;
        const message = JSON.stringify(messageData);

        if (!clientId) {
            console.error('WebRTC message missing clientId, cannot route to specific client');
            return;
        }

        console.log('Sending WebRTC message to client:', clientId, 'type:', data.type);

        // Find and send to the specific client
        let found = false;
        this.clients.forEach(client => {
            if (client.clientId === clientId && client.readyState === client.OPEN) {
                client.send(message);
                found = true;
            }
        });

        this.fullAppClients.forEach(client => {
            if (client.clientId === clientId && client.readyState === client.OPEN) {
                client.send(message);
                found = true;
            }
        });

        if (!found) {
            console.warn('Client not found for WebRTC message:', clientId);
        }
    }

    getEndpoints(pages) {
        const baseUrls = this.getNetworkInterfaces();
        const endpoints = [];

        // Add .local mDNS endpoint if hostname is set
        if (this.hostname) {
            const portSuffix = this.port === 80 ? '' : `:${this.port}`;
            const localUrl = `http://${this.hostname}.local${portSuffix}`;
            endpoints.push({
                url: localUrl,
                type: 'read-only',
                label: 'All Pages (Read-Only)'
            });
            endpoints.push({
                url: `${localUrl}/control`,
                type: 'full-app',
                label: 'Full Control'
            });

            // Add page-specific endpoints (using query parameters)
            if (pages && pages.length > 0) {
                pages.forEach(page => {
                    const slug = this.pageNameToSlug(page.name);
                    endpoints.push({
                        url: `${localUrl}?page=${slug}`,
                        type: 'page',
                        label: `${page.name} (Read-Only)`,
                        pageId: page.id,
                        pageName: page.name
                    });
                });
            }
        }

        baseUrls.forEach(base => {
            // Add read-only endpoint
            endpoints.push({
                url: base.url,
                type: 'read-only',
                label: 'All Pages (Read-Only)'
            });
            // Add full app endpoint
            endpoints.push({
                url: `${base.url}/control`,
                type: 'full-app',
                label: 'Full Control'
            });

            // Add page-specific endpoints (using query parameters)
            if (pages && pages.length > 0) {
                pages.forEach(page => {
                    const slug = this.pageNameToSlug(page.name);
                    endpoints.push({
                        url: `${base.url}?page=${slug}`,
                        type: 'page',
                        label: `${page.name} (Read-Only)`,
                        pageId: page.id,
                        pageName: page.name
                    });
                });
            }
        });

        return endpoints;
    }
}

export default DashboardWebServer;