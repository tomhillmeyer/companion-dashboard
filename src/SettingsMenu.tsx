// SettingsMenu.tsx
import { useState, useEffect, useRef } from 'react';
import './SettingsMenu.css';

const STORAGE_KEY = 'companion_connection_url';

export default function SettingsMenu({
    onNewBox,
    connectionUrl,
    onConnectionUrlChange,
    onConfigRestore
}: {
    onNewBox: () => void;
    connectionUrl: string;
    onConnectionUrlChange: (url: string) => void;
    onConfigRestore: (boxes: any[], connectionUrl: string) => void;
}) {
    const [inputUrl, setInputUrl] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const downloadConfig = () => {
        try {
            // Get data from localStorage
            const boxes = localStorage.getItem('boxes');
            const connectionUrl = localStorage.getItem('companion_connection_url');

            // Create config object
            const config = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                boxes: boxes ? JSON.parse(boxes) : [],
                companion_connection_url: connectionUrl || ''
            };

            // Create and download file
            const dataStr = JSON.stringify(config, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);

            // Create temporary link and trigger download
            const link = document.createElement('a');
            link.href = url;
            link.download = `box-config-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up
            URL.revokeObjectURL(url);

            console.log('Config downloaded successfully');
        } catch (error) {
            console.error('Failed to download config:', error);
            alert('Failed to download configuration');
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const handleFileRestore = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const configText = e.target?.result as string;
                const config = JSON.parse(configText);

                // Validate config structure (basic validation)
                if (!config.boxes || !Array.isArray(config.boxes)) {
                    throw new Error('Invalid config format: missing or invalid boxes array');
                }

                // Clear current localStorage
                localStorage.removeItem('boxes');
                localStorage.removeItem('companion_connection_url');

                // Set new data
                localStorage.setItem('boxes', JSON.stringify(config.boxes));
                if (config.companion_connection_url) {
                    localStorage.setItem('companion_connection_url', config.companion_connection_url);
                }

                // Update parent state
                onConfigRestore(config.boxes, config.companion_connection_url || '');

                // Update local input state
                setInputUrl(config.companion_connection_url || '');

                console.log('Config restored successfully');
                alert('Configuration restored successfully!');

            } catch (error) {
                console.error('Failed to restore config:', error);
                alert('Failed to restore configuration. Please check the file format.');
            }
        };

        reader.readAsText(file);

        // Reset file input
        event.target.value = '';
    };

    // Load cached URL on component mount
    useEffect(() => {
        const cachedUrl = localStorage.getItem(STORAGE_KEY);
        if (cachedUrl) {
            setInputUrl(cachedUrl);
            // Only update parent if it's different from current connectionUrl
            if (cachedUrl !== connectionUrl) {
                onConnectionUrlChange(cachedUrl);
            }
        } else {
            setInputUrl(connectionUrl);
        }
    }, [connectionUrl, onConnectionUrlChange]);

    const handleUrlSubmit = () => {
        // Extract base URL (protocol + host + port)
        try {
            const url = new URL(inputUrl);
            const baseUrl = `${url.protocol}//${url.host}`;

            // Save to localStorage
            localStorage.setItem(STORAGE_KEY, baseUrl);

            onConnectionUrlChange(baseUrl);
        } catch (error) {
            console.error('Invalid URL:', error);
        }
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newUrl = e.target.value;
        setInputUrl(newUrl);

        // Save to localStorage on every change (optional - you might prefer only saving on submit)
        if (newUrl.trim()) {
            localStorage.setItem(STORAGE_KEY, newUrl);
        }
    };

    return (
        <div className="menu">
            <div className="url-section">
                <input
                    type="text"
                    value={inputUrl}
                    onChange={handleUrlChange}
                    placeholder="http://100.76.88.24:8888/connections"
                />
                <button onClick={handleUrlSubmit}>Set Connection</button>
            </div>
            <button onClick={onNewBox}>New Box</button>
            <div style={{ display: 'flex', flexDirection: 'row', alignContent: 'center', alignItems: 'center' }}>
                <img src='/dashboard.png' style={{ height: '30px' }}></img>
                <h2> COMPANION DASHBOARD </h2>
            </div>

            <div>
                <button onClick={downloadConfig}>Download Config</button>
                <button onClick={triggerFileInput}>Restore Config</button>
            </div>
            <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileRestore}
                style={{ display: 'none' }}
            />
        </div >
    );
}