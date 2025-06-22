// SettingsMenu.tsx
import { useState, useEffect, useRef } from 'react';
import { FaAngleRight } from "react-icons/fa6";
import { FaAngleLeft } from "react-icons/fa6";
import { FaCirclePlus } from "react-icons/fa6";
import { FaCircleMinus } from "react-icons/fa6";
import { v4 as uuid } from 'uuid';
import type { VariableColor } from './App';
import ColorPicker from './ColorPicker';

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

    // Background image file input ref
    const backgroundImageInputRef = useRef<HTMLInputElement>(null);

    // Config load dialog state
    const [showConfigDialog, setShowConfigDialog] = useState(false);
    const [pendingConfig, setPendingConfig] = useState<any>(null);

    const downloadConfig = async () => {
        try {
            // Get data from localStorage
            const boxes = localStorage.getItem('boxes');
            const connectionUrl = localStorage.getItem('companion_connection_url');
            const canvasSettings = localStorage.getItem('canvas_settings');

            // Get cached background image data if it exists
            const canvasSettingsObj = canvasSettings ? JSON.parse(canvasSettings) : {};
            let backgroundImageData = null;

            if (canvasSettingsObj.canvasBackgroundColorText &&
                canvasSettingsObj.canvasBackgroundColorText.startsWith('./src/assets/background_')) {
                const filename = canvasSettingsObj.canvasBackgroundColorText.split('/').pop();
                if (filename) {
                    // Try IndexedDB first, then localStorage fallback
                    backgroundImageData = await getImageFromDB(filename);
                    if (!backgroundImageData) {
                        backgroundImageData = localStorage.getItem(`cached_bg_${filename}`);
                    }
                }
            }

            // Create config object
            const config = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                boxes: boxes ? JSON.parse(boxes) : [],
                companion_connection_url: connectionUrl || '',
                canvas_settings: canvasSettingsObj,
                background_image_data: backgroundImageData
            };

            console.log('Config export:', {
                hasBackgroundImage: !!backgroundImageData,
                backgroundImageSize: backgroundImageData ? `${(backgroundImageData.length / 1024 / 1024).toFixed(2)}MB` : 'none'
            });

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

                // Store config and show dialog
                setPendingConfig(config);
                setShowConfigDialog(true);
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

    const [visible, setVisible] = useState(true);
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
        const handleMouseMove = () => {
            setVisible(true);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = window.setTimeout(() => {
                setVisible(false);
            }, 2000); // 2 seconds of inactivity
        };

        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

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

    const handleBackgroundImageBrowse = () => {
        backgroundImageInputRef.current?.click();
    };

    const compressImage = (file: File, maxWidth: number = 1920, maxHeight: number = 1080, quality: number = 0.9): Promise<string> => {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // Calculate new dimensions while maintaining aspect ratio
                let { width, height } = img;
                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                // Draw and compress image
                ctx?.drawImage(img, 0, 0, width, height);
                const base64DataUrl = canvas.toDataURL('image/jpeg', quality);
                
                console.log(`Compressed image with quality: ${quality}, estimated size: ${(base64DataUrl.length * 0.75 / 1024 / 1024).toFixed(2)}MB`);
                resolve(base64DataUrl);
            };

            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
        });
    };

    const handleBackgroundImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Check if it's an image file
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file.');
            return;
        }


        try {
            console.log(`Original file size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
            
            // Check current localStorage usage
            let totalSize = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    totalSize += localStorage[key].length;
                }
            }
            console.log(`Current localStorage usage: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
            
            // Compress image for better performance on mobile
            const base64DataUrl = await compressImage(file);

            // Create a unique filename with timestamp
            const timestamp = Date.now();
            const cachedFilename = `background_${timestamp}.jpg`; // Always save as JPG after compression

            // Delete old cached background image if it exists
            const currentBgText = canvasBackgroundColorText || '';
            if (currentBgText.startsWith('./src/assets/background_') && currentBgText.includes('.')) {
                const oldFilename = currentBgText.split('/').pop();
                if (oldFilename) {
                    localStorage.removeItem(`cached_bg_${oldFilename}`);
                }
            }

            // Set the new background image path
            onCanvasBackgroundColorTextChange?.(`./src/assets/${cachedFilename}`);

            // Store the base64 data URL in IndexedDB (much larger capacity)
            try {
                await storeImageInDB(cachedFilename, base64DataUrl);
                console.log('Background image stored in IndexedDB:', cachedFilename);
            } catch (dbError) {
                console.error('IndexedDB storage failed, falling back to localStorage:', dbError);
                // Fallback to localStorage with compression
                try {
                    localStorage.setItem(`cached_bg_${cachedFilename}`, base64DataUrl);
                    console.log('Background image stored in localStorage (fallback)');
                } catch (quotaError) {
                    if (quotaError instanceof DOMException && quotaError.name === 'QuotaExceededError') {
                        throw new Error(`Storage quota exceeded. Current localStorage usage: ${(totalSize / 1024 / 1024).toFixed(2)}MB. Please clear some data or use a smaller image.`);
                    } else {
                        throw quotaError;
                    }
                }
            }
        } catch (error) {
            console.error('Failed to cache background image:', error);
            alert('Failed to set background image.');
        }

        // Reset file input
        event.target.value = '';
    };

    // IndexedDB helper functions for larger image storage
    const openImageDB = (): Promise<IDBDatabase> => {
        return new Promise((resolve, reject) => {
            // Use a higher version to avoid conflicts
            const request = indexedDB.open('CompanionDashboardImages', 3);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains('images')) {
                    db.createObjectStore('images', { keyPath: 'id' });
                }
            };
        });
    };

    const storeImageInDB = async (filename: string, base64Data: string): Promise<void> => {
        try {
            const db = await openImageDB();
            const transaction = db.transaction(['images'], 'readwrite');
            const store = transaction.objectStore('images');
            
            return new Promise((resolve, reject) => {
                const request = store.put({ id: filename, data: base64Data });
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    console.log('Successfully stored image in IndexedDB');
                    resolve();
                };
            });
        } catch (error) {
            console.error('Error in storeImageInDB:', error);
            throw error;
        }
    };

    const getImageFromDB = async (filename: string): Promise<string | null> => {
        try {
            const db = await openImageDB();
            const transaction = db.transaction(['images'], 'readonly');
            const store = transaction.objectStore('images');
            
            return new Promise((resolve, reject) => {
                const request = store.get(filename);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const result = request.result;
                    resolve(result ? result.data : null);
                };
            });
        } catch (error) {
            console.error('Error getting image from IndexedDB:', error);
            return null;
        }
    };

    const deleteImageFromDB = async (filename: string): Promise<void> => {
        try {
            const db = await openImageDB();
            const transaction = db.transaction(['images'], 'readwrite');
            const store = transaction.objectStore('images');
            
            return new Promise((resolve, reject) => {
                const request = store.delete(filename);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            });
        } catch (error) {
            console.error('Error deleting image from IndexedDB:', error);
        }
    };

    const clearCachedBackground = async () => {
        const currentBgText = canvasBackgroundColorText || '';
        if (currentBgText.startsWith('./src/assets/background_')) {
            // Clear the cached image reference
            onCanvasBackgroundColorTextChange?.('');

            // Remove cached image from both localStorage and IndexedDB
            const filename = currentBgText.split('/').pop();
            if (filename) {
                localStorage.removeItem(`cached_bg_${filename}`);
                await deleteImageFromDB(filename);
                console.log('Cleared cached background image:', filename);
            }
        }
    };

    const handleAddBoxesOnly = () => {
        if (!pendingConfig) return;

        // Add boxes only - generate new UUIDs
        const existingBoxes = localStorage.getItem('boxes');
        const currentBoxes = existingBoxes ? JSON.parse(existingBoxes) : [];

        // Create new boxes with fresh UUIDs
        const newBoxes = pendingConfig.boxes.map((box: any) => ({
            ...box,
            id: uuid(), // Generate new UUID for each box
            frame: {
                ...box.frame,
                translate: [
                    box.frame.translate[0] + 20, // Offset slightly to avoid overlap
                    box.frame.translate[1] + 20
                ]
            }
        }));

        const mergedBoxes = [...currentBoxes, ...newBoxes];
        localStorage.setItem('boxes', JSON.stringify(mergedBoxes));

        // Update parent state with merged boxes, keep existing settings
        onConfigRestore(mergedBoxes, connectionUrl, null);

        console.log('Boxes added successfully with new UUIDs');
        setShowConfigDialog(false);
        setPendingConfig(null);
    };

    const handleReplaceEntireConfig = async () => {
        if (!pendingConfig) return;

        // Ask for confirmation
        const confirmReplace = window.confirm(
            "Are you sure you want to replace the entire configuration? This cannot be undone."
        );

        if (confirmReplace) {
            // Clear current localStorage
            localStorage.removeItem('boxes');
            localStorage.removeItem('companion_connection_url');
            localStorage.removeItem('canvas_settings');

            // Set new data
            localStorage.setItem('boxes', JSON.stringify(pendingConfig.boxes));
            if (pendingConfig.companion_connection_url) {
                localStorage.setItem('companion_connection_url', pendingConfig.companion_connection_url);
            }
            if (pendingConfig.canvas_settings) {
                localStorage.setItem('canvas_settings', JSON.stringify(pendingConfig.canvas_settings));
            }

            // Restore background image if it exists
            if (pendingConfig.background_image_data && pendingConfig.canvas_settings?.canvasBackgroundColorText) {
                const backgroundPath = pendingConfig.canvas_settings.canvasBackgroundColorText;
                if (backgroundPath.startsWith('./src/assets/background_')) {
                    const filename = backgroundPath.split('/').pop();
                    if (filename) {
                        try {
                            await storeImageInDB(filename, pendingConfig.background_image_data);
                            console.log('Background image restored to IndexedDB');
                        } catch (error) {
                            // Fallback to localStorage
                            localStorage.setItem(`cached_bg_${filename}`, pendingConfig.background_image_data);
                            console.log('Background image restored to localStorage (fallback)');
                        }
                    }
                }
            }

            // Update parent state
            onConfigRestore(pendingConfig.boxes, pendingConfig.companion_connection_url || '', pendingConfig.canvas_settings);

            // Update local input state
            setInputUrl(pendingConfig.companion_connection_url || '');

            console.log('Full configuration replaced successfully');
        }

        setShowConfigDialog(false);
        setPendingConfig(null);
    };

    return (
        <div ref={menuRef}>
            <div id="menu-icon"
                className="menu-icon"
                style={{
                    opacity: visible ? 1 : 0,
                    transition: 'opacity 0.5s ease',
                }} onClick={toggleClass}>
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
                            <span className="canvas-color-label">Default Background</span>
                            <div className="canvas-color-input-group">
                                <ColorPicker
                                    value={canvasBackgroundColor || '#000000'}
                                    onChange={(color) => onCanvasBackgroundColorChange?.(color)}
                                    className="canvas-color-picker"
                                />
                                <input
                                    type="text"
                                    value={canvasBackgroundColorText || ''}
                                    onChange={(e) => onCanvasBackgroundColorTextChange?.(e.target.value)}
                                    placeholder="Variable, HEX, or Image URL"
                                    className="canvas-color-text"
                                />
                            </div>
                            <div className="canvas-image-controls">
                                <button
                                    type="button"
                                    onClick={handleBackgroundImageBrowse}
                                    className="canvas-browse-button"
                                >
                                    Browse Image
                                </button>
                                {canvasBackgroundColorText && canvasBackgroundColorText.startsWith('./src/assets/background_') && (
                                    <button
                                        type="button"
                                        onClick={clearCachedBackground}
                                        className="canvas-clear-button"
                                    >
                                        Clear Image
                                    </button>
                                )}
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
                                        <ColorPicker
                                            value={vc.color}
                                            onChange={(color) => updateCanvasVariableColor(vc.id, 'color', color)}
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
                    <input
                        ref={backgroundImageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleBackgroundImageChange}
                        style={{ display: 'none' }}
                    />
                    <span className='footer'>v1.1.1<br />Created by Tom Hillmeyer</span>
                </div>
            </div>

            {/* Config Load Dialog */}
            {showConfigDialog && (
                <div className="config-dialog-overlay">
                    <div className="config-dialog">
                        <h3>Load Configuration</h3>
                        <p>How would you like to load this configuration?</p>
                        <div className="config-dialog-buttons">
                            <button
                                className="config-dialog-button add-boxes"
                                onClick={handleAddBoxesOnly}
                            >
                                Add Boxes Only
                                <span className="button-description">Keep current settings</span>
                            </button>
                            <button
                                className="config-dialog-button replace-all"
                                onClick={handleReplaceEntireConfig}
                            >
                                Replace Everything
                                <span className="button-description">Replace all settings</span>
                            </button>
                        </div>
                        <button
                            className="config-dialog-cancel"
                            onClick={() => {
                                setShowConfigDialog(false);
                                setPendingConfig(null);
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}