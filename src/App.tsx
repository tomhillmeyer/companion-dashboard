import { useState, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import Box from './Box.tsx';
import SettingsMenu from './SettingsMenu.tsx';
import './App.css';
import defaultBoxes from './defaultBoxes.json';
import dashboardLogo from './assets/dashboard.png';
import { useVariableFetcher } from './useVariableFetcher';
import { TitleBar } from './TitleBar.tsx';


const STORAGE_KEY = 'boxes';
const CANVAS_STORAGE_KEY = 'canvas_settings';

export interface VariableColor {
    id: string;
    variable: string;
    value: string;
    color: string;
}

export interface BoxData {
    id: string;
    frame: { translate: [number, number]; width: number; height: number };
    zIndex: number;
    backgroundColor: string;
    backgroundColorText: string;
    backgroundVariableColors: VariableColor[];
    borderColor: string;
    borderColorText: string;
    borderVariableColors: VariableColor[];
    noBorder: boolean;
    headerColor: string;
    headerColorText: string;
    headerVariableColors: VariableColor[];
    headerLabelSource: string;
    headerLabel: string;
    headerLabelSize: number;
    headerLabelColor: string;
    headerLabelColorText: string;
    headerLabelVariableColors: VariableColor[];
    headerLabelVisible: boolean;
    leftLabelSource: string;
    leftLabel: string;
    leftLabelSize: number;
    leftLabelColor: string;
    leftLabelColorText: string;
    leftLabelVariableColors: VariableColor[];
    leftVisible: boolean;
    rightLabelSource: string;
    rightLabel: string;
    rightLabelSize: number;
    rightLabelColor: string;
    rightLabelColorText: string;
    rightLabelVariableColors: VariableColor[];
    rightVisible: boolean;
}





export default function App() {
    // Initialize state with localStorage data immediately
    const [boxes, setBoxes] = useState<BoxData[]>(() => {
        const savedBoxes = localStorage.getItem(STORAGE_KEY);
        if (savedBoxes) {
            try {
                return JSON.parse(savedBoxes);
            } catch (error) {
                console.error('Failed to parse saved boxes:', error);
                return defaultBoxes;
            }
        } else {
            return defaultBoxes;
        }
    });




    const handleConfigRestore = (newBoxes: BoxData[], newConnectionUrl: string, canvasSettings?: any) => {
        setBoxes(newBoxes);
        setCompanionBaseUrl(newConnectionUrl);
        setSelectedBoxId(null); // Clear any selection

        // Apply canvas settings if provided
        if (canvasSettings) {
            if (canvasSettings.canvasBackgroundColor !== undefined) {
                setCanvasBackgroundColor(canvasSettings.canvasBackgroundColor);
            }
            if (canvasSettings.canvasBackgroundColorText !== undefined) {
                setCanvasBackgroundColorText(canvasSettings.canvasBackgroundColorText);
            }
            if (canvasSettings.canvasBackgroundVariableColors !== undefined) {
                setCanvasBackgroundVariableColors(canvasSettings.canvasBackgroundVariableColors);
            }
        }
    };

    const deleteAllBoxes = () => {
        setBoxes([]);
        setSelectedBoxId(null); // Clear any selection
    };

    const duplicateBox = (originalBoxData: BoxData) => {
        const duplicatedBox: BoxData = {
            ...originalBoxData,
            id: uuid(), // New unique ID
            frame: {
                ...originalBoxData.frame,
                translate: [
                    originalBoxData.frame.translate[0] + 20, // Offset by 20px
                    originalBoxData.frame.translate[1] + 20
                ] as [number, number]
            }
        };
        setBoxes((prev) => [...prev, duplicatedBox]);
    };


    const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
    const [companionBaseUrl, setCompanionBaseUrl] = useState<string>('');

    // Canvas background color state - initialize from localStorage
    const [canvasBackgroundColor, setCanvasBackgroundColor] = useState<string>(() => {
        const saved = localStorage.getItem(CANVAS_STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return parsed.canvasBackgroundColor || '#000000';
            } catch (error) {
                console.error('Failed to parse canvas settings:', error);
                return '#000000';
            }
        }
        return '#000000';
    });
    const [canvasBackgroundColorText, setCanvasBackgroundColorText] = useState<string>(() => {
        const saved = localStorage.getItem(CANVAS_STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return parsed.canvasBackgroundColorText || '';
            } catch (error) {
                return '';
            }
        }
        return '';
    });
    const [canvasBackgroundVariableColors, setCanvasBackgroundVariableColors] = useState<VariableColor[]>(() => {
        const saved = localStorage.getItem(CANVAS_STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return parsed.canvasBackgroundVariableColors || [];
            } catch (error) {
                return [];
            }
        }
        return [];
    });

    // Save boxes to localStorage whenever boxes state changes
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(boxes));
    }, [boxes]);

    // Save canvas settings to localStorage whenever canvas state changes
    useEffect(() => {
        const canvasSettings = {
            canvasBackgroundColor,
            canvasBackgroundColorText,
            canvasBackgroundVariableColors
        };
        localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify(canvasSettings));
    }, [canvasBackgroundColor, canvasBackgroundColorText, canvasBackgroundVariableColors]);

    // Collect canvas variable names for fetching
    const getCanvasVariableNames = () => {
        const allVariables: { [key: string]: string } = {};

        // Add canvas background color text if it exists
        if (canvasBackgroundColorText) {
            allVariables[canvasBackgroundColorText] = canvasBackgroundColorText;
        }

        // Add canvas variable colors
        if (canvasBackgroundVariableColors && Array.isArray(canvasBackgroundVariableColors)) {
            canvasBackgroundVariableColors.forEach(varColor => {
                if (varColor.variable) {
                    allVariables[varColor.variable] = varColor.variable;
                }
            });
        }

        return allVariables;
    };

    // Use variable fetcher for canvas colors
    const { values: canvasVariableValues } = useVariableFetcher(companionBaseUrl, getCanvasVariableNames());

    // Canvas color resolution function (same as Box component)
    const resolveCanvasColor = (variableColors: VariableColor[], colorText: string, fallbackColor: string) => {
        // 1. Check variable colors first - find first matching variable that evaluates to true
        if (variableColors && Array.isArray(variableColors)) {
            for (const varColor of variableColors) {
                if (varColor && varColor.variable && varColor.value) {
                    const variableValue = canvasVariableValues[varColor.variable] || '';
                    if (variableValue === varColor.value) {
                        return varColor.color;
                    }
                }
            }
        }

        // 2. If no variable colors match, check if colorText has a value
        if (colorText && colorText.trim()) {
            return canvasVariableValues[colorText] || colorText;
        }

        // 3. Fall back to the picker color
        return fallbackColor;
    };

    // Calculate the actual canvas background color
    const actualCanvasBackgroundColor = resolveCanvasColor(
        canvasBackgroundVariableColors,
        canvasBackgroundColorText,
        canvasBackgroundColor
    );

    // Check if the resolved color is an image (http/https URL, data URL, or ends with image extensions)
    const isImageUrl = (value: string) => {
        if (!value) return false;
        // Check for HTTP URLs
        if (value.startsWith('http://') || value.startsWith('https://')) return true;
        // Check for base64 data URLs
        if (value.startsWith('data:image/')) return true;
        // Check for image extensions
        return /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(value);
    };

    // Generate background style
    const getCanvasBackgroundStyle = () => {
        if (isImageUrl(actualCanvasBackgroundColor)) {
            let imageUrl = actualCanvasBackgroundColor;
            
            // Check if this is a cached image reference
            if (actualCanvasBackgroundColor.startsWith('./src/assets/background_')) {
                const filename = actualCanvasBackgroundColor.split('/').pop();
                const cachedBase64 = localStorage.getItem(`cached_bg_${filename}`);
                if (cachedBase64) {
                    imageUrl = cachedBase64; // This is already a data URL (data:image/jpeg;base64,...)
                }
            }
            
            return {
                backgroundImage: `url("${imageUrl}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center center',
                backgroundRepeat: 'no-repeat'
            };
        }
        return {
            backgroundColor: actualCanvasBackgroundColor
        };
    };

    const createNewBox = () => {
        const newBox: BoxData = {
            id: uuid(),
            frame: {
                translate: [30, 60] as [number, number],
                width: 600,
                height: 105,
            },
            zIndex: 1,
            backgroundColor: "#262626",
            backgroundColorText: "",
            backgroundVariableColors: [],
            borderColor: "#61BAFA",
            borderColorText: "",
            borderVariableColors: [],
            noBorder: true,
            headerColor: '#19325c',
            headerColorText: "",
            headerVariableColors: [],
            headerLabelSource: 'Time of Day',
            headerLabel: 'NO CONNECTION',
            headerLabelSize: 16,
            headerLabelColor: '#ffffff',
            headerLabelColorText: "",
            headerLabelVariableColors: [],
            leftLabelSource: 'Time',
            leftLabel: '',
            leftLabelSize: 14,
            leftLabelColor: '#FFFFFF',
            leftLabelColorText: "",
            leftLabelVariableColors: [],
            leftVisible: true,
            rightLabelSource: '$(internal:time_hms_12)',
            rightLabel: '',
            rightLabelSize: 20,
            rightLabelColor: '#FFFFFF',
            rightLabelColorText: "",
            rightLabelVariableColors: [],
            rightVisible: true,
            headerLabelVisible: true,
        };
        setBoxes((prev) => [...prev, newBox]);
    };


    // Handle keyboard shortcuts for deleting selected box
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (selectedBoxId && (event.key === 'Backspace' || event.key === 'Delete')) {
                // Prevent default behavior (like navigating back in browser)
                event.preventDefault();
                // Delete the selected box
                setBoxes((prev) => prev.filter((b) => b.id !== selectedBoxId));
                setSelectedBoxId(null);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [selectedBoxId]);

    return (
        <div style={{
            minHeight: '100vh',
            width: '100%',
            ...getCanvasBackgroundStyle()
        }}>
            <TitleBar />
            <SettingsMenu
                onNewBox={createNewBox}
                connectionUrl={companionBaseUrl}
                onConnectionUrlChange={setCompanionBaseUrl}
                onConfigRestore={handleConfigRestore}
                onDeleteAllBoxes={deleteAllBoxes}
                canvasBackgroundColor={canvasBackgroundColor}
                canvasBackgroundColorText={canvasBackgroundColorText}
                canvasBackgroundVariableColors={canvasBackgroundVariableColors}
                onCanvasBackgroundColorChange={setCanvasBackgroundColor}
                onCanvasBackgroundColorTextChange={setCanvasBackgroundColorText}
                onCanvasBackgroundVariableColorsChange={setCanvasBackgroundVariableColors}
            />
            {boxes.length === 0 ? (
                <div style={{
                    position: 'fixed',
                    top: '0',
                    left: '0',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    zIndex: 1,
                }}>
                    <img
                        src={dashboardLogo}
                        alt="Dashboard"
                        style={{
                            width: '500px',
                            height: 'auto',
                            opacity: 0.2,
                            filter: 'grayscale(100%)'
                        }}
                    />
                    <div style={{
                        position: 'fixed',
                        bottom: '32px',
                        left: '60px',
                        color: '#FFF',
                        fontSize: '14px',
                        fontWeight: '500',
                        opacity: .5,
                    }}>
                        Open the menu to add boxes!
                    </div>
                </div>
            ) : (
                boxes.map((box) => (
                    <Box
                        key={box.id}
                        boxData={box}
                        isSelected={selectedBoxId === box.id} // Pass down selection state
                        onSelect={() => setSelectedBoxId(box.id)} // Pass down select handler
                        onDeselect={() => setSelectedBoxId(null)} // Pass down deselect handler
                        onBoxUpdate={(updatedBox) => {
                            setBoxes(prev => prev.map(b => b.id === updatedBox.id ? updatedBox : b));
                        }}
                        onDelete={(boxId) => {
                            setBoxes((prev) => prev.filter((b) => b.id !== boxId));
                            setSelectedBoxId(null);
                        }}
                        onDuplicate={duplicateBox}
                        companionBaseUrl={companionBaseUrl}
                    />
                ))
            )}
        </div >
    );
}

