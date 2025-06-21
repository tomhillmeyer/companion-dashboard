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
    // Check if content contains HTML tags (indicating it's not plain text)
    const hasHtmlTags = /<[^>]*>/.test(content);

    // If it's plain text, wrap in span with text-only-content class
    const processedContent = hasHtmlTags ? content : `<span class="text-only-content">${content}</span>`;

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

    // HTML versions for markdown rendering - need to parse even the fallback values
    const parseMarkdownFallback = (text: string): string => {
        if (!text) return '';

        // First, store escaped characters with unique placeholders
        const escapedChars: { [key: string]: string } = {};
        let placeholderIndex = 0;

        let processedText = text.replace(/\\(\*|_|\[|\]|\(|\)|!)/g, (char) => {
            const placeholder = `XESCAPEDX${placeholderIndex}XESCAPEDX`;
            escapedChars[placeholder] = char;
            placeholderIndex++;
            return placeholder;
        });

        // Now apply markdown formatting
        processedText = processedText
            // Bold: **text** or __text__
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.*?)__/g, '<strong>$1</strong>')
            // Italic: *text* or _text_
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/_(.*?)_/g, '<em>$1</em>')
            // Images: ![alt](url)
            .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="width: auto; height: 100%;" />')
            // Links: [text](url)
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
            // Line breaks
            .replace(/\n/g, '<br>');

        // Finally, restore escaped characters
        Object.keys(escapedChars).forEach(placeholder => {
            processedText = processedText.replace(new RegExp(placeholder, 'g'), escapedChars[placeholder]);
        });

        return processedText;
    };

    const displayHtmlLabels = useMemo(() => ({
        header: variableHtmlValues.headerLabelSource || parseMarkdownFallback(boxData.headerLabelSource),
        left: variableHtmlValues.leftLabelSource || parseMarkdownFallback(boxData.leftLabelSource),
        right: variableHtmlValues.rightLabelSource || parseMarkdownFallback(boxData.rightLabelSource),
    }), [variableHtmlValues.headerLabelSource, variableHtmlValues.leftLabelSource, variableHtmlValues.rightLabelSource, boxData.headerLabelSource, boxData.leftLabelSource, boxData.rightLabelSource]);

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
                        className="box"
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
                            transform: `translate(${frame.translate[0]}px, ${frame.translate[1]}px)`,
                            backgroundColor: resolveColor(boxData.backgroundVariableColors, boxData.backgroundColorText, boxData.backgroundColor, variableValues),
                            border: boxData.noBorder ? 'none' : `5px solid ${resolveColor(boxData.borderVariableColors, boxData.borderColorText, boxData.borderColor, variableValues)}`,
                            borderRadius: boxData.noBorder ? '10px' : `15px`,
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