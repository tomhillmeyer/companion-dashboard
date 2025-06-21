// SettingsMenu.tsx
import { useState, useEffect, useRef } from 'react';
import { FaAngleRight } from "react-icons/fa6";
import { FaAngleLeft } from "react-icons/fa6";
import { FaCirclePlus } from "react-icons/fa6";
import { FaCircleMinus } from "react-icons/fa6";
import { v4 as uuid } from 'uuid';
import type { VariableColor } from './App';

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

import './SettingsMenu.css';
// Import the image directly - this is the most reliable approach
import dashboardIcon from './assets/dashboard.png'; // Adjust path to where your image is located

const STORAGE_KEY = 'companion_connection_url';

export default function SettingsMenu({
    onNewBox,
    connectionUrl,
    onConnectionUrlChange,
    onConfigRestore,
    onDeleteAllBoxes,
    canvasBackgroundColor,
    canvasBackgroundColorText,
    canvasBackgroundVariableColors,
    onCanvasBackgroundColorChange,
    onCanvasBackgroundColorTextChange,
    onCanvasBackgroundVariableColorsChange
}: {
    onNewBox: () => void;
    connectionUrl: string;
    onConnectionUrlChange: (url: string) => void;
    onConfigRestore: (boxes: any[], connectionUrl: string, canvasSettings?: any) => void;
    onDeleteAllBoxes: () => void;
    canvasBackgroundColor?: string;
    canvasBackgroundColorText?: string;
    canvasBackgroundVariableColors?: VariableColor[];
    onCanvasBackgroundColorChange?: (color: string) => void;
    onCanvasBackgroundColorTextChange?: (text: string) => void;
    onCanvasBackgroundVariableColorsChange?: (variableColors: VariableColor[]) => void;
}) {
    const [inputUrl, setInputUrl] = useState('');
    const [isValidUrl, setIsValidUrl] = useState<boolean | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isActive, setIsActive] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Touch gesture state
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [touchStartY, setTouchStartY] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const downloadConfig = async () => {
        try {
            // Get data from localStorage
            const boxes = localStorage.getItem('boxes');
            const connectionUrl = localStorage.getItem('companion_connection_url');
            const canvasSettings = localStorage.getItem('canvas_settings');

            // Create config object
            const config = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                boxes: boxes ? JSON.parse(boxes) : [],
                companion_connection_url: connectionUrl || '',
                canvas_settings: canvasSettings ? JSON.parse(canvasSettings) : {}
            };

            const dataStr = JSON.stringify(config, null, 2);
            const fileName = `companion-dashboard-${new Date().toISOString().split('T')[0]}.json`;

            if (Capacitor.isNativePlatform()) {
                // Native platform (iOS/Android) - use Capacitor plugins
                try {
                    // Write file to Documents directory
                    const result = await Filesystem.writeFile({
                        path: fileName,
                        data: dataStr,
                        directory: Directory.Documents,
                        encoding: Encoding.UTF8
                    });

                    console.log('File saved to:', result.uri);

                    // Show share dialog so user can save/export the file
                    await Share.share({
                        title: 'Export Companion Dashboard Config',
                        text: 'Save your dashboard configuration',
                        url: result.uri,
                        dialogTitle: 'Save Configuration File'
                    });

                    console.log('Config exported successfully');
                } catch (error) {
                    console.error('Failed to export config:', error);
                    //alert('Failed to export configuration');
                }
            } else {
                // Web platform - use original blob method
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);

                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                URL.revokeObjectURL(url);
                console.log('Config downloaded successfully');
            }
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
                localStorage.removeItem('canvas_settings');

                // Set new data
                localStorage.setItem('boxes', JSON.stringify(config.boxes));
                if (config.companion_connection_url) {
                    localStorage.setItem('companion_connection_url', config.companion_connection_url);
                }
                if (config.canvas_settings) {
                    localStorage.setItem('canvas_settings', JSON.stringify(config.canvas_settings));
                }

                // Update parent state
                onConfigRestore(config.boxes, config.companion_connection_url || '', config.canvas_settings);

                // Update local input state
                setInputUrl(config.companion_connection_url || '');

                console.log('Config restored successfully');
                //alert('Configuration restored successfully!');

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

    // Touch gesture handlers
    useEffect(() => {
        const handleTouchStart = (e: TouchEvent) => {
            const touch = e.touches[0];
            const startX = touch.clientX;
            const startY = touch.clientY;

            // Only start tracking if touch begins within 30px of left edge
            if (startX <= 30) {
                setTouchStartX(startX);
                setTouchStartY(startY);
                setIsDragging(true);
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isDragging || touchStartX === null || touchStartY === null) return;

            const touch = e.touches[0];
            const currentX = touch.clientX;
            const currentY = touch.clientY;

            const deltaX = currentX - touchStartX;
            const deltaY = Math.abs(currentY - touchStartY);

            // If user has dragged right more than 50px and vertical movement is less than 100px
            if (deltaX > 50 && deltaY < 100) {
                setIsActive(true);
                setIsDragging(false);
                setTouchStartX(null);
                setTouchStartY(null);
            }

            // Cancel if user moves too far vertically or backwards
            if (deltaY > 100 || deltaX < -20) {
                setIsDragging(false);
                setTouchStartX(null);
                setTouchStartY(null);
            }
        };

        const handleTouchEnd = () => {
            setIsDragging(false);
            setTouchStartX(null);
            setTouchStartY(null);
        };

        // Add touch event listeners to document
        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: true });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isDragging, touchStartX, touchStartY]);

    // Click outside handler to close menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsActive(false);
            }
        };

        if (isActive) {
            document.addEventListener('click', handleClickOutside);
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [isActive]);

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

    const toggleClass = () => {
        setIsActive(prev => !prev);
    };

    const addCanvasVariableColor = () => {
        const variableColors = canvasBackgroundVariableColors || [];
        const newVariableColor: VariableColor = {
            id: uuid(),
            variable: '',
            value: '',
            color: '#ffffff'
        };
        onCanvasBackgroundVariableColorsChange?.([...variableColors, newVariableColor]);
    };

    const removeCanvasVariableColor = (id: string, event?: React.MouseEvent) => {
        event?.stopPropagation();
        const variableColors = canvasBackgroundVariableColors || [];
        onCanvasBackgroundVariableColorsChange?.(variableColors.filter(vc => vc.id !== id));
    };

    const updateCanvasVariableColor = (id: string, property: keyof VariableColor, value: string) => {
        const variableColors = canvasBackgroundVariableColors || [];
        const updated = variableColors.map(vc =>
            vc.id === id ? { ...vc, [property]: value } : vc
        );
        onCanvasBackgroundVariableColorsChange?.(updated);
    };

    return (
        <div ref={menuRef}>
            <div className="menu-icon" onClick={toggleClass}>
                <FaAngleRight style={{ display: isActive ? 'none' : 'inline' }} />
                <FaAngleLeft style={{ display: isActive ? 'inline' : 'none' }} />
            </div>
            <div className={isActive ? 'menu menu-open' : 'menu'}>
                <div className='menu-content'>
                    <div className='logo-box'>
                        <img src={dashboardIcon} style={{ height: '100px' }} alt="Dashboard" />
                        <span className='wordmark'>COMPANION<b style={{ fontSize: '1.3em' }}>DASHBOARD</b></span>
                    </div>
                    <span className='section-label'>Companion Connection</span>
                    <div className="menu-section">
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
                        <button onClick={handleUrlSubmit}>SET</button>
                    </div>
                    <span className='section-label'>Canvas</span>
                    <div className='menu-section canvas-section'>
                        <div className="canvas-color-container">
                            <span className="canvas-color-label">Default Background Color</span>
                            <div className="canvas-color-input-group">
                                <input
                                    type="color"
                                    value={canvasBackgroundColor || '#000000'}
                                    onChange={(e) => onCanvasBackgroundColorChange?.(e.target.value)}
                                    className="canvas-color-picker"
                                />
                                <input
                                    type="text"
                                    value={canvasBackgroundColorText || ''}
                                    onChange={(e) => onCanvasBackgroundColorTextChange?.(e.target.value)}
                                    placeholder="Variable or HEX"
                                    className="canvas-color-text"
                                />
                            </div>
                        </div>
                        <div className="canvas-variable-color-container">
                            <span className="canvas-color-label">Variable Background Color</span>
                            <div className="canvas-variable-color-section">
                                {(canvasBackgroundVariableColors || []).map(vc => (
                                    <div key={vc.id} className="canvas-variable-color-row">
                                        <input
                                            type="text"
                                            value={vc.variable}
                                            onChange={(e) => updateCanvasVariableColor(vc.id, 'variable', e.target.value)}
                                            placeholder="Variable"
                                            className="canvas-variable-input"
                                        />
                                        <input
                                            type="text"
                                            value={vc.value}
                                            onChange={(e) => updateCanvasVariableColor(vc.id, 'value', e.target.value)}
                                            placeholder="Value"
                                            className="canvas-value-input"
                                        />
                                        <input
                                            type="color"
                                            value={vc.color}
                                            onChange={(e) => updateCanvasVariableColor(vc.id, 'color', e.target.value)}
                                            className="canvas-variable-color-picker"
                                        />
                                        <button
                                            type="button"
                                            className="canvas-remove-variable-color-button"
                                            onClick={(e) => removeCanvasVariableColor(vc.id, e)}
                                        >
                                            <FaCircleMinus />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                className="canvas-add-variable-color-button"
                                onClick={addCanvasVariableColor}
                            >
                                <FaCirclePlus />
                            </button>
                        </div>
                    </div>

                    <span className='section-label'>Boxes</span>
                    <div className='menu-section'>
                        <button onClick={onNewBox}>NEW BOX</button>
                        <button
                            onClick={() => {
                                const confirmed = window.confirm("Are you sure you want to clear all of the boxes?");
                                if (confirmed) {
                                    onDeleteAllBoxes();
                                }
                            }}
                            className='clear-boxes'
                        >
                            CLEAR ALL
                        </button>
                    </div>

                    <span className='section-label'>CONFIGURATION</span>
                    <div className='menu-section'>
                        <button onClick={downloadConfig}>SAVE</button>
                        <button onClick={triggerFileInput}>LOAD</button>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleFileRestore}
                        style={{ display: 'none' }}
                    />
                    <span className='footer'>v1.1.1<br />Created by <a href='http://tomhillmeyer.com'>Tom Hillmeyer</a></span>
                </div>
            </div>
        </div>
    );
}