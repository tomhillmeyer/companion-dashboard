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

    start(port = 8100) {
        if (this.isRunning) {
            console.log('Web server already running');
            return;
        }

        this.port = port;
        
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
        
        // Serve static assets (for built-in icons)
        this.app.use('/assets', express.static(path.join(__dirname, '../src/assets')));
        
        // Serve the read-only web dashboard at root
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/web-dashboard.html'));
        });

        // Serve the full interactive app at /full
        const distPath = path.join(__dirname, '../dist');
        this.app.use('/full', express.static(distPath));

        // SPA fallback for /full routes - use middleware instead of wildcard
        this.app.use('/full', (req, res) => {
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
            const isFullAppClient = req.url && req.url.includes('/full');

            console.log(`Client connected to dashboard web server (${isFullAppClient ? 'full app' : 'read-only'})`);

            if (isFullAppClient) {
                this.fullAppClients.add(ws);
            } else {
                this.clients.add(ws);
            }

            // Send current state to new client
            ws.send(JSON.stringify({
                type: isFullAppClient ? 'stateUpdate' : 'state',
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

        // Broadcast to read-only clients
        const readOnlyMessage = JSON.stringify({
            type: 'state',
            data: this.currentState
        });

        this.clients.forEach(client => {
            if (client.readyState === client.OPEN) {
                client.send(readOnlyMessage);
            }
        });

        // Broadcast to full app clients (different message type)
        const fullAppMessage = JSON.stringify({
            type: 'stateUpdate',
            data: this.currentState
        });

        this.fullAppClients.forEach(client => {
            if (client.readyState === client.OPEN) {
                client.send(fullAppMessage);
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

        baseUrls.forEach(base => {
            // Add read-only endpoint
            endpoints.push({
                url: base.url,
                type: 'read-only'
            });
            // Add full app endpoint
            endpoints.push({
                url: `${base.url}/full`,
                type: 'full-app'
            });
        });

        return endpoints;
    }
}

export default DashboardWebServer;