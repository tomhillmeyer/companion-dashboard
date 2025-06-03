// SettingsMenu.tsx
import { useState, useEffect, useRef } from 'react';
import './SettingsMenu.css';
// Import the image directly - this is the most reliable approach
import dashboardIcon from './assets/dashboard.png'; // Adjust path to where your image is located

const STORAGE_KEY = 'companion_connection_url';

export default function SettingsMenu({
    onNewBox,
    connectionUrl,
    onConnectionUrlChange,
    onConfigRestore,
    onDeleteAllBoxes
}: {
    onNewBox: () => void;
    connectionUrl: string;
    onConnectionUrlChange: (url: string) => void;
    onConfigRestore: (boxes: any[], connectionUrl: string) => void;
    onDeleteAllBoxes: () => void;
}) {
    const [inputUrl, setInputUrl] = useState('');
    const [isValidUrl, setIsValidUrl] = useState<boolean | null>(null);
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

    useEffect(() => {
        const checkConnection = async () => {
            if (!connectionUrl) {
                setIsValidUrl(null);
                return;
            }

            try {
                const response = await fetch(`${connectionUrl}/api/variable/internal/time_unix/value`);
                if (!response.ok) throw new Error('Non-200 response');
                const data = await response.text();
                const timestamp = parseInt(data);
                if (!isNaN(timestamp)) {
                    setIsValidUrl(true);
                } else {
                    throw new Error('Invalid response');
                }
            } catch (err) {
                setIsValidUrl(false);
            }
        };

        checkConnection(); // Initial check
        const interval = setInterval(checkConnection, 5000); // Repeat every 5s

        return () => clearInterval(interval); // Cleanup
    }, [connectionUrl]);


    const handleUrlSubmit = () => {
        try {
            const url = new URL(inputUrl.trim());
            const baseUrl = `${url.protocol}//${url.host}`;
            localStorage.setItem(STORAGE_KEY, baseUrl);
            onConnectionUrlChange(baseUrl);
        } catch (error) {
            console.error('Invalid URL:', error);
            setIsValidUrl(false); // Show red border if input is invalid
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
            <div style={{ display: 'flex', flexDirection: 'row', alignContent: 'center', alignItems: 'center' }}>
                <img src={dashboardIcon} style={{ height: '30px', marginRight: '10px' }} alt="Dashboard" />
                <h2> COMPANION DASHBOARD </h2>
            </div>
            <div className="url-section">
                <input
                    type="text"
                    value={inputUrl}
                    onChange={handleUrlChange}
                    placeholder="http://127.0.0.1:8888/"
                    style={{
                        border: '1px solid',
                        borderColor:
                            isValidUrl === null ? 'gray' :
                                isValidUrl === true ? 'green' :
                                    'red'
                    }}
                />
                <button onClick={handleUrlSubmit}>Set Connection</button>
            </div>
            <div>
                <button onClick={onNewBox}>New Box</button>
                <button
                    onClick={() => {
                        const confirmed = window.confirm("Are you sure you want to clear all of the boxes?");
                        if (confirmed) {
                            onDeleteAllBoxes();
                        }
                    }}
                    style={{ backgroundColor: "#C93E37" }}
                >
                    Clear All Boxes
                </button>
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
        </div>
    );
}