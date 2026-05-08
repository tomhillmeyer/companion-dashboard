import { useRef, useLayoutEffect, useState, useEffect } from 'react';
import type { BoxData } from './types';
import { evaluateComparison } from './variableComparison';
import { FaVideoSlash } from 'react-icons/fa6';
import './Box.css';
import './BoxPreview.css';

interface BoxPreviewProps {
    boxData: BoxData;
    variableValues?: { [key: string]: string };
}

const MAX_PREVIEW_HEIGHT = () => window.innerHeight * 0.4;

const justifyMap: { [key: string]: 'flex-start' | 'center' | 'flex-end' } = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
};

function resolveColor(
    variableColors: any[],
    colorText: string,
    fallback: string,
    variableValues: { [key: string]: string } | undefined,
    sourceKey?: string
): string {
    if (!variableValues) return fallback;

    if (variableColors && Array.isArray(variableColors)) {
        for (const varColor of variableColors) {
            if (varColor && varColor.variable && varColor.value) {
                const val = variableValues[varColor.variable] || '';
                if (evaluateComparison(val, varColor.operator, varColor.value)) {
                    return varColor.color || '';
                }
            }
        }
    }

    if (colorText && colorText.trim()) {
        return (sourceKey ? variableValues[sourceKey] : undefined) || colorText;
    }

    return fallback;
}

export default function BoxPreview({ boxData, variableValues }: BoxPreviewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(() => window.innerWidth * 0.4);
    const videoRef = useRef<HTMLVideoElement>(null);
    const currentStreamRef = useRef<MediaStream | null>(null);
    const [videoError, setVideoError] = useState(false);
    const [videoNaturalSize, setVideoNaturalSize] = useState<{ width: number; height: number } | null>(null);

    useLayoutEffect(() => {
        if (containerRef.current) {
            setContainerWidth(containerRef.current.clientWidth);
        }
    }, []);

    // Effect 1: Stream setup and cleanup
    useEffect(() => {
        const deviceId = boxData.backgroundVideoDeviceId;
        setVideoError(false);
        setVideoNaturalSize(null);

        if (!deviceId) {
            if (videoRef.current) videoRef.current.srcObject = null;
            currentStreamRef.current = null;
            return;
        }

        let cancelled = false;
        let acquiredStream: MediaStream | null = null;

        const setup = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { deviceId: { exact: deviceId } },
                    audio: false,
                });
                if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
                acquiredStream = stream;
                currentStreamRef.current = stream;
                if (videoRef.current) videoRef.current.srcObject = stream;
            } catch (err) {
                if (!cancelled) {
                    console.warn('[BoxPreview] Video device unavailable:', err);
                    setVideoError(true);
                }
            }
        };

        setup();

        return () => {
            cancelled = true;
            currentStreamRef.current = null;
            if (videoRef.current) videoRef.current.srcObject = null;
            if (acquiredStream) acquiredStream.getTracks().forEach(t => t.stop());
        };
    }, [boxData.backgroundVideoDeviceId]);

    // Effect 2: Reassign stream after ROI toggle recreates the <video> element
    useEffect(() => {
        if (videoRef.current && currentStreamRef.current && !videoRef.current.srcObject) {
            videoRef.current.srcObject = currentStreamRef.current;
        }
    }, [boxData.backgroundVideoROI]);

    // Effect 3: Track video natural dimensions for correct ROI aspect ratio
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const onMetadata = () => {
            setVideoNaturalSize({ width: video.videoWidth, height: video.videoHeight });
        };
        video.addEventListener('loadedmetadata', onMetadata);
        if (video.videoWidth > 0 && video.videoHeight > 0) {
            setVideoNaturalSize({ width: video.videoWidth, height: video.videoHeight });
        }
        return () => video.removeEventListener('loadedmetadata', onMetadata);
    }, [boxData.backgroundVideoROI, boxData.backgroundVideoDeviceId]);

    const { width, height } = boxData.frame;
    const scale = Math.min(containerWidth / width, MAX_PREVIEW_HEIGHT() / height);
    const scaledWidth = Math.round(width * scale);
    const scaledHeight = Math.round(height * scale);

    const headerText = variableValues?.headerLabelSource ?? boxData.headerLabelSource;
    const leftText = variableValues?.leftLabelSource ?? boxData.leftLabelSource;
    const rightText = variableValues?.rightLabelSource ?? boxData.rightLabelSource;

    const ratio = boxData.leftRightRatio ?? 50;
    let leftWidth: number;
    let rightWidth: number;
    if (!boxData.leftVisible) {
        leftWidth = 0; rightWidth = 100;
    } else if (!boxData.rightVisible) {
        leftWidth = 100; rightWidth = 0;
    } else {
        leftWidth = ratio; rightWidth = 100 - ratio;
    }

    const borderRadius = boxData.borderRadius ?? 15;

    const bgColor = resolveColor(boxData.backgroundVariableColors, boxData.backgroundColorText, boxData.backgroundColor, variableValues, 'backgroundColorTextSource');
    const borderColor = resolveColor(boxData.borderVariableColors, boxData.borderColorText, boxData.borderColor, variableValues, 'borderColorTextSource');
    const overlayColor = resolveColor(boxData.overlayVariableColors, boxData.overlayColorText, boxData.overlayColor, variableValues, 'overlayColorTextSource');
    const headerBgColor = resolveColor(boxData.headerVariableColors, boxData.headerColorText, boxData.headerColor, variableValues, 'headerColorTextSource');
    const headerLabelColor = resolveColor(boxData.headerLabelVariableColors, boxData.headerLabelColorText, boxData.headerLabelColor, variableValues, 'headerLabelColorTextSource');
    const leftLabelColor = resolveColor(boxData.leftLabelVariableColors, boxData.leftLabelColorText, boxData.leftLabelColor, variableValues, 'leftLabelColorTextSource');
    const rightLabelColor = resolveColor(boxData.rightLabelVariableColors, boxData.rightLabelColorText, boxData.rightLabelColor, variableValues, 'rightLabelColorTextSource');

    const headerStyle: React.CSSProperties = {
        backgroundColor: headerBgColor || 'transparent',
        color: headerLabelColor || '#ffffff',
        fontSize: `${boxData.headerLabelSize}px`,
        fontFamily: boxData.headerLabelFont || undefined,
        textAlign: (boxData.headerLabelAlign || 'center') as 'left' | 'center' | 'right',
        display: boxData.headerLabelVisible ? 'flex' : 'none',
        justifyContent: justifyMap[boxData.headerLabelAlign || 'center'],
        borderRadius: `${borderRadius}px ${borderRadius}px 0 0`,
    };

    const leftStyle: React.CSSProperties = {
        color: leftLabelColor || '#ffffff',
        fontSize: `${boxData.leftLabelSize}px`,
        fontFamily: boxData.leftLabelFont || undefined,
        display: boxData.leftVisible ? 'flex' : 'none',
        justifyContent: justifyMap[boxData.leftLabelAlign || 'left'],
        textAlign: (boxData.leftLabelAlign || 'left') as 'left' | 'center' | 'right',
        alignItems: 'center',
        flexBasis: `${leftWidth}%`,
    };

    const rightStyle: React.CSSProperties = {
        color: rightLabelColor || '#ffffff',
        fontSize: `${boxData.rightLabelSize}px`,
        fontFamily: boxData.rightLabelFont || undefined,
        display: boxData.rightVisible ? 'flex' : 'none',
        justifyContent: justifyMap[boxData.rightLabelAlign || 'right'],
        textAlign: (boxData.rightLabelAlign || 'right') as 'left' | 'center' | 'right',
        alignItems: 'center',
        flexBasis: `${rightWidth}%`,
    };

    return (
        <div ref={containerRef} className="box-preview-outer">
            <div style={{
                position: 'relative',
                width: `${scaledWidth}px`,
                height: `${scaledHeight}px`,
                margin: '0 auto',
            }}>
                <div
                    className={`box ${boxData.noBorder ? 'no-border' : 'with-border'}`}
                    style={{
                        width: `${width}px`,
                        height: `${height}px`,
                        backgroundColor: bgColor || '#262626',
                        border: boxData.noBorder ? 'none' : `5px solid ${borderColor || '#61BAFA'}`,
                        borderRadius: `${borderRadius}px`,
                        opacity: boxData.opacity / 100,
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        cursor: 'default',
                    }}
                >
                    {/* Background image */}
                    {boxData.backgroundImage && (
                        <div style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            backgroundImage: `url("${boxData.backgroundImage}")`,
                            backgroundSize: boxData.backgroundImageSize || 'cover',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat',
                            opacity: boxData.backgroundImageOpacity ?? 1,
                            pointerEvents: 'none',
                            borderRadius: `${borderRadius}px`,
                        }} />
                    )}

                    {/* Video background layer */}
                    {boxData.backgroundVideoDeviceId && (() => {
                        if (videoError) {
                            return (
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                    backgroundColor: '#111',
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center',
                                    pointerEvents: 'none', borderRadius: `${borderRadius}px`,
                                    zIndex: 0, gap: '0.4em', color: '#888',
                                }}>
                                    <FaVideoSlash style={{ fontSize: '2em' }} />
                                    <span style={{ fontSize: '0.6em', textAlign: 'center' }}>
                                        Video preview unavailable
                                    </span>
                                </div>
                            );
                        }

                        const roi = boxData.backgroundVideoROI;

                        if (!roi) {
                            return (
                                <video
                                    key="preview-video-no-roi"
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    style={{
                                        position: 'absolute', top: 0, left: 0,
                                        width: '100%', height: '100%',
                                        objectFit: boxData.backgroundVideoSize || 'cover',
                                        pointerEvents: 'none',
                                        borderRadius: `${borderRadius}px`,
                                        zIndex: 0,
                                    }}
                                />
                            );
                        }

                        // With ROI — mirrors Box.tsx:976-1026
                        const videoWidth = videoNaturalSize?.width ?? 1920;
                        const videoHeight = videoNaturalSize?.height ?? 1080;
                        const roiAspectRatio = (videoWidth * roi.width / 100) / (videoHeight * roi.height / 100);

                        return (
                            <div style={{
                                position: 'absolute', top: 0, left: 0,
                                width: '100%', height: '100%',
                                pointerEvents: 'none', zIndex: 0,
                            }}>
                                <div style={{
                                    position: 'absolute', top: '50%', left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    aspectRatio: `${roiAspectRatio}`,
                                    ...(boxData.backgroundVideoSize === 'contain'
                                        ? { maxWidth: '100%', maxHeight: '100%', width: 'auto', height: '100%' }
                                        : { minWidth: '100%', minHeight: '100%' }),
                                    overflow: 'hidden',
                                }}>
                                    <video
                                        key="preview-video-roi"
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        style={{
                                            position: 'absolute',
                                            width: `${100 / roi.width * 100}%`,
                                            height: `${100 / roi.height * 100}%`,
                                            left: `${-roi.x / roi.width * 100}%`,
                                            top: `${-roi.y / roi.height * 100}%`,
                                            objectFit: 'fill',
                                            pointerEvents: 'none',
                                        }}
                                    />
                                </div>
                            </div>
                        );
                    })()}

                    {/* Overlay */}
                    <div style={{
                        position: 'absolute',
                        ...(boxData.overlayDirection === 'left' ? {
                            top: 0, left: 0, bottom: 0, width: `${boxData.overlaySize}%`
                        } : boxData.overlayDirection === 'right' ? {
                            top: 0, right: 0, bottom: 0, width: `${boxData.overlaySize}%`
                        } : boxData.overlayDirection === 'top' ? {
                            top: 0, left: 0, right: 0, height: `${boxData.overlaySize}%`
                        } : {
                            bottom: 0, left: 0, right: 0, height: `${boxData.overlaySize}%`
                        }),
                        backgroundColor: overlayColor || 'transparent',
                        pointerEvents: 'none',
                        zIndex: 1,
                    }} />

                    {/* Content wrapper */}
                    <div style={{
                        pointerEvents: 'none',
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        position: 'relative',
                        zIndex: 2,
                    }}>
                        <div className="header" style={headerStyle}>
                            <span className="text-only-content">{headerText}</span>
                        </div>
                        <div className="content-container">
                            <div className="content" style={leftStyle}>
                                <span className="text-only-content">{leftText}</span>
                            </div>
                            <div className="content" style={rightStyle}>
                                <span className="text-only-content">{rightText}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
