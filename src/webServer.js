import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class DashboardWebServer {
    constructor(onStateChange) {
        this.app = express();
        this.server = null;
        this.wss = null;
        this.port = 8100;
        this.isRunning = false;
        this.clients = new Set();
        this.fullAppClients = new Set(); // Separate tracking for full app clients
        this.onStateChange = onStateChange; // Callback for bidirectional sync from full app
        this.currentState = {
            boxes: [],
            canvasSettings: {},
            connections: [],
            imageData: {}
        };
    }

    start(port = 8100, hostname = 'dashboard') {
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
        });
        
        // Setup WebSocket server
        this.wss = new WebSocketServer({ server: this.server });
        
        this.wss.on('connection', (ws, req) => {
            // Check if this is a full app client or read-only client based on URL
            const isFullAppClient = req.url && req.url.includes('/control');

            console.log(`Client connected to dashboard web server (${isFullAppClient ? 'full app' : 'read-only'})`);

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

            // Handle messages from full app clients (bidirectional sync)
            ws.on('message', (message) => {
                if (isFullAppClient) {
                    try {
                        const data = JSON.parse(message.toString());
                        console.log('Received message from full app client:', data.type);

                        // Forward state changes from browser to Electron
                        if (data.type === 'stateChange' && this.onStateChange) {
                            this.onStateChange(data.data);
                        }
                    } catch (error) {
                        console.error('Error processing WebSocket message:', error);
                    }
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
    
    getEndpoints() {
        const baseUrls = this.getNetworkInterfaces();
        const endpoints = [];

        // Add .local mDNS endpoint if hostname is set
        if (this.hostname) {
            const localUrl = `http://${this.hostname}.local:${this.port}`;
            endpoints.push({
                url: localUrl,
                type: 'read-only'
            });
            endpoints.push({
                url: `${localUrl}/control`,
                type: 'full-app'
            });
        }

        baseUrls.forEach(base => {
            // Add read-only endpoint
            endpoints.push({
                url: base.url,
                type: 'read-only'
            });
            // Add full app endpoint
            endpoints.push({
                url: `${base.url}/control`,
                type: 'full-app'
            });
        });

        return endpoints;
    }
}

export default DashboardWebServer;