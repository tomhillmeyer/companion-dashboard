import { useRef, useLayoutEffect, useState, useEffect } from 'react';
import type { BoxData, ColorLayer, ImageLayer, TextLayer, VideoLayer, LayerOverlay } from './types';
import { isImageUrl } from './boxMigration';
import { resolveLayerColor, resolveLayerRadius, computeLayerOverlaySize, getImageFromDB } from './layerUtils';
import { parseMarkdown } from './useVariableFetcher';
import { FaVideoSlash } from 'react-icons/fa6';
import './Box.css';
import './BoxPreview.css';

interface BoxPreviewProps {
    boxData: BoxData;
    variableValues?: { [key: string]: string };
    variableHtmlValues?: { [key: string]: string };
}

const windowId = (window as any).electronAPI?.windowId || '1';

const MAX_PREVIEW_HEIGHT = () => window.innerHeight * 0.4;

function isTextOnly(html: string): boolean {
    return !/<img|<iframe|<video|!\[.*?\]\(.*?\)/i.test(html);
}

const justifyMap: { [key: string]: 'flex-start' | 'center' | 'flex-end' } = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
};

// ---- Color layer -----------------------------------------------------------
const ColorLayerPreview = ({ layer, variableValues, borderRadius }: { layer: ColorLayer; variableValues?: { [key: string]: string }; borderRadius: number }) => {
    const values = variableValues || {};
    const resolvedColor = resolveLayerColor(layer.variableColors, layer.colorText, layer.color || '#262626', values, `${layer.id}_colorText`);

    const backgroundColor = isImageUrl(resolvedColor) || !resolvedColor ? 'transparent' : resolvedColor;

    const mask = layer.mask;
    const hasMask = !!mask && (mask.top > 0 || mask.bottom > 0 || mask.left > 0 || mask.right > 0);
    const radius = resolveLayerRadius(layer.radius, borderRadius);
    const needsClip = hasMask || !!layer.radius;
    const offsetX = layer.offsetX ?? 0;
    const offsetY = layer.offsetY ?? 0;

    return (
        <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor,
            pointerEvents: 'none',
            ...(needsClip
                ? { clipPath: `inset(${mask?.top || 0}% ${mask?.right || 0}% ${mask?.bottom || 0}% ${mask?.left || 0}% round ${radius.topLeft}px ${radius.topRight}px ${radius.bottomRight}px ${radius.bottomLeft}px)` }
                : {}),
            ...((offsetX || offsetY) ? { transform: `translate(${offsetX}px, ${offsetY}px)` } : {}),
        }} />
    );
};

// ---- Image layer -----------------------------------------------------------
const ImageLayerPreview = ({ layer, variableValues, borderRadius }: { layer: ImageLayer; variableValues?: { [key: string]: string }; borderRadius: number }) => {
    const [loadedImage, setLoadedImage] = useState<string>('');
    const values = variableValues || {};

    const resolvedSource = (values[`${layer.id}_imageSrc`] || '').trim();
    const effectiveSrc = isImageUrl(resolvedSource) ? resolvedSource : layer.imageSrc || '';

    useEffect(() => {
        const loadImage = async () => {
            if (!effectiveSrc) {
                setLoadedImage('');
                return;
            }

            try {
                // If it's already a data URL or HTTP URL, use it directly
                if (isImageUrl(effectiveSrc) && !effectiveSrc.startsWith('./src/assets/')) {
                    setLoadedImage(effectiveSrc);
                    return;
                }

                // If it's a cached image path, load from storage
                if (effectiveSrc.startsWith('./src/assets/')) {
                    const filename = effectiveSrc.split('/').pop();
                    if (filename) {
                        try {
                            const cachedData = localStorage.getItem(`window_${windowId}_cached_bg_${filename}`);
                            if (cachedData) {
                                setLoadedImage(cachedData);
                                return;
                            }

                            const imageData = await getImageFromDB(filename);
                            if (imageData) {
                                setLoadedImage(imageData);
                                return;
                            }
                        } catch (error) {
                            console.error('Failed to load background image:', error);
                        }
                    }
                }
            } catch (error) {
                console.error('Error in loadImage:', error);
            }

            setLoadedImage('');
        };

        loadImage();
    }, [effectiveSrc]);

    if (!loadedImage) return null;

    const radius = resolveLayerRadius(layer.radius, borderRadius);
    const offsetX = layer.offsetX ?? 0;
    const offsetY = layer.offsetY ?? 0;

    return (
        <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            pointerEvents: 'none',
            ...((offsetX || offsetY) ? { transform: `translate(${offsetX}px, ${offsetY}px)` } : {}),
        }}>
            <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundImage: `url("${loadedImage}")`,
                backgroundSize: layer.imageSize || 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                opacity: (layer.imageOpacity ?? 100) / 100,
                pointerEvents: 'none',
                ...(layer.radius
                    ? { clipPath: `inset(0 round ${radius.topLeft}px ${radius.topRight}px ${radius.bottomRight}px ${radius.bottomLeft}px)` }
                    : {}),
            }} />
            <OverlayPreview overlay={layer.overlay} layerId={layer.id} variableValues={values} />
        </div>
    );
};

// ---- Video layer -----------------------------------------------------------
const VideoLayerPreview = ({ layer, variableValues, borderRadius }: { layer: VideoLayer; variableValues?: { [key: string]: string }; borderRadius: number }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const currentStreamRef = useRef<MediaStream | null>(null);
    const [videoError, setVideoError] = useState(false);
    const [videoNaturalSize, setVideoNaturalSize] = useState<{ width: number; height: number } | null>(null);

    // Stream setup and cleanup
    useEffect(() => {
        const deviceId = layer.deviceId;
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
    }, [layer.deviceId]);

    // Reassign stream after ROI toggle recreates the <video> element
    useEffect(() => {
        if (videoRef.current && currentStreamRef.current && !videoRef.current.srcObject) {
            videoRef.current.srcObject = currentStreamRef.current;
        }
    }, [layer.roi, layer.deviceId]);

    // Track video natural dimensions for correct ROI aspect ratio
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
    }, [layer.roi, layer.deviceId]);

    if (!layer.deviceId) return null;

    const roi = layer.roi;
    const radius = resolveLayerRadius(layer.radius, borderRadius);
    const videoRadius = layer.radius
        ? `${radius.topLeft}px ${radius.topRight}px ${radius.bottomRight}px ${radius.bottomLeft}px`
        : undefined;
    const offsetX = layer.offsetX ?? 0;
    const offsetY = layer.offsetY ?? 0;

    const videoContent = (() => {
        if (videoError) {
            return (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: '#111',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none', ...(videoRadius ? { borderRadius: videoRadius } : {}),
                    gap: '0.4em', color: '#888',
                }}>
                    <FaVideoSlash style={{ fontSize: '2em' }} />
                    <span style={{ fontSize: '0.6em', textAlign: 'center' }}>
                        Video preview unavailable
                    </span>
                </div>
            );
        }

        if (!roi) {
            return (
                <video
                    key={`preview-${layer.id}-no-roi`}
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                        position: 'absolute', top: 0, left: 0,
                        width: '100%', height: '100%',
                        objectFit: layer.videoSize || 'cover',
                        pointerEvents: 'none',
                        ...(videoRadius ? { borderRadius: videoRadius } : {}),
                    }}
                />
            );
        }

        const videoWidth = videoNaturalSize?.width ?? 1920;
        const videoHeight = videoNaturalSize?.height ?? 1080;
        const roiAspectRatio = (videoWidth * roi.width / 100) / (videoHeight * roi.height / 100);

        return (
            <div style={{
                position: 'absolute', top: 0, left: 0,
                width: '100%', height: '100%',
                pointerEvents: 'none',
            }}>
                <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    aspectRatio: `${roiAspectRatio}`,
                    ...(layer.videoSize === 'contain'
                        ? { maxWidth: '100%', maxHeight: '100%', width: 'auto', height: '100%' }
                        : { minWidth: '100%', minHeight: '100%' }),
                    overflow: 'hidden',
                    ...(videoRadius ? { borderRadius: videoRadius } : {}),
                }}>
                    <video
                        key={`preview-${layer.id}-roi`}
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
    })();

    return (
        <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            pointerEvents: 'none',
            ...((offsetX || offsetY) ? { transform: `translate(${offsetX}px, ${offsetY}px)` } : {}),
        }}>
            {videoContent}
            <OverlayPreview overlay={layer.overlay} layerId={layer.id} variableValues={variableValues || {}} />
        </div>
    );
};

// ---- Text layer ------------------------------------------------------------
const TextLayerPreview = ({ layer, variableValues, variableHtmlValues }: { layer: TextLayer; variableValues?: { [key: string]: string }; variableHtmlValues?: { [key: string]: string } }) => {
    const values = variableValues || {};

    const rawSource = layer.source || '';
    const htmlValue = variableHtmlValues?.[`${layer.id}_label`];
    const html = rawSource && /\$\([^)]+\)/.test(rawSource)
        ? (htmlValue ?? rawSource)
        : parseMarkdown(rawSource);

    const color = resolveLayerColor(layer.variableColors, layer.colorText, layer.color || '#ffffff', values, `${layer.id}_colorText`);

    const offsetX = layer.offsetX ?? 0;
    const offsetY = layer.offsetY ?? 0;

    const align = layer.align || 'center';
    const alignVertical = layer.alignVertical || 'middle';
    const verticalJustifyMap: { [key: string]: 'flex-start' | 'center' | 'flex-end' } = {
        top: 'flex-start',
        middle: 'center',
        bottom: 'flex-end',
    };

    return (
        <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            display: layer.visible ? 'flex' : 'none',
            alignItems: verticalJustifyMap[alignVertical],
            justifyContent: justifyMap[align],
            pointerEvents: 'none',
            ...((offsetX || offsetY) ? { transform: `translate(${offsetX}px, ${offsetY}px)` } : {}),
        }}>
            <div
                className="content"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: 'fit-content',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    color,
                    fontSize: `${layer.size}px`,
                    fontFamily: layer.font || undefined,
                    textAlign: align as 'left' | 'center' | 'right',
                }}
                dangerouslySetInnerHTML={{ __html: isTextOnly(html)
                    ? `<span class="text-only-content">${html}</span>`
                    : html }}
            />
        </div>
    );
};

// ---- Overlay (per image/video layer) ---------------------------------------
const OverlayPreview = ({ overlay, layerId, variableValues }: { overlay: LayerOverlay; layerId: string; variableValues: { [key: string]: string } }) => {
    const size = computeLayerOverlaySize(overlay, layerId, variableValues);
    const color = resolveLayerColor(overlay.variableColors, overlay.colorText, overlay.color || '#00000000', variableValues, `${layerId}_colorText`);

    return (
        <div style={{
            position: 'absolute',
            ...(overlay.direction === 'left' ? {
                top: 0, left: 0, bottom: 0, width: `${size}%`
            } : overlay.direction === 'right' ? {
                top: 0, right: 0, bottom: 0, width: `${size}%`
            } : overlay.direction === 'top' ? {
                top: 0, left: 0, right: 0, height: `${size}%`
            } : {
                bottom: 0, left: 0, right: 0, height: `${size}%`
            }),
            backgroundColor: color,
            pointerEvents: 'none',
        }} />
    );
};

// ============================================================================
// BoxPreview
// ============================================================================
export default function BoxPreview({ boxData, variableValues, variableHtmlValues }: BoxPreviewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(() => window.innerWidth * 0.4);

    useLayoutEffect(() => {
        if (containerRef.current) {
            setContainerWidth(containerRef.current.clientWidth);
        }
    }, []);

    const { width, height } = boxData.frame;
    const scale = Math.min(1, containerWidth / width, MAX_PREVIEW_HEIGHT() / height);
    const scaledWidth = Math.round(width * scale);
    const scaledHeight = Math.round(height * scale);

    const borderRadius = boxData.borderRadius ?? 15;

    const borderColor = resolveLayerColor(boxData.borderVariableColors, boxData.borderColorText, boxData.borderColor, variableValues || {}, 'borderColorTextSource');

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
                        backgroundColor: 'transparent',
                        border: boxData.noBorder ? 'none' : `5px solid ${borderColor || '#61BAFA'}`,
                        borderRadius: `${borderRadius}px`,
                        clipPath: `inset(0 round ${borderRadius}px)`,
                        opacity: boxData.opacity / 100,
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        cursor: 'default',
                    }}
                >
                    {(boxData.layers || []).slice().reverse().map(layer => {
                        if (layer.type === 'color') {
                            return <ColorLayerPreview key={layer.id} layer={layer} variableValues={variableValues} borderRadius={borderRadius} />;
                        }
                        if (layer.type === 'image') {
                            return <ImageLayerPreview key={layer.id} layer={layer} variableValues={variableValues} borderRadius={borderRadius} />;
                        }
                        if (layer.type === 'video') {
                            return <VideoLayerPreview key={layer.id} layer={layer} variableValues={variableValues} borderRadius={borderRadius} />;
                        }
                        return <TextLayerPreview key={layer.id} layer={layer} variableValues={variableValues} variableHtmlValues={variableHtmlValues} />;
                    })}
                </div>
            </div>
        </div>
    );
}