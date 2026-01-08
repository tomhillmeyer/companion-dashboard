import React, { useEffect, useRef, useState, useMemo } from 'react';

// Get window ID for isolated storage
const windowId = (window as any).electronAPI?.windowId || '1';
import { v4 as uuid } from 'uuid';
import Moveable from 'react-moveable';
import './Box.css';
import type { BoxData } from './App';
import BoxSettingsModal from './BoxSettingsModal';
import { useVariableFetcher } from './useVariableFetcher';
import { DoubleTapBox } from './DoubleTapBox';

interface CompanionConnection {
    id: string;
    url: string;
    label: string;
}

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
    connections = [],
    refreshRateMs = 100,
    isDragging = false,
    onDragStart,
    onDragEnd,
    boxesLocked = false,
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
    connections?: CompanionConnection[];
    refreshRateMs?: number;
    isDragging?: boolean;
    onDragStart?: () => void;
    onDragEnd?: () => void;
    boxesLocked?: boolean;
}) {

    const targetRef = useRef<HTMLDivElement>(null);
    const [frame, setFrame] = useState(boxData.frame);
    const [showModal, setShowModal] = useState(false);
    const [loadedBackgroundImage, setLoadedBackgroundImage] = useState<string>('');
    const [isDragStartCalled, setIsDragStartCalled] = useState(false);

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
                            const cachedData = localStorage.getItem(`window_${windowId}_cached_bg_${filename}`);
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
            boxData.overlayVariableColors,
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

        // Add variable opacity variables
        if (boxData.opacityVariableValues && Array.isArray(boxData.opacityVariableValues)) {
            boxData.opacityVariableValues.forEach(varOpacity => {
                if (varOpacity.variable) {
                    allVariables[varOpacity.variable] = varOpacity.variable;
                }
            });
        }

        // Add variable overlay size variables
        if (boxData.overlaySizeVariableValues && Array.isArray(boxData.overlaySizeVariableValues)) {
            boxData.overlaySizeVariableValues.forEach(varSize => {
                if (varSize.variable) {
                    allVariables[varSize.variable] = varSize.variable;
                }
            });
        }

        return allVariables;
    };

    // Use the enhanced variable fetcher
    const { values: variableValues, htmlValues: variableHtmlValues } = useVariableFetcher(companionBaseUrl, {
        headerLabelSource: boxData.headerLabelSource,
        leftLabelSource: boxData.leftLabelSource,
        rightLabelSource: boxData.rightLabelSource,
        backgroundColorTextSource: boxData.backgroundColorText,
        overlayColorTextSource: boxData.overlayColorText,
        borderColorTextSource: boxData.borderColorText,
        headerColorTextSource: boxData.headerColorText,
        headerLabelColorTextSource: boxData.headerLabelColorText,
        leftLabelColorTextSource: boxData.leftLabelColorText,
        rightLabelColorTextSource: boxData.rightLabelColorText,
        opacitySource: boxData.opacitySource,
        overlaySizeSource: boxData.overlaySizeSource,
        ...getAllVariableNames() // Add all variable color variables
    }, connections, refreshRateMs, isDragging);

    // Compute opacity from variable or fallback to stored value
    const computedOpacity = () => {
        // 1. Check variable opacity values first - find first matching variable that evaluates to true
        if (boxData.opacityVariableValues && Array.isArray(boxData.opacityVariableValues)) {
            for (const varOpacity of boxData.opacityVariableValues) {
                if (varOpacity && varOpacity.variable && varOpacity.value) {
                    const variableValue = variableValues[varOpacity.variable] || '';
                    if (variableValue === varOpacity.value) {
                        return varOpacity.opacity / 100;
                    }
                }
            }
        }

        // 2. Check if opacitySource contains a variable pattern
        const hasVariable = boxData.opacitySource && boxData.opacitySource.includes('$(') && boxData.opacitySource.includes(')');

        if (hasVariable && variableValues.opacitySource) {
            const parsed = parseInt(variableValues.opacitySource);
            if (!isNaN(parsed)) {
                return Math.max(0, Math.min(100, parsed)) / 100;
            }
        }

        // 3. Use the stored opacity value
        return boxData.opacity / 100;
    };

    // Compute overlay size from variable or fallback to stored value
    const computeOverlaySize = () => {
        // 1. Check variable overlay size values first - find first matching variable that evaluates to true
        if (boxData.overlaySizeVariableValues && Array.isArray(boxData.overlaySizeVariableValues)) {
            for (const varSize of boxData.overlaySizeVariableValues) {
                if (varSize && varSize.variable && varSize.value) {
                    const variableValue = variableValues[varSize.variable] || '';
                    if (variableValue === varSize.value) {
                        return varSize.size;
                    }
                }
            }
        }

        // 2. Check if overlaySizeSource contains a variable pattern
        const hasVariable = boxData.overlaySizeSource && boxData.overlaySizeSource.includes('$(') && boxData.overlaySizeSource.includes(')');

        if (hasVariable && variableValues.overlaySizeSource) {
            const parsed = parseInt(variableValues.overlaySizeSource);
            if (!isNaN(parsed)) {
                return Math.max(0, Math.min(100, parsed));
            }
        }

        // 3. Use the stored overlay size value
        return boxData.overlaySize;
    };

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

    // Resolve overlay color with same priority logic as background
    const resolveOverlayColor = () => {
        try {
            // 1. Check variable colors first
            if (boxData.overlayVariableColors && Array.isArray(boxData.overlayVariableColors)) {
                for (const varColor of boxData.overlayVariableColors) {
                    if (varColor && varColor.variable && varColor.value) {
                        const variableValue = variableValues[varColor.variable] || '';
                        if (variableValue === varColor.value) {
                            return varColor.color || '';
                        }
                    }
                }
            }

            // 2. Check if overlayColorText has a value and resolve it
            if (boxData.overlayColorText && typeof boxData.overlayColorText === 'string' && boxData.overlayColorText.trim()) {
                const resolvedValue = variableValues.overlayColorTextSource || boxData.overlayColorText;
                return resolvedValue || '';
            }

            // 3. Fall back to the picker color
            return boxData.overlayColor || '#00000000';
        } catch (error) {
            console.error('Error in resolveOverlayColor:', error);
            return boxData.overlayColor || '#00000000';
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
    const headerStyle = useMemo(() => {
        const align = boxData.headerLabelAlign || 'center';
        const justifyMap: { [key: string]: 'flex-start' | 'center' | 'flex-end' } = {
            left: 'flex-start',
            center: 'center',
            right: 'flex-end'
        };

        return {
            backgroundColor: resolveColor(boxData.headerVariableColors, boxData.headerColorText, boxData.headerColor, variableValues),
            color: resolveColor(boxData.headerLabelVariableColors, boxData.headerLabelColorText, boxData.headerLabelColor, variableValues),
            fontSize: `${boxData.headerLabelSize}px`,
            textAlign: align as 'left' | 'center' | 'right',
            display: boxData.headerLabelVisible ? 'flex' : 'none',
            alignItems: 'center' as const,
            justifyContent: justifyMap[align],
        };
    }, [
        boxData.headerVariableColors, boxData.headerColorText, boxData.headerColor,
        boxData.headerLabelVariableColors, boxData.headerLabelColorText, boxData.headerLabelColor,
        boxData.headerLabelSize, boxData.headerLabelVisible, boxData.headerLabelAlign, variableValues
    ]);

    const leftStyle = useMemo(() => {
        // Ensure leftRightRatio has a valid value, default to 50
        const ratio = boxData.leftRightRatio ?? 50;

        // Calculate effective width based on visibility
        // If left is hidden, width is 0%
        // If right is hidden, width is 100%
        // Otherwise, use the ratio
        let effectiveWidth: number;
        if (!boxData.leftVisible) {
            effectiveWidth = 0;
        } else if (!boxData.rightVisible) {
            effectiveWidth = 100;
        } else {
            effectiveWidth = ratio;
        }

        const align = boxData.leftLabelAlign || 'left';
        const justifyMap: { [key: string]: 'flex-start' | 'center' | 'flex-end' } = {
            left: 'flex-start',
            center: 'center',
            right: 'flex-end'
        };

        return {
            color: resolveColor(boxData.leftLabelVariableColors, boxData.leftLabelColorText, boxData.leftLabelColor, variableValues),
            fontSize: `${boxData.leftLabelSize}px`,
            display: boxData.leftVisible ? 'flex' : 'none',
            justifyContent: justifyMap[align],
            textAlign: align as 'left' | 'center' | 'right',
            alignItems: 'center' as const,
            flexBasis: `${effectiveWidth}%`,
        };
    }, [
        boxData.leftLabelVariableColors, boxData.leftLabelColorText, boxData.leftLabelColor,
        boxData.leftLabelSize, boxData.leftVisible,
        boxData.rightVisible, boxData.leftRightRatio, boxData.leftLabelAlign, variableValues
    ]);

    const rightStyle = useMemo(() => {
        // Ensure leftRightRatio has a valid value, default to 50
        const ratio = boxData.leftRightRatio ?? 50;

        // Calculate effective width based on visibility
        // If right is hidden, width is 0%
        // If left is hidden, width is 100%
        // Otherwise, use 100 - ratio
        let effectiveWidth: number;
        if (!boxData.rightVisible) {
            effectiveWidth = 0;
        } else if (!boxData.leftVisible) {
            effectiveWidth = 100;
        } else {
            effectiveWidth = 100 - ratio;
        }

        const align = boxData.rightLabelAlign || 'right';
        const justifyMap: { [key: string]: 'flex-start' | 'center' | 'flex-end' } = {
            left: 'flex-start',
            center: 'center',
            right: 'flex-end'
        };

        return {
            color: resolveColor(boxData.rightLabelVariableColors, boxData.rightLabelColorText, boxData.rightLabelColor, variableValues),
            fontSize: `${boxData.rightLabelSize}px`,
            display: boxData.rightVisible ? 'flex' : 'none',
            justifyContent: justifyMap[align],
            textAlign: align as 'left' | 'center' | 'right',
            alignItems: 'center' as const,
            flexBasis: `${effectiveWidth}%`,
        };
    }, [
        boxData.rightLabelVariableColors, boxData.rightLabelColorText, boxData.rightLabelColor,
        boxData.rightLabelSize, boxData.rightVisible,
        boxData.leftVisible, boxData.leftRightRatio, boxData.rightLabelAlign, variableValues
    ]);

    return (
        <div>
            <DoubleTapBox onDoubleTap={() => { if (!boxesLocked) setShowModal(true) }}>
                <div className="box-container">
                    <div
                        ref={targetRef}
                        className={`box ${boxData.noBorder ? 'no-border' : 'with-border'} ${(loadedBackgroundImage || (resolveBoxBackgroundColor() && isImageUrl(resolveBoxBackgroundColor()))) ? 'has-background-image' : ''}`}
                        onClick={(e) => {
                            if (boxesLocked) {
                                // When locked, allow clicks to pass through to content
                                return;
                            }
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
                                    },
                                    // Ensure leftRightRatio has a valid value
                                    leftRightRatio: boxData.leftRightRatio ?? 50
                                };
                                onDuplicate(duplicatedBox);
                            } else {
                                onSelect();
                            }
                        }}
                        onDoubleClick={(e) => {
                            if (boxesLocked) {
                                // When locked, allow double-clicks to pass through to content
                                return;
                            }
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
                            opacity: computedOpacity(),
                            pointerEvents: boxesLocked ? 'none' : 'auto',
                        }}
                    >
                        {/* Overlay layer on top of background */}
                        <div style={{
                            position: 'absolute',
                            ...(boxData.overlayDirection === 'left' ? {
                                top: 0,
                                left: 0,
                                bottom: 0,
                                width: `${computeOverlaySize()}%`
                            } : boxData.overlayDirection === 'right' ? {
                                top: 0,
                                right: 0,
                                bottom: 0,
                                width: `${computeOverlaySize()}%`
                            } : boxData.overlayDirection === 'top' ? {
                                top: 0,
                                left: 0,
                                right: 0,
                                height: `${computeOverlaySize()}%`
                            } : {
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: `${computeOverlaySize()}%`
                            }),
                            backgroundColor: resolveOverlayColor(),
                            pointerEvents: 'none',
                            zIndex: 1,
                            transition: 'width 0.3s ease, height 0.3s ease'
                        }}></div>

                        {/* Wrapper for interactive content - has pointer-events: auto when locked */}
                        <div style={{
                            pointerEvents: boxesLocked ? 'auto' : 'none',
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'stretch',
                            position: 'relative',
                            zIndex: 2
                        }}>
                            {/* Header */}
                            <MarkdownContent
                                key={`${boxData.id}-header`}
                                content={displayHtmlLabels.header}
                                className="header"
                                style={headerStyle}
                            />

                            {/* Body with left and right labels */}
                            <div className='content-container'>
                                <MarkdownContent
                                    key={`${boxData.id}-left`}
                                    content={displayHtmlLabels.left}
                                    className="content"
                                    style={leftStyle}
                                />
                                <MarkdownContent
                                    key={`${boxData.id}-right`}
                                    content={displayHtmlLabels.right}
                                    className="content"
                                    style={rightStyle}
                                />
                            </div>
                        </div>
                    </div>

                    {isSelected && !boxesLocked && (
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
                            useResizeObserver={true}
                            touchAction="none"
                            dragContainer={document.body}
                            preventDefault={true}
                            stopDragging={false}
                            onDrag={({ beforeTranslate }) => {
                                // Call onDragStart only once at the beginning of drag
                                if (!isDragStartCalled) {
                                    onDragStart?.();
                                    setIsDragStartCalled(true);
                                }
                                const newFrame = {
                                    ...frame,
                                    translate: [beforeTranslate[0], beforeTranslate[1]] as [number, number]
                                };
                                setFrame(newFrame);
                                targetRef.current!.style.transform = `translate(${beforeTranslate[0]}px, ${beforeTranslate[1]}px)`;
                            }}
                            onDragEnd={({ lastEvent }) => {
                                // Call onDragEnd and reset drag start flag
                                onDragEnd?.();
                                setIsDragStartCalled(false);
                                if (lastEvent) {
                                    const newFrame = {
                                        ...frame,
                                        translate: [lastEvent.beforeTranslate[0], lastEvent.beforeTranslate[1]] as [number, number]
                                    };
                                    updateFrame(newFrame);
                                }
                            }}
                            onResize={({ width, height, drag }) => {
                                // Call onDragStart for resize operations too
                                if (!isDragStartCalled) {
                                    onDragStart?.();
                                    setIsDragStartCalled(true);
                                }
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
                                // Call onDragEnd for resize operations too
                                onDragEnd?.();
                                setIsDragStartCalled(false);
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