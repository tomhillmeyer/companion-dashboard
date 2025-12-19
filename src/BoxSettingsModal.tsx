import { useState, useRef } from 'react';
import type { BoxData, VariableColor } from './App';
import { v4 as uuid } from 'uuid';
import './BoxSettingsModal.css';
import ColorPicker from './ColorPicker';

import { FaCirclePlus } from "react-icons/fa6";
import { FaCircleMinus } from "react-icons/fa6";
import { FaAlignLeft, FaAlignCenter, FaAlignRight } from "react-icons/fa6";

import backgroundIcon from './assets/background_icon.png';
import headerIcon from './assets/header_icon.png';
import leftIcon from './assets/left_icon.png';
import rightIcon from './assets/right_icon.png';


interface BoxSettingsModalProps {
    boxData: BoxData;
    onSave: (boxData: BoxData) => void;
    onCancel: () => void;
    onDelete: (boxId: string) => void;
    onDuplicate: (boxData: BoxData) => void;
}

type SettingSection = 'background' | 'header' | 'left' | 'right';

export default function BoxSettingsModal({ boxData, onSave, onCancel, onDelete, onDuplicate }: BoxSettingsModalProps) {
    const [formData, setFormData] = useState(boxData);
    const [activeSection, setActiveSection] = useState<SettingSection>('background');
    const backgroundImageInputRef = useRef<HTMLInputElement>(null);

    const handleSave = () => {
        onSave(formData);
    };

    const handleDelete = () => {
        onDelete(boxData.id);
    };

    const updateField = (field: keyof BoxData, value: any) => {
        setFormData({ ...formData, [field]: value });
    };

    const handleNumberInput = (field: keyof BoxData, value: string) => {
        if (value === '' || /^\d*$/.test(value)) {
            setFormData({ ...formData, [field]: value });
        }
    };

    const handleNumberBlur = (field: keyof BoxData, value: string) => {
        const numValue = parseInt(value);
        if (isNaN(numValue)) {
            setFormData({ ...formData, [field]: 12 });
        } else {
            setFormData({ ...formData, [field]: numValue });
        }
    };

    const handleDuplicate = () => {
        onDuplicate(formData);
    };

    const addVariableColor = (field: keyof BoxData) => {
        const variableColors = (formData[field] as VariableColor[]) || [];
        const newVariableColor: VariableColor = {
            id: uuid(),
            variable: '',
            value: '',
            color: '#ffffff'
        };
        updateField(field, [...variableColors, newVariableColor]);
    };

    const removeVariableColor = (field: keyof BoxData, id: string) => {
        const variableColors = (formData[field] as VariableColor[]) || [];
        updateField(field, variableColors.filter(vc => vc.id !== id));
    };

    const updateVariableColor = (field: keyof BoxData, id: string, property: keyof VariableColor, value: string) => {
        const variableColors = (formData[field] as VariableColor[]) || [];
        const updated = variableColors.map(vc =>
            vc.id === id ? { ...vc, [property]: value } : vc
        );
        updateField(field, updated);
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
                
                // Preserve PNG format for images with transparency
                const isPNG = file.type === 'image/png';
                const base64DataUrl = isPNG 
                    ? canvas.toDataURL('image/png')
                    : canvas.toDataURL('image/jpeg', quality);

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
        if (!file.type || typeof file.type !== 'string' || !file.type.startsWith('image/')) {
            alert('Please select an image file.');
            return;
        }

        try {
            // Compress image for better performance
            const base64DataUrl = await compressImage(file);

            // Create a unique filename with timestamp and box ID
            const timestamp = Date.now();
            const cachedFilename = `box_bg_${formData.id}_${timestamp}.jpg`;

            // Clear old cached background image if it exists
            if (formData.backgroundImage) {
                const oldFilename = formData.backgroundImage.split('/').pop();
                if (oldFilename) {
                    await deleteImageFromDB(oldFilename);
                }
            }

            // Set the new background image path
            updateField('backgroundImage', `./src/assets/${cachedFilename}`);

            // Store the base64 data URL in IndexedDB
            try {
                await storeImageInDB(cachedFilename, base64DataUrl);
            } catch (dbError) {
                console.error('IndexedDB storage failed:', dbError);
                throw new Error('Failed to store background image.');
            }
        } catch (error) {
            console.error('Failed to set background image:', error);
            alert('Failed to set background image.');
        }

        // Reset file input
        event.target.value = '';
    };

    const clearBackgroundImage = async () => {
        if (formData.backgroundImage) {
            const filename = formData.backgroundImage.split('/').pop();
            if (filename) {
                await deleteImageFromDB(filename);
            }
            updateField('backgroundImage', '');
        }
    };

    // IndexedDB helper functions
    const openImageDB = (): Promise<IDBDatabase> => {
        return new Promise((resolve, reject) => {
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
                request.onsuccess = () => resolve();
            });
        } catch (error) {
            console.error('Error in storeImageInDB:', error);
            throw error;
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

    const renderVariableColorSection = (title: string, field: keyof BoxData) => {
        const variableColors = (formData[field] as VariableColor[]) || [];

        return (
            <div className="setting-row">
                <div className="setting-label">
                    <span className="setting-header">{title}</span>
                    <div className="variable-color-section">
                        {variableColors.map(vc => (
                            <div key={vc.id} className="variable-color-row">
                                <input
                                    type="text"
                                    value={vc.variable}
                                    onChange={(e) => updateVariableColor(field, vc.id, 'variable', e.target.value)}
                                    placeholder="Variable"
                                    className="variable-input"
                                />
                                <input
                                    type="text"
                                    value={vc.value}
                                    onChange={(e) => updateVariableColor(field, vc.id, 'value', e.target.value)}
                                    placeholder="Value"
                                    className="value-input"
                                />
                                <ColorPicker
                                    value={vc.color}
                                    onChange={(color) => updateVariableColor(field, vc.id, 'color', color)}
                                    className="color-picker"
                                />
                                <button
                                    type="button"
                                    className="remove-variable-color-button"
                                    onClick={() => removeVariableColor(field, vc.id)}
                                >
                                    <FaCircleMinus />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        className="add-variable-color-button"
                        onClick={() => addVariableColor(field)}
                    >
                        <FaCirclePlus />
                    </button>
                </div>
            </div>
        );
    };

    const renderBackgroundSettings = () => (
        <div className="settings-section">
            <div className="setting-title">Background</div>
            <div className="setting-group">
                <div className='setting-container'>
                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Default Background</span>
                            <div className="color-input-group">
                                <ColorPicker
                                    value={formData.backgroundColor}
                                    onChange={(color) => updateField('backgroundColor', color)}
                                />
                                <input
                                    type="text"
                                    value={formData.backgroundColorText}
                                    onChange={(e) => updateField('backgroundColorText', e.target.value)}
                                    placeholder="Variable, HEX, or Image URL"
                                />
                            </div>
                            <div className="image-controls">
                                <button
                                    type="button"
                                    className="browse-image-button"
                                    onClick={handleBackgroundImageBrowse}
                                >
                                    Browse Image
                                </button>
                                {formData.backgroundImage && (
                                    <button
                                        type="button"
                                        className="clear-image-button"
                                        onClick={clearBackgroundImage}
                                    >
                                        Clear Image
                                    </button>
                                )}
                                <input
                                    ref={backgroundImageInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleBackgroundImageChange}
                                    style={{ display: 'none' }}
                                />
                            </div>
                            <div className="image-size-controls">
                                <label>
                                    <input
                                        type="radio"
                                        name="backgroundImageSize"
                                        value="cover"
                                        checked={formData.backgroundImageSize !== 'contain'}
                                        onChange={() => updateField('backgroundImageSize', 'cover')}
                                    />
                                    Cover
                                </label>
                                <label>
                                    <input
                                        type="radio"
                                        name="backgroundImageSize"
                                        value="contain"
                                        checked={formData.backgroundImageSize === 'contain'}
                                        onChange={() => updateField('backgroundImageSize', 'contain')}
                                    />
                                    Contain
                                </label>
                            </div>
                            <div className="opacity-controls">
                                <label htmlFor="background-opacity">Background Image Opacity (%)</label>
                                <input
                                    id="background-opacity"
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={formData.backgroundImageOpacity || 100}
                                    onChange={(e) => updateField('backgroundImageOpacity', parseInt(e.target.value) || 100)}
                                    className="opacity-input"
                                />
                            </div>
                        </div>
                    </div>


                    {renderVariableColorSection('Variable Background Color', 'backgroundVariableColors')}
                </div>

                <div className='setting-container'>
                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Default Border Color</span>
                            <div className="color-input-group">
                                <ColorPicker
                                    value={formData.borderColor}
                                    onChange={(color) => updateField('borderColor', color)}
                                />
                                <input
                                    type="text"
                                    value={formData.borderColorText}
                                    onChange={(e) => updateField('borderColorText', e.target.value)}
                                    placeholder="Variable or HEX"
                                />
                            </div>
                            <div className="checkbox-container" style={{ marginLeft: '0px', }}>
                                <input
                                    type="checkbox"
                                    id="no-border"
                                    checked={formData.noBorder}
                                    onChange={(e) => updateField('noBorder', e.target.checked)}
                                />
                                <label htmlFor="no-border">No border</label>
                            </div>
                        </div>
                    </div>
                    {renderVariableColorSection('Variable Border Color', 'borderVariableColors')}

                </div>
            </div>
        </div>
    );

    const renderHeaderSettings = () => (
        <div className="settings-section">
            <div className="setting-title">
                Header
                <div className="checkbox-container">
                    <input
                        type="checkbox"
                        id="header-visible"
                        checked={formData.headerLabelVisible}
                        onChange={(e) => updateField('headerLabelVisible', e.target.checked)}
                    />
                    <label htmlFor="header-visible">Visible</label>
                </div>
            </div>
            <div className="setting-group">
                <div className="setting-row">
                    <div className="setting-label">
                        <span className="setting-header">Header Text</span>
                        <input
                            type="text"
                            value={formData.headerLabelSource}
                            onChange={(e) => updateField('headerLabelSource', e.target.value)}
                            className="full-width-input"
                        />
                    </div>
                </div>
                <div className='setting-container'>
                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Font Size</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={formData.headerLabelSize}
                                onChange={(e) => handleNumberInput('headerLabelSize', e.target.value)}
                                onBlur={(e) => handleNumberBlur('headerLabelSize', e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Alignment</span>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <button
                                    type="button"
                                    onClick={() => updateField('headerLabelAlign', 'left')}
                                    style={{
                                        padding: '8px 12px',
                                        backgroundColor: (formData.headerLabelAlign || 'center') === 'left' ? '#61BAFA' : '#333',
                                        border: 'none',
                                        borderRadius: '4px',
                                        color: 'white',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <FaAlignLeft />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateField('headerLabelAlign', 'center')}
                                    style={{
                                        padding: '8px 12px',
                                        backgroundColor: (formData.headerLabelAlign || 'center') === 'center' ? '#61BAFA' : '#333',
                                        border: 'none',
                                        borderRadius: '4px',
                                        color: 'white',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <FaAlignCenter />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateField('headerLabelAlign', 'right')}
                                    style={{
                                        padding: '8px 12px',
                                        backgroundColor: (formData.headerLabelAlign || 'center') === 'right' ? '#61BAFA' : '#333',
                                        border: 'none',
                                        borderRadius: '4px',
                                        color: 'white',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <FaAlignRight />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div className='setting-container'>

                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Default Text Color</span>
                            <div className="color-input-group">
                                <ColorPicker
                                    value={formData.headerLabelColor}
                                    onChange={(color) => updateField('headerLabelColor', color)}
                                />
                                <input
                                    type="text"
                                    value={formData.headerLabelColorText}
                                    onChange={(e) => updateField('headerLabelColorText', e.target.value)}
                                    placeholder="Variable or HEX"
                                />
                            </div>
                        </div>
                    </div>

                    {renderVariableColorSection('Variable Text Color', 'headerLabelVariableColors')}
                </div>

                <div className='setting-container'>
                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Default Background Color</span>
                            <div className="color-input-group">
                                <ColorPicker
                                    value={formData.headerColor}
                                    onChange={(color) => updateField('headerColor', color)}
                                />
                                <input
                                    type="text"
                                    value={formData.headerColorText}
                                    onChange={(e) => updateField('headerColorText', e.target.value)}
                                    placeholder="Variable or HEX"
                                />
                            </div>
                        </div>
                    </div>

                    {renderVariableColorSection('Variable Background Color', 'headerVariableColors')}
                </div>


            </div>
        </div>
    );

    const renderLeftSettings = () => (
        <div className="settings-section">
            <div className="setting-title">
                Left
                <div className="checkbox-container">
                    <input
                        type="checkbox"
                        id="left-visible"
                        checked={formData.leftVisible}
                        onChange={(e) => updateField('leftVisible', e.target.checked)}
                    />
                    <label htmlFor="left-visible">Visible</label>
                </div>
            </div>
            <div className="setting-group">
                <div className="setting-row">
                    <div className="setting-label">
                        <span className="setting-header">Left Text</span>
                        <input
                            type="text"
                            value={formData.leftLabelSource}
                            onChange={(e) => updateField('leftLabelSource', e.target.value)}
                            className="full-width-input"
                        />
                    </div>
                </div>
                <div className='setting-container'>
                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Font Size</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={formData.leftLabelSize}
                                onChange={(e) => handleNumberInput('leftLabelSize', e.target.value)}
                                onBlur={(e) => handleNumberBlur('leftLabelSize', e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Width %</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={!formData.leftVisible ? 0 : !formData.rightVisible ? 100 : formData.leftRightRatio}
                                onChange={(e) => handleNumberInput('leftRightRatio', e.target.value)}
                                onBlur={(e) => {
                                    const numValue = parseInt(e.target.value);
                                    if (isNaN(numValue) || numValue < 0) {
                                        updateField('leftRightRatio', 50);
                                    } else if (numValue > 100) {
                                        updateField('leftRightRatio', 100);
                                    } else {
                                        updateField('leftRightRatio', numValue);
                                    }
                                }}
                                disabled={!formData.leftVisible || !formData.rightVisible}
                            />
                        </div>
                    </div>
                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Alignment</span>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <button
                                    type="button"
                                    onClick={() => updateField('leftLabelAlign', 'left')}
                                    style={{
                                        padding: '8px 12px',
                                        backgroundColor: (formData.leftLabelAlign || 'left') === 'left' ? '#61BAFA' : '#333',
                                        border: 'none',
                                        borderRadius: '4px',
                                        color: 'white',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <FaAlignLeft />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateField('leftLabelAlign', 'center')}
                                    style={{
                                        padding: '8px 12px',
                                        backgroundColor: (formData.leftLabelAlign || 'left') === 'center' ? '#61BAFA' : '#333',
                                        border: 'none',
                                        borderRadius: '4px',
                                        color: 'white',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <FaAlignCenter />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateField('leftLabelAlign', 'right')}
                                    style={{
                                        padding: '8px 12px',
                                        backgroundColor: (formData.leftLabelAlign || 'left') === 'right' ? '#61BAFA' : '#333',
                                        border: 'none',
                                        borderRadius: '4px',
                                        color: 'white',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <FaAlignRight />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className='setting-container'>
                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Default Text Color</span>
                            <div className="color-input-group">
                                <ColorPicker
                                    value={formData.leftLabelColor}
                                    onChange={(color) => updateField('leftLabelColor', color)}
                                />
                                <input
                                    type="text"
                                    value={formData.leftLabelColorText}
                                    onChange={(e) => updateField('leftLabelColorText', e.target.value)}
                                    placeholder="Variable or HEX"
                                />
                            </div>
                        </div>
                    </div>

                    {renderVariableColorSection('Variable Text Color', 'leftLabelVariableColors')}
                </div>

            </div>
        </div >
    );

    const renderRightSettings = () => (
        <div className="settings-section">
            <div className="setting-title">
                Right
                <div className="checkbox-container">
                    <input
                        type="checkbox"
                        id="right-visible"
                        checked={formData.rightVisible}
                        onChange={(e) => updateField('rightVisible', e.target.checked)}
                    />
                    <label htmlFor="right-visible">Visible</label>
                </div>
            </div>
            <div className="setting-group">
                <div className="setting-row">
                    <div className="setting-label">
                        <span className="setting-header">Right Text</span>
                        <input
                            type="text"
                            value={formData.rightLabelSource}
                            onChange={(e) => updateField('rightLabelSource', e.target.value)}
                            className="full-width-input"
                        />
                    </div>
                </div>
                <div className='setting-container'>
                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Font Size</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={formData.rightLabelSize}
                                onChange={(e) => handleNumberInput('rightLabelSize', e.target.value)}
                                onBlur={(e) => handleNumberBlur('rightLabelSize', e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Width %</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={!formData.rightVisible ? 0 : !formData.leftVisible ? 100 : 100 - formData.leftRightRatio}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '' || /^\d*$/.test(value)) {
                                        const numValue = value === '' ? 0 : parseInt(value);
                                        updateField('leftRightRatio', 100 - numValue);
                                    }
                                }}
                                onBlur={(e) => {
                                    const numValue = parseInt(e.target.value);
                                    if (isNaN(numValue) || numValue < 0) {
                                        updateField('leftRightRatio', 50);
                                    } else if (numValue > 100) {
                                        updateField('leftRightRatio', 0);
                                    } else {
                                        updateField('leftRightRatio', 100 - numValue);
                                    }
                                }}
                                disabled={!formData.leftVisible || !formData.rightVisible}
                            />
                        </div>
                    </div>
                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Alignment</span>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <button
                                    type="button"
                                    onClick={() => updateField('rightLabelAlign', 'left')}
                                    style={{
                                        padding: '8px 12px',
                                        backgroundColor: (formData.rightLabelAlign || 'right') === 'left' ? '#61BAFA' : '#333',
                                        border: 'none',
                                        borderRadius: '4px',
                                        color: 'white',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <FaAlignLeft />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateField('rightLabelAlign', 'center')}
                                    style={{
                                        padding: '8px 12px',
                                        backgroundColor: (formData.rightLabelAlign || 'right') === 'center' ? '#61BAFA' : '#333',
                                        border: 'none',
                                        borderRadius: '4px',
                                        color: 'white',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <FaAlignCenter />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateField('rightLabelAlign', 'right')}
                                    style={{
                                        padding: '8px 12px',
                                        backgroundColor: (formData.rightLabelAlign || 'right') === 'right' ? '#61BAFA' : '#333',
                                        border: 'none',
                                        borderRadius: '4px',
                                        color: 'white',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <FaAlignRight />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className='setting-container'>
                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Default Text Color</span>
                            <div className="color-input-group">
                                <ColorPicker
                                    value={formData.rightLabelColor}
                                    onChange={(color) => updateField('rightLabelColor', color)}
                                />
                                <input
                                    type="text"
                                    value={formData.rightLabelColorText}
                                    onChange={(e) => updateField('rightLabelColorText', e.target.value)}
                                    placeholder="Variable or HEX"
                                />
                            </div>
                        </div>
                    </div>

                    {renderVariableColorSection('Variable Text Color', 'rightLabelVariableColors')}
                </div>

            </div>
        </div>
    );

    const renderActiveSection = () => {
        switch (activeSection) {
            case 'background':
                return renderBackgroundSettings();
            case 'header':
                return renderHeaderSettings();
            case 'left':
                return renderLeftSettings();
            case 'right':
                return renderRightSettings();
            default:
                return renderBackgroundSettings();
        }
    };

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-buttons">
                        <button onClick={handleSave} className="modal-save-button">SAVE</button>
                        <button onClick={onCancel} className="modal-cancel-button">CANCEL</button>
                        <button onClick={handleDuplicate} className="modal-duplicate-button">DUPLICATE</button>
                        <button onClick={handleDelete} className="modal-delete-button">DELETE</button>
                    </div>
                    <div className='layer-input-row'>

                        <div className="layer-input-container">
                            <label htmlFor="x-input">X-Position</label>
                            <input
                                id="x-input"
                                type="number"
                                value={formData.frame.translate[0]}
                                onChange={(e) => updateField('frame', {
                                    ...formData.frame,
                                    translate: [parseInt(e.target.value) || 0, formData.frame.translate[1]] as [number, number]
                                })}
                                className="layer-input"
                            />
                        </div>
                        <div className="layer-input-container">
                            <label htmlFor="y-input">Y-POSITION</label>
                            <input
                                id="y-input"
                                type="number"
                                value={formData.frame.translate[1]}
                                onChange={(e) => updateField('frame', {
                                    ...formData.frame,
                                    translate: [formData.frame.translate[0], parseInt(e.target.value) || 0] as [number, number]
                                })}
                                className="layer-input"
                            />
                        </div>
                        <div className="layer-input-container">
                            <label htmlFor="width-input">Width</label>
                            <input
                                id="width-input"
                                type="number"
                                value={formData.frame.width}
                                onChange={(e) => updateField('frame', {
                                    ...formData.frame,
                                    width: parseInt(e.target.value) || 100
                                })}
                                min="10"
                                className="layer-input"
                            />
                        </div>
                        <div className="layer-input-container">
                            <label htmlFor="height-input">Height</label>
                            <input
                                id="height-input"
                                type="number"
                                value={formData.frame.height}
                                onChange={(e) => updateField('frame', {
                                    ...formData.frame,
                                    height: parseInt(e.target.value) || 100
                                })}
                                min="10"
                                className="layer-input"
                            />
                        </div>
                        <div className="layer-input-container">
                            <label htmlFor="layer-input">Layer</label>
                            <input
                                id="layer-input"
                                type="number"
                                value={formData.zIndex}
                                onChange={(e) => updateField('zIndex', parseInt(e.target.value) || 1)}
                                min="1"
                                className="layer-input"
                            />
                        </div>
                    </div>
                </div>

                <div className="modal-body">
                    <div className="modal-nav">
                        <div
                            className={`nav-item ${activeSection === 'background' ? 'active' : ''}`}
                            onClick={() => setActiveSection('background')}
                        >
                            <img src={backgroundIcon} alt="Background" className="nav-icon" />
                        </div>
                        <div
                            className={`nav-item ${activeSection === 'header' ? 'active' : ''}`}
                            onClick={() => setActiveSection('header')}
                        >
                            <img src={headerIcon} alt="Header" className="nav-icon" />
                        </div>
                        <div
                            className={`nav-item ${activeSection === 'left' ? 'active' : ''}`}
                            onClick={() => setActiveSection('left')}
                        >
                            <img src={leftIcon} alt="Left" className="nav-icon" />
                        </div>
                        <div
                            className={`nav-item ${activeSection === 'right' ? 'active' : ''}`}
                            onClick={() => setActiveSection('right')}
                        >
                            <img src={rightIcon} alt="Right" className="nav-icon" />
                        </div>
                    </div>

                    <div className="modal-content-area">
                        {renderActiveSection()}
                    </div>
                </div>
            </div>
        </div >
    );
}