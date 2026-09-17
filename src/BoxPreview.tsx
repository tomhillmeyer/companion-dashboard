import { useRef, useLayoutEffect, useState, useEffect, memo } from 'react';
import type { BoxData, ColorLayer, ImageLayer, TextLayer, UrlLayer, VideoLayer, LayerOverlay } from './types';
import { isImageUrl } from './boxMigration';
import { resolveLayerColor, resolveLayerRadius, computeLayerOverlaySize, computeBoxOpacity, getImageFromDB } from './layerUtils';
import { parseMarkdown, resolveSourceValue } from './useVariableFetcher';
import { FaVideoSlash } from 'react-icons/fa6';
import './Box.css';
import './BoxPreview.css';

interface BoxPreviewProps {
    boxData: BoxData;
    variableValues?: { [key: string]: string };
    variableHtmlValues?: { [key: string]: string };
    variableLookup?: { [key: string]: string };
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

// Memoized HTML container: guards dangerouslySetInnerHTML against re-sets when the
// resolved content is unchanged (React 19 diffs the __html object by reference, so a
// fresh object every render would wipe and re-create iframes on idle re-renders).
const MemoContent = memo(({ html, style }: { html: string; style: React.CSSProperties }) => (
    <div className="content" style={style} dangerouslySetInnerHTML={{ __html: html }} />
), (prevProps, nextProps) =>
    prevProps.html === nextProps.html &&
    JSON.stringify(prevProps.style) === JSON.stringify(nextProps.style)
);

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
const ImageLayerPreview = ({ layer, variableValues, variableLookup, borderRadius }: { layer: ImageLayer; variableValues?: { [key: string]: string }; variableLookup?: { [key: string]: string }; borderRadius: number }) => {
    const [loadedImage, setLoadedImage] = useState<string>('');
    const values = variableValues || {};

    const resolvedSource = (variableLookup
        ? resolveSourceValue(layer.imageSrc || '', variableLookup)
        : (values[`${layer.id}_imageSrc`] || '').trim()
    ).trim();
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
    const mask = layer.mask;
    const hasMask = !!mask && (mask.top > 0 || mask.bottom > 0 || mask.left > 0 || mask.right > 0);
    const needsClip = hasMask || !!layer.radius;

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
                ...(needsClip
                    ? { clipPath: `inset(${mask?.top || 0}% ${mask?.right || 0}% ${mask?.bottom || 0}% ${mask?.left || 0}% round ${radius.topLeft}px ${radius.topRight}px ${radius.bottomRight}px ${radius.bottomLeft}px)` }
                    : {}),
            }} />
            <OverlayPreview overlay={layer.overlay} layerId={layer.id} variableValues={values} />
        </div>
    );
};

// ---- URL layer -------------------------------------------------------------
const UrlLayerPreview = ({ layer, variableValues, variableLookup, borderRadius }: { layer: UrlLayer; variableValues?: { [key: string]: string }; variableLookup?: { [key: string]: string }; borderRadius: number }) => {
    const values = variableValues || {};

    const resolvedUrl = (variableLookup
        ? resolveSourceValue(layer.urlSrc || '', variableLookup)
        : (values[`${layer.id}_urlSrc`] || '').trim()
    ).trim();
    const effectiveUrl = resolvedUrl || layer.urlSrc || '';

    if (!effectiveUrl) return null;

    const radius = resolveLayerRadius(layer.radius, borderRadius);
    const offsetX = layer.offsetX ?? 0;
    const offsetY = layer.offsetY ?? 0;
    const mask = layer.mask;
    const maskTop = mask?.top || 0;
    const maskRight = mask?.right || 0;
    const maskBottom = mask?.bottom || 0;
    const maskLeft = mask?.left || 0;
    const vFactor = (100 - (maskTop + maskBottom)) / 100 || 1;
    const hFactor = (100 - (maskLeft + maskRight)) / 100 || 1;

    return (
        <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            pointerEvents: 'none',
            ...((offsetX || offsetY) ? { transform: `translate(${offsetX}px, ${offsetY}px)` } : {}),
        }}>
            <div style={{
                position: 'absolute',
                top: `${mask?.top || 0}%`,
                right: `${mask?.right || 0}%`,
                bottom: `${mask?.bottom || 0}%`,
                left: `${mask?.left || 0}%`,
                overflow: 'hidden',
                opacity: (layer.urlOpacity ?? 100) / 100,
                ...(layer.radius
                    ? { borderRadius: `${radius.topLeft}px ${radius.topRight}px ${radius.bottomRight}px ${radius.bottomLeft}px` }
                    : {}),
            }}>
                <iframe
                    src={effectiveUrl}
                    title={`URL layer ${layer.id}`}
                    style={{
                        position: 'absolute',
                        top: `${-maskTop / vFactor}%`,
                        left: `${-maskLeft / hFactor}%`,
                        width: `${100 / hFactor}%`,
                        height: `${100 / vFactor}%`,
                        border: 'none',
                        pointerEvents: 'none',
                    }}
                />
            </div>
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
    const mask = layer.mask;
    const maskTop = mask?.top || 0;
    const maskRight = mask?.right || 0;
    const maskBottom = mask?.bottom || 0;
    const maskLeft = mask?.left || 0;
    const vFactor = (100 - (maskTop + maskBottom)) / 100 || 1;
    const hFactor = (100 - (maskLeft + maskRight)) / 100 || 1;

    const videoContent = (() => {
        if (videoError) {
            return (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: '#111',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none',
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
                        position: 'absolute',
                        top: `${-maskTop / vFactor}%`,
                        left: `${-maskLeft / hFactor}%`,
                        width: `${100 / hFactor}%`,
                        height: `${100 / vFactor}%`,
                        objectFit: layer.videoSize || 'cover',
                        pointerEvents: 'none',
                    }}
                />
            );
        }

        const videoWidth = videoNaturalSize?.width ?? 1920;
        const videoHeight = videoNaturalSize?.height ?? 1080;
        const roiAspectRatio = (videoWidth * roi.width / 100) / (videoHeight * roi.height / 100);

        return (
            <div style={{
                position: 'absolute',
                top: `${-maskTop / vFactor}%`,
                left: `${-maskLeft / hFactor}%`,
                width: `${100 / hFactor}%`,
                height: `${100 / vFactor}%`,
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
            <div style={{
                position: 'absolute',
                top: `${mask?.top || 0}%`,
                right: `${mask?.right || 0}%`,
                bottom: `${mask?.bottom || 0}%`,
                left: `${mask?.left || 0}%`,
                overflow: 'hidden',
                ...(videoRadius ? { borderRadius: videoRadius } : {}),
            }}>
                {videoContent}
            </div>
            <OverlayPreview overlay={layer.overlay} layerId={layer.id} variableValues={variableValues || {}} />
        </div>
    );
};

// ---- Text layer ------------------------------------------------------------
const TextLayerPreview = ({ layer, variableValues, variableHtmlValues, variableLookup }: { layer: TextLayer; variableValues?: { [key: string]: string }; variableHtmlValues?: { [key: string]: string }; variableLookup?: { [key: string]: string } }) => {
    const values = variableValues || {};

    const rawSource = layer.source || '';
    const htmlValue = variableHtmlValues?.[`${layer.id}_label`];
    const hasVariables = /\$\([^)]+\)/.test(rawSource);
    const html = hasVariables && variableLookup
        ? parseMarkdown(resolveSourceValue(rawSource, variableLookup))
        : hasVariables
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

    const wrap = layer.wrap || 'word';
    const wrapStyle = wrap === 'letter'
        ? { overflowWrap: 'anywhere' as const, wordBreak: 'break-all' as const }
        : wrap === 'ellipsis' || wrap === 'truncate'
            ? {
                display: 'block' as const,
                whiteSpace: 'nowrap' as const,
                overflow: 'hidden' as const,
                textOverflow: (wrap === 'ellipsis' ? 'ellipsis' : 'clip') as 'ellipsis' | 'clip',
            }
            : { whiteSpace: 'normal' as const, overflowWrap: 'normal' as const };

    const maxWidth = layer.maxWidth ?? 100;
    const maxHeight = layer.maxHeight ?? 100;
    const hasArea = maxWidth < 100 || maxHeight < 100;
    const isWrapMode = wrap === 'word' || wrap === 'letter';
    const scrollable = layer.scrollable === true && isWrapMode;
    const areaStyle = scrollable
        ? {
            maxWidth: `${maxWidth}%`,
            maxHeight: `${maxHeight}%`,
            overflow: 'auto' as const,
            display: 'block' as const,
        }
        : hasArea
            ? {
                maxWidth: `${maxWidth}%`,
                maxHeight: `${maxHeight}%`,
                overflow: 'hidden' as const,
            }
            : isWrapMode ? { overflow: 'visible' as const } : {};

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
            <MemoContent
                html={isTextOnly(html)
                    ? `<span class="text-only-content">${html}</span>`
                    : html}
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
                    ...wrapStyle,
                    ...areaStyle,
                }}
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
export default function BoxPreview({ boxData, variableValues, variableHtmlValues, variableLookup }: BoxPreviewProps) {
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
                        opacity: computeBoxOpacity(boxData, variableValues || {}),
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
                            return <ImageLayerPreview key={layer.id} layer={layer} variableValues={variableValues} variableLookup={variableLookup} borderRadius={borderRadius} />;
                        }
                        if (layer.type === 'video') {
                            return <VideoLayerPreview key={layer.id} layer={layer} variableValues={variableValues} borderRadius={borderRadius} />;
                        }
                        if (layer.type === 'url') {
                            return <UrlLayerPreview key={layer.id} layer={layer} variableValues={variableValues} variableLookup={variableLookup} borderRadius={borderRadius} />;
                        }
                        return <TextLayerPreview key={layer.id} layer={layer} variableValues={variableValues} variableHtmlValues={variableHtmlValues} variableLookup={variableLookup} />;
                    })}
                </div>
            </div>
        </div>
    );
}