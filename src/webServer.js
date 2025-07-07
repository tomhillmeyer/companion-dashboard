import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class DashboardWebServer {
    constructor() {
        this.app = express();
        this.server = null;
        this.wss = null;
        this.port = 8100;
        this.isRunning = false;
        this.clients = new Set();
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
        
        // Serve the web dashboard
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/web-dashboard.html'));
        });
        
        // Start HTTP server
        this.server = this.app.listen(port, '0.0.0.0', () => {
            console.log(`Dashboard web server running on http://localhost:${port}`);
            this.isRunning = true;
        });
        
        // Setup WebSocket server
        this.wss = new WebSocketServer({ server: this.server });
        
        this.wss.on('connection', (ws) => {
            console.log('Client connected to dashboard web server');
            this.clients.add(ws);
            
            // Send current state to new client
            ws.send(JSON.stringify({
                type: 'state',
                data: this.currentState
            }));
            
            ws.on('close', () => {
                console.log('Client disconnected from dashboard web server');
                this.clients.delete(ws);
            });
            
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.clients.delete(ws);
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
        
        // Close all WebSocket connections
        this.clients.forEach(client => {
            client.close();
        });
        this.clients.clear();
        
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
        
        // Broadcast to all connected clients
        const message = JSON.stringify({
            type: 'state',
            data: this.currentState
        });
        
        this.clients.forEach(client => {
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
        
        baseUrls.forEach(base => {
            endpoints.push({
                url: base.url
            });
        });
        
        return endpoints;
    }
}

export default DashboardWebServer;