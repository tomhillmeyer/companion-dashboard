import { useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { BoxData, VariableColor, VariableOpacity, VariableOverlaySize, ROI, CompanionConnection, ComparisonOperator, PageData, BoxLayer, LayerOverlay, LayerType, TextLayer, ImageLayer, VideoLayer, ColorLayer, LayerRadius, AnimationType } from './types';
import { v4 as uuid } from 'uuid';
import './BoxSettingsModal.css';
import ColorPicker from './ColorPicker';
import FontPicker from './FontPicker';
import { useVideoDevices } from './useVideoDevices';
import ROIModal from './ROIModal';
import BoxPreview from './BoxPreview';
import { createDefaultLayer } from './boxMigration';
import { resolveLayerRadius } from './layerUtils';

import { FaX } from "react-icons/fa6";
import { FaAlignLeft, FaAlignCenter, FaAlignRight } from "react-icons/fa6";
import { FaPlus, FaTrash, FaVideo, FaImage, FaPalette, FaFont, FaGripVertical, FaGear } from "react-icons/fa6";


type BoxSettingsModalProps = {
    boxData: BoxData;
    onSave: (boxData: BoxData) => void;
    onCancel: () => void;
    onDelete: (boxId: string) => void;
    onDuplicate: (boxData: BoxData) => void;
    connections?: CompanionConnection[];
    pages?: PageData[];
    variableValues?: { [key: string]: string };
    variableHtmlValues?: { [key: string]: string };
};

// ============================================================================
// Reusable editor components
// ============================================================================

const VariableColorEditor = ({ title, colors, onColorsChange }: {
    title: string;
    colors: VariableColor[] | undefined;
    onColorsChange: (colors: VariableColor[]) => void;
}) => {
    const list = colors || [];

    const update = (id: string, property: keyof VariableColor, value: string) => {
        onColorsChange(list.map(vc => vc.id === id ? { ...vc, [property]: value } : vc));
    };
    const remove = (id: string) => {
        onColorsChange(list.filter(vc => vc.id !== id));
    };
    const add = () => {
        onColorsChange([...list, { id: uuid(), variable: '', operator: '==', value: '', color: '#ffffff' }]);
    };

    return (
        <div className="setting-row variable-color-row">
            <div className="setting-label">
                <span className="setting-header">{title}</span>
                <div className="variable-color-section">
                    {list.map(vc => (
                        <div key={vc.id} className="variable-color-row">
                            <input
                                type="text"
                                value={vc.variable}
                                onChange={(e) => update(vc.id, 'variable', e.target.value)}
                                placeholder="Variable"
                                className="variable-input"
                            />
                            <select
                                value={vc.operator}
                                onChange={(e) => update(vc.id, 'operator', e.target.value as ComparisonOperator)}
                                className="operator-select"
                            >
                                <option value="==">=</option>
                                <option value="!=">≠</option>
                                <option value="<">&lt;</option>
                                <option value="<=">&lt;=</option>
                                <option value=">">&gt;</option>
                                <option value=">=">&gt;=</option>
                            </select>
                            <input
                                type="text"
                                value={vc.value}
                                onChange={(e) => update(vc.id, 'value', e.target.value)}
                                placeholder="Value"
                                className="value-input"
                            />
                            <ColorPicker
                                value={vc.color}
                                onChange={(color) => update(vc.id, 'color', color)}
                                className="color-picker"
                            />
                            <button
                                type="button"
                                className="remove-variable-color-button"
                                onClick={() => remove(vc.id)}
                            >
                                <FaX style={{ fontSize: '16px' }} />
                            </button>
                        </div>
                    ))}
                </div>
                <button
                    type="button"
                    className="add-variable-color-button"
                    onClick={add}
                >
                    ADD
                </button>
            </div>
        </div>
    );
};

// Shared per-corner radius editor for color/image/video layers.
const CornerRadiusEditor = ({
    radius,
    boxRadius,
    onRadiusChange,
}: {
    radius: LayerRadius | undefined;
    boxRadius: number;
    onRadiusChange: (radius: LayerRadius) => void;
}) => {
    const resolved = resolveLayerRadius(radius, boxRadius);

    const labels: { [key in keyof LayerRadius]: string } = {
        topLeft: 'Top Left',
        topRight: 'Top Right',
        bottomLeft: 'Bottom Left',
        bottomRight: 'Bottom Right',
    };

    return (
        <div className="setting-row">
            {(['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const).map(corner => (
                <div key={corner} className="mask-side-input">
                    <span className="setting-header">{labels[corner]}</span>
                    <input
                        type="number"
                        min={0}
                        max={500}
                        value={resolved[corner]}
                        onChange={(e) => onRadiusChange({
                            ...resolved,
                            [corner]: Math.max(0, Number(e.target.value) || 0),
                        })}
                        className="content-text-input"
                    />
                </div>
            ))}
        </div>
    );
};

// Shared X/Y offset editor for all layer types.
const LayerPositionEditor = ({
    offsetX,
    offsetY,
    onOffsetChange,
}: {
    offsetX: number | undefined;
    offsetY: number | undefined;
    onOffsetChange: (offset: { offsetX: number; offsetY: number }) => void;
}) => (
    <div className="setting-row">
        <div className="mask-side-input">
            <span className="setting-header">X Offset</span>
            <input
                type="number"
                min={-1000}
                max={1000}
                value={offsetX ?? 0}
                onChange={(e) => onOffsetChange({ offsetX: Number(e.target.value) || 0, offsetY: offsetY ?? 0 })}
                className="content-text-input"
            />
        </div>
        <div className="mask-side-input">
            <span className="setting-header">Y Offset</span>
            <input
                type="number"
                min={-1000}
                max={1000}
                value={offsetY ?? 0}
                onChange={(e) => onOffsetChange({ offsetX: offsetX ?? 0, offsetY: Number(e.target.value) || 0 })}
                className="content-text-input"
            />
        </div>
    </div>
);

const ANIMATION_OPTIONS: { value: AnimationType; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'fade', label: 'Fade' },
    { value: 'grow', label: 'Grow' },
    { value: 'slide', label: 'Slide (top)' },
    { value: 'slide-bottom', label: 'Slide (bottom)' },
    { value: 'slide-left', label: 'Slide (left)' },
    { value: 'slide-right', label: 'Slide (right)' },
];

// Per-layer animation override. Mirrors the font picker: "Global" clears the
// override (undefined) so the layer follows the dashboard-wide animation setting.
const AnimationOverrideSelect = ({
    label,
    value,
    onChange,
    options = ANIMATION_OPTIONS,
}: {
    label: string;
    value: AnimationType | undefined;
    onChange: (value: AnimationType | undefined) => void;
    options?: { value: AnimationType; label: string }[];
}) => (
    <div className="setting-row">
        <div className="setting-label">
            <span className="setting-header">{label}</span>
            <select
                value={value ?? 'global'}
                onChange={(e) => {
                    const v = e.target.value;
                    onChange(v === 'global' ? undefined : (v as AnimationType));
                }}
                style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#1a1a1a',
                    color: 'white',
                    border: '1px solid #61BAFA',
                    borderRadius: '4px',
                    fontSize: '14px'
                }}
            >
                <option value="global">Global</option>
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>
    </div>
);

const VariableSizeEditor = ({ sizes, onSizesChange }: {
    sizes: VariableOverlaySize[] | undefined;
    onSizesChange: (sizes: VariableOverlaySize[]) => void;
}) => {
    const list = sizes || [];

    const update = (id: string, property: keyof VariableOverlaySize, value: string | number) => {
        onSizesChange(list.map(vs => vs.id === id ? { ...vs, [property]: value } : vs));
    };
    const remove = (id: string) => {
        onSizesChange(list.filter(vs => vs.id !== id));
    };
    const add = () => {
        onSizesChange([...list, { id: uuid(), variable: '', operator: '==', value: '', size: 100 }]);
    };

    return (
        <div className="setting-row variable-opacity-row">
            <div className="setting-label">
                <span className="setting-header">Variable Size (%)</span>
                <div className="variable-color-section">
                    {list.map(vs => (
                        <div key={vs.id} className="variable-color-row">
                            <input
                                type="text"
                                className="variable-input"
                                value={vs.variable}
                                onChange={(e) => update(vs.id, 'variable', e.target.value)}
                                placeholder="Variable"
                            />
                            <select
                                value={vs.operator}
                                onChange={(e) => update(vs.id, 'operator', e.target.value as ComparisonOperator)}
                                className="operator-select"
                            >
                                <option value="==">=</option>
                                <option value="!=">≠</option>
                                <option value="<">&lt;</option>
                                <option value="<=">&lt;=</option>
                                <option value=">">&gt;</option>
                                <option value=">=">&gt;=</option>
                            </select>
                            <input
                                type="text"
                                className="value-input"
                                value={vs.value}
                                onChange={(e) => update(vs.id, 'value', e.target.value)}
                                placeholder="Value"
                            />
                            <input
                                type="number"
                                className="opacity-value-input"
                                value={vs.size}
                                onChange={(e) => update(vs.id, 'size', parseInt(e.target.value) || 0)}
                                min="0"
                                max="100"
                            />
                            <button
                                type="button"
                                onClick={() => remove(vs.id)}
                                className="remove-variable-color-button"
                            >
                                <FaX style={{ fontSize: '16px' }} />
                            </button>
                        </div>
                    ))}
                </div>
                <button
                    type="button"
                    className="add-variable-color-button"
                    onClick={add}
                >
                    ADD
                </button>
            </div>
        </div>
    );
};

// Overlay editor (used by image and video layers)
const OverlayEditor = ({ overlay, onOverlayChange }: {
    overlay: LayerOverlay;
    onOverlayChange: (patch: Partial<LayerOverlay>) => void;
}) => (
    <>
        <div className='setting-container'>
            <h3 className="section-heading">Layer Overlay</h3>
            <div className="setting-row default-color-row">
                <div className="setting-label">
                    <span className="setting-header">Default Overlay</span>
                    <div className="color-input-group">
                        <ColorPicker
                            value={overlay.color}
                            onChange={(color) => onOverlayChange({ color })}
                        />
                        <input
                            type="text"
                            value={overlay.colorText}
                            onChange={(e) => onOverlayChange({ colorText: e.target.value })}
                            placeholder="Variable or HEX"
                        />
                    </div>
                </div>
            </div>

            <VariableColorEditor
                title="Variable Overlay Color"
                colors={overlay.variableColors}
                onColorsChange={(variableColors) => onOverlayChange({ variableColors })}
            />

            <div className="setting-row default-opacity-row">
                <div className="setting-label">
                    <span className="setting-header">Default Size (%)</span>
                    <input
                        type="text"
                        value={overlay.sizeSource}
                        onChange={(e) => {
                            const value = e.target.value;
                            const parsed = parseInt(value);
                            if (!isNaN(parsed)) {
                                onOverlayChange({ sizeSource: value, size: Math.max(0, Math.min(100, parsed)) });
                            } else {
                                onOverlayChange({ sizeSource: value });
                            }
                        }}
                        placeholder="Number or Variable"
                    />
                </div>
            </div>

            <VariableSizeEditor
                sizes={overlay.sizeVariableValues}
                onSizesChange={(sizeVariableValues) => onOverlayChange({ sizeVariableValues })}
            />

            <div className="setting-row" style={{ flexBasis: '100%' }}>
                <div className="setting-label">
                    <span className="setting-header">Overlay Direction</span>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                        {(['left', 'right', 'top', 'bottom'] as const).map(dir => (
                            <button
                                key={dir}
                                type="button"
                                onClick={() => onOverlayChange({ direction: dir })}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: overlay.direction === dir ? '#61BAFA' : '#444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px'
                                }}
                            >
                                From {dir.charAt(0).toUpperCase() + dir.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    </>
);

const layerTypeIcon = (type: LayerType) => {
    switch (type) {
        case 'video': return <FaVideo />;
        case 'image': return <FaImage />;
        case 'text': return <FaFont />;
        case 'color': return <FaPalette />;
    }
};

const layerDisplayLabel = (layer: BoxLayer): string => {
    switch (layer.type) {
        case 'text': return layer.source || 'Text';
        case 'video': return 'Video';
        case 'image': return 'Image';
        case 'color': return 'Color';
    }
};

export default function BoxSettingsModal({ boxData, onSave, onCancel, onDelete, onDuplicate, connections = [], pages = [], variableValues, variableHtmlValues }: BoxSettingsModalProps) {
    // Helper: Convert internal position (top-left) to display position (based on anchor point)
    const getDisplayPosition = (internalPos: [number, number], width: number, height: number, anchor: BoxData['anchorPoint']): [number, number] => {
        const [x, y] = internalPos;
        switch (anchor) {
            case 'top-left':
                return [x, y];
            case 'top-right':
                return [x + width, y];
            case 'bottom-left':
                return [x, y + height];
            case 'bottom-right':
                return [x + width, y + height];
            case 'center':
                return [x + width / 2, y + height / 2];
            default:
                return [x, y];
        }
    };

    // Helper: Convert display position to internal position (top-left)
    const getInternalPosition = (displayPos: [number, number], width: number, height: number, anchor: BoxData['anchorPoint']): [number, number] => {
        const [x, y] = displayPos;
        switch (anchor) {
            case 'top-left':
                return [x, y];
            case 'top-right':
                return [x - width, y];
            case 'bottom-left':
                return [x, y - height];
            case 'bottom-right':
                return [x - width, y - height];
            case 'center':
                return [x - width / 2, y - height / 2];
            default:
                return [x, y];
        }
    };

    const [formData, setFormData] = useState(() => ({
        ...boxData,
        // Initialize opacitySource with opacity value if it's empty
        opacitySource: boxData.opacitySource || boxData.opacity.toString(),
        layers: (boxData.layers || []).map(layer => ({ ...layer }))
    }));
    const [activePane, setActivePane] = useState<'box' | string>('box');
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [showROIModal, setShowROIModal] = useState(false);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const [uploadingLayerId, setUploadingLayerId] = useState<string | null>(null);
    const { devices: videoDevices, refresh: refreshVideoDevices } = useVideoDevices();

    const selectedLayer = useMemo(
        () => (activePane === 'box') ? null : (formData.layers || []).find(l => l.id === activePane) || null,
        [formData.layers, activePane]
    );
    const selectedVideoLayer = (selectedLayer && selectedLayer.type === 'video') ? selectedLayer as VideoLayer : null;
    const selectedImageLayer = (selectedLayer && selectedLayer.type === 'image') ? selectedLayer as ImageLayer : null;
    const selectedTextLayer = (selectedLayer && selectedLayer.type === 'text') ? selectedLayer as TextLayer : null;
    const selectedColorLayer = (selectedLayer && selectedLayer.type === 'color') ? selectedLayer as ColorLayer : null;

    // Get display position for showing in inputs - reactive to formData changes
    const displayPosition = useMemo(() =>
        getDisplayPosition(
            formData.frame.translate,
            formData.frame.width,
            formData.frame.height,
            formData.anchorPoint
        ),
        [formData.frame.translate, formData.frame.width, formData.frame.height, formData.anchorPoint]
    );

    const handleSave = () => {
        onSave(formData);
    };

    const handleDelete = () => {
        onDelete(boxData.id);
    };

    const updateField = (field: keyof BoxData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleDuplicate = () => {
        onDuplicate(formData);
    };

    // ---- Layer operations -------------------------------------------------
    const updateLayerField = (layerId: string, patch: Partial<BoxLayer>) => {
        setFormData(prev => ({
            ...prev,
            layers: prev.layers.map(l => l.id === layerId ? ({ ...l, ...patch } as BoxLayer) : l)
        }));
    };

    const updateLayerOverlay = (layerId: string, patch: Partial<LayerOverlay>) => {
        setFormData(prev => ({
            ...prev,
            layers: prev.layers.map(l => l.id === layerId ? ({ ...l, overlay: { ...(l as any).overlay, ...patch } } as BoxLayer) : l)
        }));
    };

    const addLayer = (type: LayerType) => {
        const newLayer = createDefaultLayer(type);
        setFormData(prev => ({ ...prev, layers: [newLayer, ...prev.layers] }));
        setActivePane(newLayer.id);
    };

    const removeLayer = (layerId: string) => {
        setFormData(prev => ({ ...prev, layers: prev.layers.filter(l => l.id !== layerId) }));
        setActivePane(prev => prev === layerId ? 'box' : prev);
    };

    const moveLayer = (fromIndex: number, toIndex: number) => {
        setFormData(prev => {
            const layers = [...prev.layers];
            const [moved] = layers.splice(fromIndex, 1);
            layers.splice(toIndex, 0, moved);
            return { ...prev, layers };
        });
    };

    // ---- Variable opacity (box level) -------------------------------------
    const addVariableOpacity = () => {
        const variableOpacities = formData.opacityVariableValues || [];
        const newVariableOpacity: VariableOpacity = {
            id: uuid(),
            variable: '',
            operator: '==',
            value: '',
            opacity: 100
        };
        updateField('opacityVariableValues', [...variableOpacities, newVariableOpacity]);
    };

    const removeVariableOpacity = (id: string) => {
        const variableOpacities = formData.opacityVariableValues || [];
        updateField('opacityVariableValues', variableOpacities.filter(vo => vo.id !== id));
    };

    const updateVariableOpacity = (id: string, property: keyof VariableOpacity, value: string | number) => {
        const variableOpacities = formData.opacityVariableValues || [];
        const updated = variableOpacities.map(vo =>
            vo.id === id ? { ...vo, [property]: value } : vo
        );
        updateField('opacityVariableValues', updated);
    };

    // ---- Image upload (per image layer) -----------------------------------
    const compressImage = (file: File, maxWidth: number = 1920, maxHeight: number = 1080, quality: number = 0.9): Promise<string> => {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
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

                ctx?.drawImage(img, 0, 0, width, height);

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

    const handleImageBrowse = (layerId: string) => {
        setUploadingLayerId(layerId);
        imageInputRef.current?.click();
    };

    const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !uploadingLayerId) return;

        if (!file.type || typeof file.type !== 'string' || !file.type.startsWith('image/')) {
            alert('Please select an image file.');
            return;
        }

        try {
            const base64DataUrl = await compressImage(file);

            const timestamp = Date.now();
            const cachedFilename = `box_bg_${formData.id}_${timestamp}.jpg`;

            // Clear old cached image for this layer if it exists
            const layer = formData.layers.find(l => l.id === uploadingLayerId);
            if (layer && layer.type === 'image' && layer.imageSrc && layer.imageSrc.startsWith('./src/assets/')) {
                const oldFilename = layer.imageSrc.split('/').pop();
                if (oldFilename) {
                    await deleteImageFromDB(oldFilename);
                }
            }

            updateLayerField(uploadingLayerId, { imageSrc: `./src/assets/${cachedFilename}` });

            try {
                await storeImageInDB(cachedFilename, base64DataUrl);
            } catch (dbError) {
                console.error('IndexedDB storage failed:', dbError);
                throw new Error('Failed to store image.');
            }
        } catch (error) {
            console.error('Failed to set image:', error);
            alert('Failed to set image.');
        }

        setUploadingLayerId(null);
        event.target.value = '';
    };

    const clearImage = async (layer: ImageLayer) => {
        if (layer.imageSrc && layer.imageSrc.startsWith('./src/assets/')) {
            const filename = layer.imageSrc.split('/').pop();
            if (filename) {
                await deleteImageFromDB(filename);
            }
        }
        updateLayerField(layer.id, { imageSrc: '' });
    };

    // ========================================================================
    // Box Settings (position/size, opacity, click action, border)
    // ========================================================================
    const renderFullSettings = () => (
        <div className="settings-section">
            <div className="setting-title">Box Settings</div>
            <div className="setting-group">
                <div className='setting-container box-settings-container'>
                    <h3 className="section-heading">Position & Size</h3>
                    {pages.length > 1 && (
                        <div className='box-settings-row'>
                            <div className="setting-label box-settings-item">
                                <span className="setting-header">Page</span>
                                <select
                                    value={formData.pageId}
                                    onChange={(e) => updateField('pageId', e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        backgroundColor: '#1a1a1a',
                                        color: 'white',
                                        border: '1px solid #61BAFA',
                                        borderRadius: '4px',
                                        fontSize: '14px'
                                    }}
                                >
                                    {[...pages].sort((a, b) => a.order - b.order).map(page => (
                                        <option key={page.id} value={page.id}>{page.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                    <div className='box-settings-row'>
                        <div className="setting-label box-settings-item">
                            <span className="setting-header">X-Position</span>
                            <input
                                type="number"
                                value={displayPosition[0]}
                                onChange={(e) => {
                                    const newDisplayX = parseInt(e.target.value) || 0;
                                    const newDisplayPos: [number, number] = [newDisplayX, displayPosition[1]];
                                    const newInternalPos = getInternalPosition(
                                        newDisplayPos,
                                        formData.frame.width,
                                        formData.frame.height,
                                        formData.anchorPoint
                                    );
                                    updateField('frame', {
                                        ...formData.frame,
                                        translate: newInternalPos
                                    });
                                }}
                            />
                        </div>
                        <div className="setting-label box-settings-item">
                            <span className="setting-header">Y-Position</span>
                            <input
                                type="number"
                                value={displayPosition[1]}
                                onChange={(e) => {
                                    const newDisplayY = parseInt(e.target.value) || 0;
                                    const newDisplayPos: [number, number] = [displayPosition[0], newDisplayY];
                                    const newInternalPos = getInternalPosition(
                                        newDisplayPos,
                                        formData.frame.width,
                                        formData.frame.height,
                                        formData.anchorPoint
                                    );
                                    updateField('frame', {
                                        ...formData.frame,
                                        translate: newInternalPos
                                    });
                                }}
                            />
                        </div>
                        <div className="setting-label box-settings-item">
                            <span className="setting-header">Anchor Point</span>
                            <select
                                value={formData.anchorPoint}
                                onChange={(e) => updateField('anchorPoint', e.target.value as BoxData['anchorPoint'])}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    backgroundColor: '#1a1a1a',
                                    color: 'white',
                                    border: '1px solid #61BAFA',
                                    borderRadius: '4px',
                                    fontSize: '14px'
                                }}
                            >
                                <option value="top-left">Top Left</option>
                                <option value="top-right">Top Right</option>
                                <option value="bottom-left">Bottom Left</option>
                                <option value="bottom-right">Bottom Right</option>
                                <option value="center">Center</option>
                            </select>
                        </div>
                    </div>

                    <div className='box-settings-row'>
                        <div className="setting-label box-settings-item">
                            <span className="setting-header">Width</span>
                            <input
                                type="number"
                                value={formData.frame.width}
                                onChange={(e) => {
                                    const newWidth = parseInt(e.target.value) || 100;
                                    const newInternalPos = getInternalPosition(
                                        displayPosition,
                                        newWidth,
                                        formData.frame.height,
                                        formData.anchorPoint
                                    );
                                    updateField('frame', {
                                        ...formData.frame,
                                        width: newWidth,
                                        translate: newInternalPos
                                    });
                                }}
                                min="10"
                            />
                        </div>
                        <div className="setting-label box-settings-item">
                            <span className="setting-header">Height</span>
                            <input
                                type="number"
                                value={formData.frame.height}
                                onChange={(e) => {
                                    const newHeight = parseInt(e.target.value) || 100;
                                    const newInternalPos = getInternalPosition(
                                        displayPosition,
                                        formData.frame.width,
                                        newHeight,
                                        formData.anchorPoint
                                    );
                                    updateField('frame', {
                                        ...formData.frame,
                                        height: newHeight,
                                        translate: newInternalPos
                                    });
                                }}
                                min="10"
                            />
                        </div>
                        <div className="setting-label box-settings-item">
                            <span className="setting-header">Layer</span>
                            <input
                                type="number"
                                value={formData.zIndex}
                                onChange={(e) => updateField('zIndex', parseInt(e.target.value) || 1)}
                                min="1"
                            />
                        </div>
                    </div>
                </div>

                <div className='setting-container'>
                    <h3 className="section-heading">Opacity</h3>
                    <div className="setting-row default-opacity-row">
                        <div className="setting-label">
                            <span className="setting-header">Default Opacity (%)</span>
                            <input
                                type="text"
                                value={formData.opacitySource}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    const parsed = parseInt(value);
                                    if (!isNaN(parsed)) {
                                        setFormData(prev => ({
                                            ...prev,
                                            opacitySource: value,
                                            opacity: Math.max(0, Math.min(100, parsed))
                                        }));
                                    } else {
                                        setFormData(prev => ({
                                            ...prev,
                                            opacitySource: value
                                        }));
                                    }
                                }}
                                placeholder="Number or Variable"
                            />
                        </div>
                    </div>

                    <div className="setting-row variable-opacity-row">
                        <div className="setting-label">
                            <span className="setting-header">Variable Opacity</span>
                            <div className="variable-color-section">
                                {(formData.opacityVariableValues || []).map(vo => (
                                    <div key={vo.id} className="variable-color-row">
                                        <input
                                            type="text"
                                            value={vo.variable}
                                            onChange={(e) => updateVariableOpacity(vo.id, 'variable', e.target.value)}
                                            placeholder="Variable"
                                            className="variable-input"
                                        />
                                        <select
                                            value={vo.operator}
                                            onChange={(e) => updateVariableOpacity(vo.id, 'operator', e.target.value as ComparisonOperator)}
                                            className="operator-select"
                                        >
                                            <option value="==">=</option>
                                            <option value="!=">≠</option>
                                            <option value="<">&lt;</option>
                                            <option value="<=">&lt;=</option>
                                            <option value=">">&gt;</option>
                                            <option value=">=">&gt;=</option>
                                        </select>
                                        <input
                                            type="text"
                                            value={vo.value}
                                            onChange={(e) => updateVariableOpacity(vo.id, 'value', e.target.value)}
                                            placeholder="Value"
                                            className="value-input"
                                        />
                                        <input
                                            type="number"
                                            value={vo.opacity}
                                            onChange={(e) => {
                                                const parsed = parseInt(e.target.value);
                                                updateVariableOpacity(vo.id, 'opacity', isNaN(parsed) ? 100 : Math.max(0, Math.min(100, parsed)));
                                            }}
                                            placeholder="Opacity %"
                                            min="0"
                                            max="100"
                                            className="opacity-value-input"
                                        />
                                        <button
                                            type="button"
                                            className="remove-variable-color-button"
                                            onClick={() => removeVariableOpacity(vo.id)}
                                        >
                                            <FaX style={{ fontSize: '16px' }} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                className="add-variable-color-button"
                                onClick={addVariableOpacity}
                            >
                                ADD
                            </button>
                        </div>
                    </div>
                </div>

                <div className='setting-container'>
                    <h3 className="section-heading">
                        Border
                        <label className="nav-toggle setting-title-toggle">
                            <input type="checkbox" checked={!formData.noBorder} onChange={e => updateField('noBorder', !e.target.checked)} />
                            <span className="nav-toggle-track" />
                        </label>
                    </h3>
                    <div className="setting-row default-color-row">
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
                            <div style={{ marginTop: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span className="setting-header">Border Radius (px)</span>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={formData.borderRadius ?? 15}
                                    onChange={(e) => updateField('borderRadius', parseInt(e.target.value) || 0)}
                                    style={{ width: '80px' }}
                                />
                            </div>
                        </div>
                    </div>

                    <VariableColorEditor
                        title="Variable Border Color"
                        colors={formData.borderVariableColors}
                        onColorsChange={(borderVariableColors) => updateField('borderVariableColors', borderVariableColors)}
                    />
                </div>

                <div className='setting-container'>
                    <h3 className="section-heading">Click Action</h3>
                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Companion Button Location</span>
                            <input
                                type="text"
                                value={formData.companionButtonLocation || ''}
                                onChange={(e) => updateField('companionButtonLocation', e.target.value)}
                                placeholder="page/row/column"
                                className="full-width-input"
                            />
                        </div>
                    </div>
                    {connections.length > 0 && (
                        <div className="setting-row">
                            <div className="setting-label">
                                <span className="setting-header">Connection</span>
                                <select
                                    value={formData.companionButtonConnectionId || ''}
                                    onChange={(e) => updateField('companionButtonConnectionId', e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        backgroundColor: '#1a1a1a',
                                        color: 'white',
                                        border: '1px solid #61BAFA',
                                        borderRadius: '4px',
                                        fontSize: '14px'
                                    }}
                                >
                                    <option value="">Default Connection</option>
                                    {connections.map((conn) => (
                                        <option key={conn.id} value={conn.id}>
                                            {conn.label || conn.url}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    // ========================================================================
    // Layer editors
    // ========================================================================
    const renderLayerHeader = (layer: BoxLayer) => (
        <div className="layer-editor-header">
            <span className="layer-editor-title">{layerTypeIcon(layer.type)} {layerDisplayLabel(layer)}</span>
        </div>
    );

    const renderColorEditor = (layer: ColorLayer) => (
        <>
            {renderLayerHeader(layer)}
            <div className='setting-container'>
                <h3 className="section-heading">Color</h3>
                <div className="setting-row default-color-row">
                    <div className="setting-label">
                        <span className="setting-header">Default Color</span>
                        <div className="color-input-group">
                            <ColorPicker
                                value={layer.color}
                                onChange={(color) => updateLayerField(layer.id, { color })}
                            />
                            <input
                                type="text"
                                value={layer.colorText}
                                onChange={(e) => updateLayerField(layer.id, { colorText: e.target.value })}
                                placeholder="Variable or HEX"
                            />
                        </div>
                    </div>
                </div>
                <VariableColorEditor
                    title="Variable Color"
                    colors={layer.variableColors}
                    onColorsChange={(variableColors) => updateLayerField(layer.id, { variableColors })}
                />
            </div>
            <div className='setting-container'>
                <h3 className="section-heading">Mask</h3>
                <div className="setting-row">
                    {(['top', 'bottom', 'left', 'right'] as const).map(side => (
                        <div key={side} className="mask-side-input">
                            <span className="setting-header">{side}</span>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={layer.mask?.[side] ?? 0}
                                onChange={(e) => updateLayerField(layer.id, {
                                    mask: {
                                        ...(layer.mask || { top: 0, bottom: 0, left: 0, right: 0 }),
                                        [side]: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                                    }
                                })}
                                className="content-text-input"
                            />
                        </div>
                    ))}
                </div>
                <div className="setting-hint">0 = fully visible, 100 = fully masked.</div>
            </div>
            <div className='setting-container'>
                <h3 className="section-heading">Corner Radius</h3>
                <CornerRadiusEditor
                    radius={layer.radius}
                    boxRadius={formData.borderRadius ?? 15}
                    onRadiusChange={(radius) => updateLayerField(layer.id, { radius })}
                />
                <div className="setting-hint">Box radius applies at the box border; these values add independent rounding.</div>
            </div>
            <div className='setting-container'>
                <h3 className="section-heading">Position</h3>
                <LayerPositionEditor
                    offsetX={layer.offsetX}
                    offsetY={layer.offsetY}
                    onOffsetChange={(offset) => updateLayerField(layer.id, offset)}
                />
                <div className="setting-hint">Positive X moves right, positive Y moves down.</div>
            </div>
            <div className='setting-container'>
                <h3 className="section-heading">Color Animation</h3>
                <AnimationOverrideSelect
                    label="Animation"
                    value={layer.colorAnimation}
                    onChange={(value) => updateLayerField(layer.id, { colorAnimation: value as 'none' | 'fade' | undefined })}
                    options={[
                        { value: 'none' as AnimationType, label: 'None' },
                        { value: 'fade' as AnimationType, label: 'Fade' },
                    ]}
                />
                <div className="setting-hint">Global follows the dashboard-wide Color Animation setting.</div>
            </div>
        </>
    );

    const renderImageEditor = (layer: ImageLayer) => (
        <>
            {renderLayerHeader(layer)}
            <div className='setting-container'>
                <h3 className="section-heading">Image</h3>
                <div className="setting-row">
                    <div className="setting-label">
                        <span className="setting-header">Image Source</span>
                        <input
                            type="text"
                            value={layer.imageSrc}
                            onChange={(e) => updateLayerField(layer.id, { imageSrc: e.target.value })}
                            placeholder="URL, Variable, or Browse"
                            className="full-width-input"
                        />
                        <div className="image-controls">
                            <button
                                type="button"
                                className="browse-image-button"
                                onClick={() => handleImageBrowse(layer.id)}
                            >
                                Browse Image
                            </button>
                            {layer.imageSrc && (
                                <button
                                    type="button"
                                    className="clear-image-button"
                                    onClick={() => clearImage(layer)}
                                >
                                    Clear Image
                                </button>
                            )}
                        </div>
                        <div className="opacity-controls">
                            <label htmlFor={`image-size-${layer.id}`}>Image Size</label>
                            <select
                                id={`image-size-${layer.id}`}
                                value={layer.imageSize || 'cover'}
                                onChange={(e) => updateLayerField(layer.id, { imageSize: e.target.value as 'cover' | 'contain' })}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    backgroundColor: '#1a1a1a',
                                    color: 'white',
                                    border: '1px solid #61BAFA',
                                    borderRadius: '4px',
                                    fontSize: '14px'
                                }}
                            >
                                <option value="cover">Cover</option>
                                <option value="contain">Contain</option>
                            </select>
                        </div>
                        <div className="opacity-controls">
                            <label htmlFor={`image-opacity-${layer.id}`}>Image Opacity (%)</label>
                            <input
                                id={`image-opacity-${layer.id}`}
                                type="number"
                                min="0"
                                max="100"
                                value={layer.imageOpacity ?? 100}
                                onChange={(e) => updateLayerField(layer.id, { imageOpacity: parseInt(e.target.value) || 100 })}
                                style={{ width: '100%' }}
                                className="opacity-input"
                            />
                        </div>
                    </div>
                </div>
            </div>
            <div className='setting-container'>
                <h3 className="section-heading">Corner Radius</h3>
                <CornerRadiusEditor
                    radius={layer.radius}
                    boxRadius={formData.borderRadius ?? 15}
                    onRadiusChange={(radius) => updateLayerField(layer.id, { radius })}
                />
                <div className="setting-hint">Box radius applies at the box border; these values add independent rounding.</div>
            </div>
            <div className='setting-container'>
                <h3 className="section-heading">Position</h3>
                <LayerPositionEditor
                    offsetX={layer.offsetX}
                    offsetY={layer.offsetY}
                    onOffsetChange={(offset) => updateLayerField(layer.id, offset)}
                />
                <div className="setting-hint">Positive X moves right, positive Y moves down.</div>
            </div>
            <div className='setting-container'>
                <h3 className="section-heading">Image Animation</h3>
                <AnimationOverrideSelect
                    label="Animation"
                    value={layer.backgroundImageAnimation}
                    onChange={(value) => updateLayerField(layer.id, { backgroundImageAnimation: value })}
                />
                <div className="setting-hint">Global follows the dashboard-wide Background Image Animation setting.</div>
            </div>
            <OverlayEditor
                overlay={layer.overlay}
                onOverlayChange={(patch) => updateLayerOverlay(layer.id, patch)}
            />
        </>
    );

    const renderVideoEditor = (layer: VideoLayer) => (
        <>
            {renderLayerHeader(layer)}
            {videoDevices.length > 0 && (
                <div className='setting-container'>
                    <h3 className="section-heading">Video</h3>
                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Video Input</span>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
                                <select
                                    value={layer.deviceId || ''}
                                    onChange={(e) => {
                                        const newDeviceId = e.target.value || undefined;
                                        updateLayerField(layer.id, {
                                            deviceId: newDeviceId,
                                            ...(newDeviceId !== layer.deviceId ? { roi: undefined } : {})
                                        });
                                    }}
                                    style={{
                                        width: '50%',
                                        padding: '8px',
                                        backgroundColor: '#1a1a1a',
                                        color: 'white',
                                        border: '1px solid #61BAFA',
                                        borderRadius: '4px',
                                        fontSize: '14px'
                                    }}
                                >
                                    <option value="">No Video</option>
                                    {videoDevices.map(device => (
                                        <option key={device.deviceId} value={device.deviceId}>
                                            {device.label}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => {
                                        refreshVideoDevices();
                                        if (layer.deviceId) {
                                            const currentId = layer.deviceId;
                                            updateLayerField(layer.id, { deviceId: undefined });
                                            setTimeout(() => {
                                                updateLayerField(layer.id, { deviceId: currentId as any });
                                            }, 100);
                                        }
                                    }}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: '#444',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        textTransform: 'uppercase',
                                        letterSpacing: '1px',
                                        whiteSpace: 'nowrap',
                                        height: '39px'
                                    }}
                                >
                                    Refresh
                                </button>
                            </div>
                            {layer.deviceId && (
                                <>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'flex-end' }}>
                                        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <span className="setting-header">Video Region of Interest</span>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowROIModal(true)}
                                                    style={{
                                                        flex: 1,
                                                        padding: '8px 16px',
                                                        backgroundColor: layer.roi ? '#61BAFA' : '#444',
                                                        color: 'white',
                                                        border: layer.roi ? '2px solid #4da3e0' : 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '1px'
                                                    }}
                                                >
                                                    {layer.roi ? '✓ SET REGION OF INTEREST' : 'SET REGION OF INTEREST'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => updateLayerField(layer.id, { roi: undefined })}
                                                    style={{
                                                        flex: 1,
                                                        padding: '8px 16px',
                                                        backgroundColor: '#333',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '1px',
                                                        opacity: layer.roi ? 1 : 0.5,
                                                        pointerEvents: layer.roi ? 'auto' : 'none'
                                                    }}
                                                >
                                                    CLEAR REGION OF INTEREST
                                                </button>
                                            </div>
                                        </div>
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            <span className="setting-header">Video Size</span>
                                            <select
                                                id={`video-size-${layer.id}`}
                                                value={layer.videoSize || 'cover'}
                                                onChange={(e) => updateLayerField(layer.id, { videoSize: e.target.value as 'cover' | 'contain' })}
                                                style={{
                                                    padding: '8px 16px',
                                                    backgroundColor: '#1a1a1a',
                                                    color: 'white',
                                                    border: '1px solid #61BAFA',
                                                    borderRadius: '4px',
                                                    fontSize: '14px'
                                                }}
                                            >
                                                <option value="cover">Cover</option>
                                                <option value="contain">Contain</option>
                                            </select>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <div className='setting-container'>
                <h3 className="section-heading">Corner Radius</h3>
                <CornerRadiusEditor
                    radius={layer.radius}
                    boxRadius={formData.borderRadius ?? 15}
                    onRadiusChange={(radius) => updateLayerField(layer.id, { radius })}
                />
                <div className="setting-hint">Box radius applies at the box border; these values add independent rounding.</div>
            </div>
            <div className='setting-container'>
                <h3 className="section-heading">Position</h3>
                <LayerPositionEditor
                    offsetX={layer.offsetX}
                    offsetY={layer.offsetY}
                    onOffsetChange={(offset) => updateLayerField(layer.id, offset)}
                />
                <div className="setting-hint">Positive X moves right, positive Y moves down.</div>
            </div>
            <OverlayEditor
                overlay={layer.overlay}
                onOverlayChange={(patch) => updateLayerOverlay(layer.id, patch)}
            />
        </>
    );

    const renderTextEditor = (layer: TextLayer) => (
        <>
            {renderLayerHeader(layer)}
            <div className="setting-group">
                <div className="setting-row">
                    <div className="setting-label">
                        <span className="setting-header">Text</span>
                        <input
                            type="text"
                            value={layer.source}
                            onChange={(e) => updateLayerField(layer.id, { source: e.target.value })}
                            className="content-text-input"
                        />
                    </div>
                </div>
                <div className="setting-row">
                    <div className="setting-label">
                        <span className="setting-header">Font</span>
                        <FontPicker
                            value={layer.font || 'Use Global Font'}
                            onChange={(font) => updateLayerField(layer.id, { font: font === 'Use Global Font' ? '' : font })}
                            className="setting-font-picker"
                        />
                    </div>
                </div>
                <div className='setting-container'>
                    <h3 className="section-heading">Font Size & Alignment</h3>
                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Font Size</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={layer.size}
                                onChange={(e) => {
                                    const raw = e.target.value;
                                    if (raw === '' || /^\d*$/.test(raw)) {
                                        const parsed = parseInt(raw, 10);
                                        updateLayerField(layer.id, { size: isNaN(parsed) ? 0 : parsed });
                                    }
                                }}
                            />
                        </div>
                    </div>
                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Horizontal Alignment</span>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                {(['left', 'center', 'right'] as const).map(align => {
                                    const Icon = align === 'left' ? FaAlignLeft : align === 'center' ? FaAlignCenter : FaAlignRight;
                                    return (
                                        <button
                                            key={align}
                                            type="button"
                                            onClick={() => updateLayerField(layer.id, { align })}
                                            style={{
                                                padding: '8px 12px',
                                                backgroundColor: (layer.align || 'center') === align ? '#61BAFA' : '#333',
                                                border: 'none',
                                                borderRadius: '4px',
                                                color: 'white',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            <Icon />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <div className="setting-row">
                        <div className="setting-label">
                            <span className="setting-header">Vertical Alignment</span>
                            <div style={{ display: 'flex', gap: '5px' }}>
                                {(['top', 'middle', 'bottom'] as const).map(alignVertical => (
                                    <button
                                        key={alignVertical}
                                        type="button"
                                        onClick={() => updateLayerField(layer.id, { alignVertical })}
                                        style={{
                                            padding: '8px 12px',
                                            backgroundColor: (layer.alignVertical || 'middle') === alignVertical ? '#61BAFA' : '#333',
                                            border: 'none',
                                            borderRadius: '4px',
                                            color: 'white',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            textTransform: 'uppercase',
                                            letterSpacing: '1px'
                                        }}
                                    >
                                        {alignVertical === 'top' ? 'Top' : alignVertical === 'middle' ? 'Middle' : 'Bottom'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className='setting-container'>
                    <h3 className="section-heading">Text Color</h3>
                    <div className="setting-row default-color-row">
                        <div className="setting-label">
                            <span className="setting-header">Default Text Color</span>
                            <div className="color-input-group">
                                <ColorPicker
                                    value={layer.color}
                                    onChange={(color) => updateLayerField(layer.id, { color })}
                                />
                                <input
                                    type="text"
                                    value={layer.colorText}
                                    onChange={(e) => updateLayerField(layer.id, { colorText: e.target.value })}
                                    placeholder="Variable or HEX"
                                />
                            </div>
                        </div>
                    </div>

                    <VariableColorEditor
                        title="Variable Text Color"
                        colors={layer.variableColors}
                        onColorsChange={(variableColors) => updateLayerField(layer.id, { variableColors })}
                    />
                </div>
                <div className='setting-container'>
                    <h3 className="section-heading">Text Animation</h3>
                    <AnimationOverrideSelect
                        label="Animation"
                        value={layer.textAnimation}
                        onChange={(value) => updateLayerField(layer.id, { textAnimation: value })}
                    />
                    <div className="setting-hint">Global follows the dashboard-wide Text Animation setting.</div>
                </div>
                <div className='setting-container'>
                    <h3 className="section-heading">Position</h3>
                    <LayerPositionEditor
                        offsetX={layer.offsetX}
                        offsetY={layer.offsetY}
                        onOffsetChange={(offset) => updateLayerField(layer.id, offset)}
                    />
                    <div className="setting-hint">Positive X moves right, positive Y moves down.</div>
                </div>
            </div>
        </>
    );

    const renderLayerEditor = () => {
        if (!selectedLayer) {
            return (
                <div className="layer-editor-empty">
                    <p>Select a layer to edit, or add one with the + button.</p>
                </div>
            );
        }
        switch (selectedLayer.type) {
            case 'color':
                return renderColorEditor(selectedColorLayer as ColorLayer);
            case 'image':
                return renderImageEditor(selectedImageLayer as ImageLayer);
            case 'video':
                return renderVideoEditor(selectedVideoLayer as VideoLayer);
            case 'text':
                return renderTextEditor(selectedTextLayer as TextLayer);
        }
    };

    const renderSidebar = () => (
        <div className="modal-nav">
            <div
                className={`nav-item${activePane === 'box' ? ' active' : ''}`}
                onClick={() => setActivePane('box')}
            >
                <FaGear className="nav-icon" />
                <span className="nav-label">Box Settings</span>
            </div>

            <div className="nav-layers-list">
                {(formData.layers || []).map((layer, index) => (
                    <div
                        key={layer.id}
                        draggable
                        onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', String(index));
                            e.dataTransfer.effectAllowed = 'move';
                            setDragIndex(index);
                        }}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            setDragOverIndex(index);
                        }}
                        onDrop={(e) => {
                            e.preventDefault();
                            if (dragIndex !== null && dragIndex !== index) {
                                moveLayer(dragIndex, index);
                            }
                            setDragIndex(null);
                            setDragOverIndex(null);
                        }}
                        onDragEnd={() => {
                            setDragIndex(null);
                            setDragOverIndex(null);
                        }}
                        className={`nav-layer-item${activePane === layer.id ? ' active' : ''}${dragOverIndex === index ? ' drag-over' : ''}`}
                        onClick={() => setActivePane(layer.id)}
                    >
                        <span className="layer-drag-handle"><FaGripVertical /></span>
                        <span className="layer-type-icon">{layerTypeIcon(layer.type)}</span>
                        <span className="layer-label">{layerDisplayLabel(layer)}</span>
                        <button
                            type="button"
                            className="layer-delete-button"
                            onClick={(e) => {
                                e.stopPropagation();
                                removeLayer(layer.id);
                            }}
                            title="Delete Layer"
                        >
                            <FaTrash />
                        </button>
                    </div>
                ))}
                {(!formData.layers || formData.layers.length === 0) && (
                    <div className="layer-list-empty">No layers yet</div>
                )}
            </div>

            <div className="layers-add-area">
                {showAddMenu && (
                    <div className="add-layer-menu">
                        <button type="button" onClick={() => { addLayer('video'); setShowAddMenu(false); }}>
                            <FaVideo /> Video
                        </button>
                        <button type="button" onClick={() => { addLayer('color'); setShowAddMenu(false); }}>
                            <FaPalette /> Color
                        </button>
                        <button type="button" onClick={() => { addLayer('image'); setShowAddMenu(false); }}>
                            <FaImage /> Image
                        </button>
                        <button type="button" onClick={() => { addLayer('text'); setShowAddMenu(false); }}>
                            <FaFont /> Text
                        </button>
                    </div>
                )}
                <button
                    type="button"
                    className="add-layer-button"
                    onClick={() => setShowAddMenu(v => !v)}
                    title="Add Layer"
                >
                    <FaPlus />
                </button>
            </div>
        </div>
    );

    const renderActivePane = () => {
        if (activePane !== 'box' && selectedLayer) {
            return (
                <div className="settings-section">
                    {renderLayerEditor()}
                </div>
            );
        }
        return renderFullSettings();
    };

    return createPortal(
        <div className="modal-overlay" onClick={onCancel}>
            <div
                style={{ width: '40vw', flexShrink: 0 }}
                onClick={(e) => e.stopPropagation()}
            >
                <BoxPreview boxData={formData} variableValues={variableValues} variableHtmlValues={variableHtmlValues} />
            </div>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-buttons">
                        <button onClick={handleSave} className="modal-save-button">SAVE</button>
                        <button onClick={onCancel} className="modal-cancel-button">CANCEL</button>
                        <button onClick={handleDuplicate} className="modal-duplicate-button">DUPLICATE</button>
                        <button onClick={handleDelete} className="modal-delete-button">DELETE</button>
                    </div>
                </div>

                <div className="modal-body">
                    <select
                        className="modal-nav-dropdown"
                        value={activePane}
                        onChange={(e) => setActivePane(e.target.value)}
                    >
                        <option value="box">Box Settings</option>
                        {(formData.layers || []).map(layer => (
                            <option key={layer.id} value={layer.id}>{layerDisplayLabel(layer)}</option>
                        ))}
                    </select>

                    {renderSidebar()}

                    <div className="modal-content-area">
                        {renderActivePane()}
                    </div>
                </div>
            </div>

            {/* ROI Modal */}
            {showROIModal && selectedVideoLayer && selectedVideoLayer.deviceId && (
                <ROIModal
                    deviceId={selectedVideoLayer.deviceId}
                    initialROI={selectedVideoLayer.roi}
                    onSave={(roi: ROI) => {
                        updateLayerField(selectedVideoLayer.id, { roi });
                        setShowROIModal(false);
                    }}
                    onCancel={() => setShowROIModal(false)}
                />
            )}

            {/* Hidden file input for image uploads */}
            <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }}
            />
        </div>,
        document.body
    );
}