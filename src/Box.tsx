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
    return (
        <div
            className={className}
            style={style}
            dangerouslySetInnerHTML={{ __html: content }}
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

    // Use the enhanced variable fetcher
    const { values: variableValues, htmlValues: variableHtmlValues } = useVariableFetcher(companionBaseUrl, {
        headerLabelSource: boxData.headerLabelSource,
        leftLabelSource: boxData.leftLabelSource,
        rightLabelSource: boxData.rightLabelSource,
        backgroundColorTextSource: boxData.backgroundColorText,
        headerColorTextSource: boxData.headerColorText,
        headerLabelColorTextSource: boxData.headerLabelColorText,
        leftLabelColorTextSource: boxData.leftLabelColorText,
        rightLabelColorTextSource: boxData.rightLabelColorText,
    });

    // Use the fetched values or fall back to manual labels
    const displayLabels = {
        header: variableValues.headerLabelSource || boxData.headerLabelSource,
        left: variableValues.leftLabelSource || boxData.leftLabelSource,
        right: variableValues.rightLabelSource || boxData.rightLabelSource,
        backgroundColor: variableValues.backgroundColorTextSource || boxData.backgroundColorText,
        headerColor: variableValues.headerColorTextSource || boxData.headerColorText,
        headerLabelColor: variableValues.headerLabelColorTextSource || boxData.headerLabelColorText,
        leftLabelColorTextSource: variableValues.leftLabelColorTextSource || boxData.leftLabelColorText,
        rightLabelColorTextSource: variableValues.rightLabelColorTextSource || boxData.rightLabelColorText,
    };

    // HTML versions for markdown rendering - need to parse even the fallback values
    const parseMarkdownFallback = (text: string): string => {
        if (!text) return '';
        return text
            // Handle escaped characters first (replace \* with placeholder, etc.)
            .replace(/\\(\*|_|\[|\]|\(|\)|!)/g, 'ESCAPED_$1_PLACEHOLDER')
            // Bold: **text** or __text__
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.*?)__/g, '<strong>$1</strong>')
            // Italic: *text* or _text_
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/_(.*?)_/g, '<em>$1</em>')
            // Images: ![alt](url)
            .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; height: auto;" />')
            // Links: [text](url)
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
            // Line breaks
            .replace(/\n/g, '<br>')
            // Restore escaped characters
            .replace(/ESCAPED_(.?)_PLACEHOLDER/g, '$1');
    };

    const displayHtmlLabels = useMemo(() => ({
        header: variableHtmlValues.headerLabelSource || parseMarkdownFallback(boxData.headerLabelSource),
        left: variableHtmlValues.leftLabelSource || parseMarkdownFallback(boxData.leftLabelSource),
        right: variableHtmlValues.rightLabelSource || parseMarkdownFallback(boxData.rightLabelSource),
    }), [variableHtmlValues.headerLabelSource, variableHtmlValues.leftLabelSource, variableHtmlValues.rightLabelSource, boxData.headerLabelSource, boxData.leftLabelSource, boxData.rightLabelSource]);

    // Memoize styles to prevent unnecessary re-renders
    const headerStyle = useMemo(() => ({
        backgroundColor: boxData.headerColorText ? displayLabels.headerColor : boxData.headerColor,
        color: boxData.headerLabelColorText ? displayLabels.headerLabelColor : boxData.headerLabelColor,
        fontSize: `${boxData.headerLabelSize}px`,
        fontWeight: boxData.headerLabelBold ? 'bold' : 'normal',
        textAlign: 'center' as const,
        display: boxData.headerLabelVisible ? 'flex' : 'none',
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
    }), [
        boxData.headerColorText, displayLabels.headerColor, boxData.headerColor,
        boxData.headerLabelColorText, displayLabels.headerLabelColor, boxData.headerLabelColor,
        boxData.headerLabelSize, boxData.headerLabelBold, boxData.headerLabelVisible
    ]);

    const leftStyle = useMemo(() => ({
        color: boxData.leftLabelColorText ? displayLabels.leftLabelColorTextSource : boxData.leftLabelColor,
        fontSize: `${boxData.leftLabelSize}px`,
        fontWeight: boxData.leftLabelBold ? 'bold' : 'normal',
        display: boxData.leftVisible ? 'flex' : 'none',
        justifyContent: boxData.rightVisible ? 'flex-start' : 'center',
        textAlign: boxData.rightVisible ? 'left' as const : 'center' as const,
        alignItems: 'center' as const,
    }), [
        boxData.leftLabelColorText, displayLabels.leftLabelColorTextSource, boxData.leftLabelColor,
        boxData.leftLabelSize, boxData.leftLabelBold, boxData.leftVisible,
        boxData.rightVisible
    ]);

    const rightStyle = useMemo(() => ({
        color: boxData.rightLabelColorText ? displayLabels.rightLabelColorTextSource : boxData.rightLabelColor,
        fontSize: `${boxData.rightLabelSize}px`,
        fontWeight: boxData.rightLabelBold ? 'bold' : 'normal',
        display: boxData.rightVisible ? 'flex' : 'none',
        justifyContent: boxData.leftVisible ? 'flex-end' : 'center',
        textAlign: boxData.leftVisible ? 'right' as const : 'center' as const,
        alignItems: 'center' as const,
    }), [
        boxData.rightLabelColorText, displayLabels.rightLabelColorTextSource, boxData.rightLabelColor,
        boxData.rightLabelSize, boxData.rightLabelBold, boxData.rightVisible,
        boxData.leftVisible
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
                            backgroundColor: boxData.backgroundColorText ? displayLabels.backgroundColor : boxData.backgroundColor,
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