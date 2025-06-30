import React, { useEffect, useRef, useState, useMemo } from 'react';
import { v4 as uuid } from 'uuid';
import Moveable from 'react-moveable';
import './Box.css';
import type { BoxData } from './App';
import BoxSettingsModal from './BoxSettingsModal';
import { useVariableFetcher } from './useVariableFetcher';
import { DoubleTapBox } from './DoubleTapBox';

// Component for rendering markdown content
const MarkdownContent = React.memo(({
    content,
    style,
    className = ''
}: {
    content: string;
    style: React.CSSProperties;
    className?: string;
}) => {
    // Check for media content that should not have padding (images, iframes, etc.)
    const isTextOnly = (() => {
        if (!content || typeof content !== 'string') return true;

        try {
            // Check for HTML image/media tags
            const hasImageTags = /<img[^>]*>/i.test(content);
            const hasIframeTags = /<iframe[^>]*>/i.test(content);
            const hasVideoTags = /<video[^>]*>/i.test(content);

            // Check for markdown image syntax that will become HTML
            const hasMarkdownImages = /!\[.*?\]\(.*?\)/.test(content);

            // Only media content should have no padding
            const hasMediaContent = hasImageTags || hasIframeTags || hasVideoTags || hasMarkdownImages;

            // Everything else (including formatted text, links, etc.) gets padding
            return !hasMediaContent;
        } catch (error) {
            console.error('Error in media detection:', error);
            return true; // Default to text-only (with padding) if error
        }
    })();

    // If it's text content (not media), wrap in span with text-only-content class for padding
    const processedContent = (() => {
        try {
            if (!content || typeof content !== 'string') return '';
            return isTextOnly ? `<span class="text-only-content">${content}</span>` : content;
        } catch (error) {
            console.error('Error processing content:', error);
            return content || '';
        }
    })();

    return (
        <div
            className={className}
            style={style}
            dangerouslySetInnerHTML={{ __html: processedContent }}
        />
    );
});

export default function Box({
    boxData,
    isSelected,
    onSelect,
    onDeselect,
    onBoxUpdate,
    onDelete,
    onDuplicate,
    gridSize = 15,
    companionBaseUrl,
}: {
    boxData: BoxData;
    isSelected: boolean;
    onSelect: () => void;
    onDeselect: () => void;
    onBoxUpdate: (boxData: BoxData) => void;
    onDelete: (boxId: string) => void;
    onDuplicate: (boxData: BoxData) => void;
    gridSize?: number;
    companionBaseUrl: string;
}) {

    const targetRef = useRef<HTMLDivElement>(null);
    const [frame, setFrame] = useState(boxData.frame);
    const [showModal, setShowModal] = useState(false);
    const [loadedBackgroundImage, setLoadedBackgroundImage] = useState<string>('');

    // Update local frame when initialFrame changes
    useEffect(() => {
        setFrame(boxData.frame);
    }, [boxData.frame]);

    const getGridLines = (gridSize: number) => {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const numVerticalLines = Math.ceil(viewportWidth / gridSize);
        const numHorizontalLines = Math.ceil(viewportHeight / gridSize);

        return {
            verticalGridLines: Array.from({ length: numVerticalLines + 1 }, (_, i) => i * gridSize),
            horizontalGridLines: Array.from({ length: numHorizontalLines + 1 }, (_, i) => i * gridSize),
        };
    };

    const [gridLines, setGridLines] = useState(() => getGridLines(gridSize));

    useEffect(() => {
        const handleResize = () => {
            setGridLines(getGridLines(gridSize));
            onDeselect();
        };

        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, [gridSize]);

    useEffect(() => {
        const handleClickOutside = () => onDeselect();
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [onDeselect]);

    const updateFrame = (newFrame: { translate: [number, number]; width: number; height: number }) => {
        setFrame(newFrame);
        // Update the full boxData with the new frame
        onBoxUpdate({
            ...boxData,
            frame: newFrame
        });
    };

    useEffect(() => {
        if (showModal) {
            onDeselect();
        }
    }, [showModal, onDeselect]);

    // Function to check if a string is an image URL
    const isImageUrl = (text: string): boolean => {
        if (!text || typeof text !== 'string') return false;

        try {
            // Check for HTTP/HTTPS URLs
            if (text.startsWith('http://') || text.startsWith('https://')) {
                return true;
            }

            // Check for data URLs
            if (text.startsWith('data:image/')) {
                return true;
            }

            // Check for file extensions
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
            return imageExtensions.some(ext => text.toLowerCase().endsWith(ext));
        } catch (error) {
            console.error('Error in isImageUrl:', error);
            return false;
        }
    };

    // Load background image from storage when backgroundImage changes
    useEffect(() => {
        const loadBackgroundImage = async () => {
            if (!boxData.backgroundImage || typeof boxData.backgroundImage !== 'string') {
                setLoadedBackgroundImage('');
                return;
            }

            try {
                // If it's already a data URL or HTTP URL, use it directly
                if (isImageUrl(boxData.backgroundImage) && !boxData.backgroundImage.startsWith('./src/assets/')) {
                    setLoadedBackgroundImage(boxData.backgroundImage);
                    return;
                }

                // If it's a cached image path, load from storage
                if (boxData.backgroundImage.startsWith('./src/assets/')) {
                    const filename = boxData.backgroundImage.split('/').pop();
                    if (filename) {
                        try {
                            // Try IndexedDB first
                            const imageData = await getImageFromDB(filename);
                            if (imageData) {
                                setLoadedBackgroundImage(imageData);
                                return;
                            }

                            // Fallback to localStorage
                            const cachedData = localStorage.getItem(`cached_bg_${filename}`);
                            if (cachedData) {
                                setLoadedBackgroundImage(cachedData);
                                return;
                            }
                        } catch (error) {
                            console.error('Failed to load background image:', error);
                        }
                    }
                }
            } catch (error) {
                console.error('Error in loadBackgroundImage:', error);
            }

            setLoadedBackgroundImage('');
        };

        loadBackgroundImage();
    }, [boxData.backgroundImage]);

    // IndexedDB helper function
    const getImageFromDB = async (filename: string): Promise<string | null> => {
        try {
            const request = indexedDB.open('CompanionDashboardImages', 3);

            return new Promise((resolve, reject) => {
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const db = request.result;
                    const transaction = db.transaction(['images'], 'readonly');
                    const store = transaction.objectStore('images');
                    const getRequest = store.get(filename);

                    getRequest.onerror = () => reject(getRequest.error);
                    getRequest.onsuccess = () => {
                        const result = getRequest.result;
                        resolve(result ? result.data : null);
                    };
                };
            });
        } catch (error) {
            console.error('Error getting image from IndexedDB:', error);
            return null;
        }
    };

    // Collect all variable names from variable colors arrays
    const getAllVariableNames = () => {
        const allVariables: { [key: string]: string } = {};

        // Add variable colors
        const variableColorArrays = [
            boxData.backgroundVariableColors,
            boxData.borderVariableColors,
            boxData.headerVariableColors,
            boxData.headerLabelVariableColors,
            boxData.leftLabelVariableColors,
            boxData.rightLabelVariableColors
        ];

        variableColorArrays.forEach(varColors => {
            if (varColors && Array.isArray(varColors)) {
                varColors.forEach(varColor => {
                    if (varColor.variable) {
                        allVariables[varColor.variable] = varColor.variable;
                    }
                });
            }
        });

        return allVariables;
    };

    // Use the enhanced variable fetcher
    const { values: variableValues, htmlValues: variableHtmlValues } = useVariableFetcher(companionBaseUrl, {
        headerLabelSource: boxData.headerLabelSource,
        leftLabelSource: boxData.leftLabelSource,
        rightLabelSource: boxData.rightLabelSource,
        backgroundColorTextSource: boxData.backgroundColorText,
        borderColorTextSource: boxData.borderColorText,
        headerColorTextSource: boxData.headerColorText,
        headerLabelColorTextSource: boxData.headerLabelColorText,
        leftLabelColorTextSource: boxData.leftLabelColorText,
        rightLabelColorTextSource: boxData.rightLabelColorText,
        ...getAllVariableNames() // Add all variable color variables
    });

    // Utility function to resolve color with priority: variable colors > colorText > fallback color
    const resolveColor = (variableColors: any[], colorText: string, fallbackColor: string, variableValues: any) => {
        // 1. Check variable colors first - find first matching variable that evaluates to true
        if (variableColors && Array.isArray(variableColors)) {
            for (const varColor of variableColors) {
                if (varColor && varColor.variable && varColor.value) {
                    const variableValue = variableValues[varColor.variable] || '';
                    if (variableValue === varColor.value) {
                        return varColor.color;
                    }
                }
            }
        }

        // 2. If no variable colors match, check if colorText has a value
        if (colorText && colorText.trim()) {
            return variableValues[colorText] || colorText;
        }

        // 3. Fall back to the picker color
        return fallbackColor;
    };

    // Resolve background color similar to canvas implementation
    const resolveBoxBackgroundColor = () => {
        try {
            // 1. Check variable colors first
            if (boxData.backgroundVariableColors && Array.isArray(boxData.backgroundVariableColors)) {
                for (const varColor of boxData.backgroundVariableColors) {
                    if (varColor && varColor.variable && varColor.value) {
                        const variableValue = variableValues[varColor.variable] || '';
                        if (variableValue === varColor.value) {
                            return varColor.color || '';
                        }
                    }
                }
            }

            // 2. Check if backgroundColorText has a value and resolve it
            if (boxData.backgroundColorText && typeof boxData.backgroundColorText === 'string' && boxData.backgroundColorText.trim()) {
                const resolvedValue = variableValues.backgroundColorTextSource || boxData.backgroundColorText;
                return resolvedValue || '';
            }

            // 3. Fall back to the picker color
            return boxData.backgroundColor || '#262626';
        } catch (error) {
            console.error('Error in resolveBoxBackgroundColor:', error);
            return boxData.backgroundColor || '#262626';
        }
    };

    // Generate background style that handles both color and image
    const getBackgroundStyle = () => {
        try {
            const actualBackgroundColor = resolveBoxBackgroundColor();
            const opacity = (boxData.backgroundImageOpacity || 100) / 100;

            // Check if the resolved background color is actually an image URL
            if (actualBackgroundColor && isImageUrl(actualBackgroundColor)) {
                return {
                    backgroundColor: 'transparent', // Use transparent to support alpha
                    position: 'relative' as const,
                    '--background-image': `url("${actualBackgroundColor}")`,
                    '--background-size': boxData.backgroundImageSize || 'cover',
                    '--background-opacity': opacity
                };
            }

            // If there's a manually set background image, use it
            if (loadedBackgroundImage && typeof loadedBackgroundImage === 'string') {
                return {
                    backgroundColor: 'transparent', // Use transparent to support alpha
                    position: 'relative' as const,
                    '--background-image': `url(${loadedBackgroundImage})`,
                    '--background-size': boxData.backgroundImageSize || 'cover',
                    '--background-opacity': opacity
                };
            }

            // Otherwise, use as background color
            return {
                backgroundColor: actualBackgroundColor || '#262626',
            };
        } catch (error) {
            console.error('Error in getBackgroundStyle:', error);
            return {
                backgroundColor: boxData.backgroundColor || '#262626',
            };
        }
    };

    // Use the fetched values or fall back to manual labels
    /*
    const displayLabels = {
        header: variableValues.headerLabelSource || boxData.headerLabelSource,
        left: variableValues.leftLabelSource || boxData.leftLabelSource,
        right: variableValues.rightLabelSource || boxData.rightLabelSource,
        backgroundColor: variableValues.backgroundColorTextSource || boxData.backgroundColorText,
        headerColor: variableValues.headerColorTextSource || boxData.headerColorText,
        headerLabelColor: variableValues.headerLabelColorTextSource || boxData.headerLabelColorText,
        leftLabelColorTextSource: variableValues.leftLabelColorTextSource || boxData.leftLabelColorText,
        rightLabelColorTextSource: variableValues.rightLabelColorTextSource || boxData.rightLabelColorText,
    };*/


    const displayHtmlLabels = useMemo(() => {
        try {
            return {
                header: variableHtmlValues.headerLabelSource || '',
                left: variableHtmlValues.leftLabelSource || '',
                right: variableHtmlValues.rightLabelSource || '',
            };
        } catch (error) {
            console.error('Error in displayHtmlLabels:', error);
            return {
                header: '',
                left: '',
                right: '',
            };
        }
    }, [variableHtmlValues.headerLabelSource, variableHtmlValues.leftLabelSource, variableHtmlValues.rightLabelSource]);

    // Memoize styles to prevent unnecessary re-renders
    const headerStyle = useMemo(() => ({
        backgroundColor: resolveColor(boxData.headerVariableColors, boxData.headerColorText, boxData.headerColor, variableValues),
        color: resolveColor(boxData.headerLabelVariableColors, boxData.headerLabelColorText, boxData.headerLabelColor, variableValues),
        fontSize: `${boxData.headerLabelSize}px`,
        textAlign: 'center' as const,
        display: boxData.headerLabelVisible ? 'flex' : 'none',
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
    }), [
        boxData.headerVariableColors, boxData.headerColorText, boxData.headerColor,
        boxData.headerLabelVariableColors, boxData.headerLabelColorText, boxData.headerLabelColor,
        boxData.headerLabelSize, boxData.headerLabelVisible, variableValues
    ]);

    const leftStyle = useMemo(() => ({
        color: resolveColor(boxData.leftLabelVariableColors, boxData.leftLabelColorText, boxData.leftLabelColor, variableValues),
        fontSize: `${boxData.leftLabelSize}px`,
        display: boxData.leftVisible ? 'flex' : 'none',
        justifyContent: boxData.rightVisible ? 'flex-start' : 'center',
        textAlign: boxData.rightVisible ? 'left' as const : 'center' as const,
        alignItems: 'center' as const,
    }), [
        boxData.leftLabelVariableColors, boxData.leftLabelColorText, boxData.leftLabelColor,
        boxData.leftLabelSize, boxData.leftVisible,
        boxData.rightVisible, variableValues
    ]);

    const rightStyle = useMemo(() => ({
        color: resolveColor(boxData.rightLabelVariableColors, boxData.rightLabelColorText, boxData.rightLabelColor, variableValues),
        fontSize: `${boxData.rightLabelSize}px`,
        display: boxData.rightVisible ? 'flex' : 'none',
        justifyContent: boxData.leftVisible ? 'flex-end' : 'center',
        textAlign: boxData.leftVisible ? 'right' as const : 'center' as const,
        alignItems: 'center' as const,
    }), [
        boxData.rightLabelVariableColors, boxData.rightLabelColorText, boxData.rightLabelColor,
        boxData.rightLabelSize, boxData.rightVisible,
        boxData.leftVisible, variableValues
    ]);

    return (
        <div>
            <DoubleTapBox onDoubleTap={() => { setShowModal(true) }}>
                <div className="box-container">
                    <div
                        ref={targetRef}
                        className={`box ${boxData.noBorder ? 'no-border' : 'with-border'} ${(loadedBackgroundImage || (resolveBoxBackgroundColor() && isImageUrl(resolveBoxBackgroundColor()))) ? 'has-background-image' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (e.altKey) {
                                // Duplicate this box
                                const duplicatedBox: BoxData = {
                                    ...boxData,
                                    id: uuid(),
                                    frame: {
                                        ...boxData.frame,
                                        translate: [
                                            boxData.frame.translate[0] + 20,
                                            boxData.frame.translate[1] + 20
                                        ] as [number, number]
                                    }
                                };
                                onDuplicate(duplicatedBox);
                            } else {
                                onSelect();
                            }
                        }}
                        onDoubleClick={(e) => {
                            e.stopPropagation();
                            setShowModal(true);
                        }}
                        style={{
                            width: `${frame.width}px`,
                            height: `${frame.height}px`,
                            ...getBackgroundStyle(),
                            border: boxData.noBorder ? 'none' : `5px solid ${resolveColor(boxData.borderVariableColors, boxData.borderColorText, boxData.borderColor, variableValues)}`,
                            WebkitTransform: `translate(${frame.translate[0]}px, ${frame.translate[1]}px) translateZ(0)`,
                            transform: `translate(${frame.translate[0]}px, ${frame.translate[1]}px) translateZ(0)`,
                            zIndex: boxData.zIndex,
                        }}
                    >
                        {/* Header */}
                        <MarkdownContent
                            content={displayHtmlLabels.header}
                            className="header"
                            style={headerStyle}
                        />

                        {/* Body with left and right labels */}
                        <div className='content-container'>
                            <MarkdownContent
                                content={displayHtmlLabels.left}
                                className="content"
                                style={leftStyle}
                            />
                            <MarkdownContent
                                content={displayHtmlLabels.right}
                                className="content"
                                style={rightStyle}
                            />
                        </div>
                    </div>

                    {isSelected && (
                        <Moveable
                            target={targetRef}
                            draggable
                            resizable
                            snappable
                            snapThreshold={15}
                            snapDirections={{ top: true, left: true, bottom: true, right: true }}
                            verticalGuidelines={gridLines.verticalGridLines}
                            horizontalGuidelines={gridLines.horizontalGridLines}
                            isDisplaySnapDigit
                            onDrag={({ beforeTranslate }) => {
                                const newFrame = {
                                    ...frame,
                                    translate: [beforeTranslate[0], beforeTranslate[1]] as [number, number]
                                };
                                setFrame(newFrame);
                                targetRef.current!.style.transform = `translate(${beforeTranslate[0]}px, ${beforeTranslate[1]}px)`;
                            }}
                            onDragEnd={({ lastEvent }) => {
                                if (lastEvent) {
                                    const newFrame = {
                                        ...frame,
                                        translate: [lastEvent.beforeTranslate[0], lastEvent.beforeTranslate[1]] as [number, number]
                                    };
                                    updateFrame(newFrame);
                                }
                            }}
                            onResize={({ width, height, drag }) => {
                                const beforeTranslate = drag.beforeTranslate;
                                const newFrame = {
                                    translate: [beforeTranslate[0], beforeTranslate[1]] as [number, number],
                                    width,
                                    height
                                };
                                setFrame(newFrame);
                                targetRef.current!.style.width = `${width}px`;
                                targetRef.current!.style.height = `${height}px`;
                                targetRef.current!.style.transform = `translate(${beforeTranslate[0]}px, ${beforeTranslate[1]}px)`;
                            }}
                            onResizeEnd={({ lastEvent }) => {
                                if (lastEvent) {
                                    const newFrame = {
                                        translate: [lastEvent.drag.beforeTranslate[0], lastEvent.drag.beforeTranslate[1]] as [number, number],
                                        width: lastEvent.width,
                                        height: lastEvent.height
                                    };
                                    updateFrame(newFrame);
                                }
                            }}
                        />
                    )}
                </div>
            </DoubleTapBox>

            {/* Move modal outside of isSelected condition */}
            {showModal && (
                <BoxSettingsModal
                    boxData={boxData}
                    onSave={(updatedBoxData) => {
                        onBoxUpdate(updatedBoxData);
                        setShowModal(false);
                    }}
                    onCancel={() => setShowModal(false)}
                    onDelete={(boxId) => {
                        onDelete(boxId);
                        setShowModal(false);
                    }}
                    onDuplicate={(boxData) => {
                        onDuplicate(boxData);
                        setShowModal(false);
                    }}
                />
            )}
        </div>
    );
}