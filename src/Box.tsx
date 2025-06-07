import { useEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import Moveable from 'react-moveable';
import './Box.css';
import type { BoxData } from './App';
import BoxSettingsModal from './BoxSettingsModal';
import { useVariableFetcher } from './useVariableFetcher';
import { DoubleTapBox } from './DoubleTapBox';


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




    // Use the variable fetcher
    const variableValues = useVariableFetcher(companionBaseUrl, {
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
                        <div
                            className='header'
                            style={{
                                backgroundColor: boxData.headerColorText ? displayLabels.headerColor : boxData.headerColor,
                                color: boxData.headerLabelColorText ? displayLabels.headerLabelColor : boxData.headerLabelColor,
                                fontSize: `${boxData.headerLabelSize}px`,
                                fontWeight: boxData.headerLabelBold ? 'bold' : 'normal',
                                textAlign: 'center',
                                display: boxData.headerLabelVisible ? 'flex' : 'none',
                            }}
                        >
                            {displayLabels.header}
                        </div>

                        {/* Body with left and right labels */}
                        <div className='content-container'>
                            <div className='content' style={{
                                color: boxData.leftLabelColorText ? displayLabels.leftLabelColorTextSource : boxData.leftLabelColor,
                                fontSize: `${boxData.leftLabelSize}px`,
                                fontWeight: boxData.leftLabelBold ? 'bold' : 'normal',
                                display: boxData.leftVisible ? 'flex' : 'none',
                                justifyContent: boxData.rightVisible ? 'left' : 'center',
                                textAlign: boxData.rightVisible ? 'left' : 'center',
                            }}>
                                {displayLabels.left}
                            </div>
                            <div className='content' style={{
                                color: boxData.rightLabelColorText ? displayLabels.rightLabelColorTextSource : boxData.rightLabelColor,
                                fontSize: `${boxData.rightLabelSize}px`,
                                fontWeight: boxData.rightLabelBold ? 'bold' : 'normal',
                                display: boxData.rightVisible ? 'flex' : 'none',
                                justifyContent: boxData.leftVisible ? 'right' : 'center',
                                textAlign: boxData.leftVisible ? 'right' : 'center',
                            }}>
                                {displayLabels.right}
                            </div>
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