import React, { useEffect, useRef, useState, useMemo, useLayoutEffect } from 'react';

// Get window ID for isolated storage
const windowId = (window as any).electronAPI?.windowId || '1';
import { v4 as uuid } from 'uuid';
import Moveable from 'react-moveable';
import './Box.css';
import type { AnimationSettings, BoxData, ColorLayer, CompanionConnection, ImageLayer, LayerOverlay, PageData, TextLayer, UrlLayer, VideoLayer } from './types';
import BoxSettingsModal from './BoxSettingsModal';
import { useVariableFetcher } from './useVariableFetcher';
import { DoubleTapBox } from './DoubleTapBox';
import type { VideoRelayManager } from './VideoRelayManager';
import { evaluateComparison } from './variableComparison';
import { isImageUrl, duplicateLayers } from './boxMigration';
import { resolveLayerColor, resolveLayerRadius, computeLayerOverlaySize, getImageFromDB } from './layerUtils';

// ============================================================================
// Component for rendering markdown content
// ============================================================================
const MarkdownContent = React.memo(({
    content,
    style,
    className = '',
    onAnimationEnd
}: {
    content: string;
    style: React.CSSProperties;
    className?: string;
    onAnimationEnd?: (e: React.AnimationEvent<HTMLDivElement>) => void;
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
            onAnimationEnd={onAnimationEnd}
            dangerouslySetInnerHTML={{ __html: processedContent }}
        />
    );
}, (prevProps, nextProps) => {
    // Custom comparison to prevent unnecessary re-renders
    // (onAnimationEnd omitted intentionally - doesn't affect rendering)
    return prevProps.content === nextProps.content &&
           prevProps.className === nextProps.className &&
           JSON.stringify(prevProps.style) === JSON.stringify(nextProps.style);
});

// ============================================================================
// Layer sub-components (each layer is an absolutely-positioned, full-bleed view)
// ============================================================================

// ---- Color layer -----------------------------------------------------------
const ColorLayerView = React.memo(({
    layer,
    variableValues,
    colorAnimation,
    animationDuration,
    borderRadius,
}: {
    layer: ColorLayer;
    variableValues: { [key: string]: string };
    colorAnimation: AnimationSettings['colorAnimation'];
    animationDuration: number;
    borderRadius: number;
}) => {
    const resolvedColor = resolveLayerColor(layer.variableColors, layer.colorText, layer.color || '#262626', variableValues, `${layer.id}_colorText`);

    // Legacy boxes could point a color layer's text at an image URL; those become
    // separate image layers during migration, but guard here to be safe.
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
            ...(colorAnimation === 'fade' ? { transition: `background-color ${animationDuration}ms ease` } : {}),
        }} />
    );
});

// ---- Image layer -----------------------------------------------------------
const ImageLayerView = React.memo(({
    layer,
    boxId,
    variableValues,
    backgroundImageAnimation,
    colorAnimation,
    animationDuration,
    borderRadius,
}: {
    layer: ImageLayer;
    boxId: string;
    variableValues: { [key: string]: string };
    backgroundImageAnimation: AnimationSettings['backgroundImageAnimation'];
    colorAnimation: AnimationSettings['colorAnimation'];
    animationDuration: number;
    borderRadius: number;
}) => {
    const [loadedImage, setLoadedImage] = useState<string>('');

    // Resolve the layer source (supports Companion variables that evaluate to image URLs)
    const resolvedSource = (variableValues[`${layer.id}_imageSrc`] || '').trim();
    const effectiveSrc = isImageUrl(resolvedSource) ? resolvedSource : layer.imageSrc || '';

    // Load image from storage when the source changes
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
                            // Try IndexedDB first
                            const imageData = await getImageFromDB(filename);
                            if (imageData) {
                                setLoadedImage(imageData);
                                return;
                            }

                            // Fallback to localStorage
                            const cachedData = localStorage.getItem(`window_${windowId}_cached_bg_${filename}`);
                            if (cachedData) {
                                setLoadedImage(cachedData);
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

    // Change-detection for the image URL (same animation pattern as text layers).
    // Starts at null (not yet seeded): first non-empty value is the baseline without animation.
    const prevRef = useRef<string | null>(null);
    const [animating, setAnimating] = useState(false);
    const currentUrl = loadedImage || '';
    const prev = prevRef.current;
    const didChange = prev !== null && prev !== currentUrl && !!currentUrl;
    prevRef.current = (prev !== null || !!currentUrl) ? currentUrl : null;

    const shouldAnimate = didChange && backgroundImageAnimation !== 'none' && !!currentUrl;
    useLayoutEffect(() => {
        if (shouldAnimate) setAnimating(true);
    }, [shouldAnimate]);

    const handleEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
        if (e.animationName?.startsWith('box-')) {
            setAnimating(false);
        }
    };

    const animate = animating && backgroundImageAnimation !== 'none';

    if (!currentUrl) return null;

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
            <div
                className={animate ? `anim-${backgroundImageAnimation}` : undefined}
                onAnimationEnd={handleEnd}
                style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundImage: `url("${currentUrl}")`,
                    backgroundSize: layer.imageSize,
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    opacity: (layer.imageOpacity ?? 100) / 100,
                    pointerEvents: 'none',
                    ...(needsClip
                        ? { clipPath: `inset(${mask?.top || 0}% ${mask?.right || 0}% ${mask?.bottom || 0}% ${mask?.left || 0}% round ${radius.topLeft}px ${radius.topRight}px ${radius.bottomRight}px ${radius.bottomLeft}px)` }
                        : {}),
                    ...(animate ? { animationDuration: `${animationDuration}ms` } : {}),
                }}
            />
            <LayerOverlayView
                overlay={layer.overlay}
                layerId={layer.id}
                boxId={boxId}
                variableValues={variableValues}
                colorAnimation={colorAnimation}
                animationDuration={animationDuration}
            />
        </div>
    );
});

// ---- Video layer -----------------------------------------------------------
const VideoLayerView = React.memo(({
    layer,
    boxId,
    videoRelayManager,
    variableValues,
    colorAnimation,
    animationDuration,
    borderRadius,
}: {
    layer: VideoLayer;
    boxId: string;
    videoRelayManager?: VideoRelayManager | null;
    variableValues: { [key: string]: string };
    colorAnimation: AnimationSettings['colorAnimation'];
    animationDuration: number;
    borderRadius: number;
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const currentStreamRef = useRef<MediaStream | null>(null);

    // Unique stream ID per layer so multiple video layers in one box don't collide
    const streamId = `${boxId}_${layer.id}`;
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

    // Handle video stream setup and cleanup
    useEffect(() => {
        const isWebClient = typeof window !== 'undefined' && !(window as any).electronAPI;
        const currentDeviceId = layer.deviceId;

        const setupVideoStream = async () => {
            // If no device ID is set, clean up and stop here
            if (!currentDeviceId) {
                if (videoRef.current) {
                    videoRef.current.srcObject = null;
                }
                return;
            }

            // Clean up any existing stream first (just clear the reference, don't stop tracks)
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject = null;
            }

            // Web client: Request video stream via WebRTC
            if (isWebClient) {
                if (!videoRelayManager) {
                    return;
                }
                console.log(`[Web Client] Requesting video stream for device: ${currentDeviceId}, layer: ${layer.id}, box: ${boxId}`);
                videoRelayManager.requestVideoStream(currentDeviceId, streamId, (stream) => {
                    console.log(`[Web Client] Received video stream for device: ${currentDeviceId}, layer: ${layer.id}, box: ${boxId}`);
                    currentStreamRef.current = stream;
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                });
                return;
            }

            // Electron host: Get stream from VideoRelayManager
            if (videoRelayManager) {
                console.log(`[Electron Host] Requesting stream for device: ${currentDeviceId}, layer: ${layer.id}, box: ${boxId}`);

                videoRelayManager.incrementDeviceRef(currentDeviceId);

                await videoRelayManager.startBroadcasting(currentDeviceId);

                const stream = videoRelayManager.getLocalStream(currentDeviceId);

                if (stream && videoRef.current) {
                    currentStreamRef.current = stream;
                    videoRef.current.srcObject = stream;
                    console.log(`[Electron Host] Set video stream for box: ${boxId}, layer: ${layer.id}`);
                } else {
                    console.error(`[Electron Host] Failed to get stream for device: ${currentDeviceId}`);
                }
            }
        };

        setupVideoStream();

        // Cleanup - uses captured currentDeviceId
        return () => {
            currentStreamRef.current = null;
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }

            if (videoRelayManager && currentDeviceId) {
                if (isWebClient) {
                    console.log(`[Web Client] Closing peer connection for device: ${currentDeviceId}, layer: ${layer.id}`);
                    videoRelayManager.closePeerConnection(currentDeviceId, streamId);
                } else {
                    console.log(`[Electron Host] Decrementing ref count for device: ${currentDeviceId}, layer: ${layer.id}`);
                    videoRelayManager.decrementDeviceRef(currentDeviceId);
                }
            }
        };
    }, [layer.deviceId, videoRelayManager, boxId, layer.id, streamId]);

    // When ROI is toggled on/off, React recreates the <video> element (different JSX structure).
    // The new element loses its srcObject — reassign the saved stream if it has none.
    useEffect(() => {
        if (videoRef.current && currentStreamRef.current && !videoRef.current.srcObject) {
            videoRef.current.srcObject = currentStreamRef.current;
        }
    }, [layer.roi, layer.deviceId]);

    if (!layer.deviceId) return null;

    const roi = layer.roi;

    const videoContent = (() => {
        if (!roi) {
            // No ROI - simple case, use objectFit directly
            return (
                <video
                    key={`video-${boxId}-${layer.id}-no-roi`}
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
                        zIndex: 0,
                    }}
                />
            );
        }

        // With ROI: create a "cropped container" with the ROI's aspect ratio, then scale
        // the actual video so only the ROI region shows.
        const videoWidth = videoRef.current?.videoWidth || 1920;
        const videoHeight = videoRef.current?.videoHeight || 1080;

        const roiPixelWidth = videoWidth * (roi.width / 100);
        const roiPixelHeight = videoHeight * (roi.height / 100);
        const roiAspectRatio = roiPixelWidth / roiPixelHeight;

        return (
            <div style={{
                position: 'absolute',
                top: `${-maskTop / vFactor}%`,
                left: `${-maskLeft / hFactor}%`,
                width: `${100 / hFactor}%`,
                height: `${100 / vFactor}%`,
                pointerEvents: 'none',
                zIndex: 0
            }}>
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    aspectRatio: `${roiAspectRatio}`,
                    ...(layer.videoSize === 'contain' ? {
                        maxWidth: '100%',
                        maxHeight: '100%',
                        width: 'auto',
                        height: '100%'
                    } : {
                        minWidth: '100%',
                        minHeight: '100%'
                    }),
                    overflow: 'hidden',
                }}>
                    <video
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
                            pointerEvents: 'none'
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
            <LayerOverlayView
                overlay={layer.overlay}
                layerId={layer.id}
                boxId={boxId}
                variableValues={variableValues}
                colorAnimation={colorAnimation}
                animationDuration={animationDuration}
            />
        </div>
    );
});

// ---- URL layer -------------------------------------------------------------
const UrlLayerView = React.memo(({
    layer,
    boxId,
    variableValues,
    colorAnimation,
    animationDuration,
    borderRadius,
    boxesLocked,
}: {
    layer: UrlLayer;
    boxId: string;
    variableValues: { [key: string]: string };
    colorAnimation: AnimationSettings['colorAnimation'];
    animationDuration: number;
    borderRadius: number;
    boxesLocked: boolean;
}) => {
    const resolvedUrl = (variableValues[`${layer.id}_urlSrc`] || '').trim();
    const effectiveUrl = resolvedUrl || layer.urlSrc || '';
    const offsetX = layer.offsetX ?? 0;
    const offsetY = layer.offsetY ?? 0;
    const radius = resolveLayerRadius(layer.radius, borderRadius);
    const boxRadius = layer.radius
        ? `${radius.topLeft}px ${radius.topRight}px ${radius.bottomRight}px ${radius.bottomLeft}px`
        : undefined;
    const mask = layer.mask;
    const topInset = `${mask?.top || 0}%`;
    const rightInset = `${mask?.right || 0}%`;
    const bottomInset = `${mask?.bottom || 0}%`;
    const leftInset = `${mask?.left || 0}%`;
    const maskTop = mask?.top || 0;
    const maskRight = mask?.right || 0;
    const maskBottom = mask?.bottom || 0;
    const maskLeft = mask?.left || 0;
    const vFactor = (100 - (maskTop + maskBottom)) / 100 || 1;
    const hFactor = (100 - (maskLeft + maskRight)) / 100 || 1;

    if (!effectiveUrl) return null;

    const iframeStyle: React.CSSProperties = {
        position: 'absolute',
        top: `${-maskTop / vFactor}%`,
        left: `${-maskLeft / hFactor}%`,
        width: `${100 / hFactor}%`,
        height: `${100 / vFactor}%`,
        display: 'block',
        border: 'none',
        pointerEvents: boxesLocked ? 'auto' : 'none',
    };

    return (
        <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            pointerEvents: boxesLocked ? 'auto' : 'none',
            ...((offsetX || offsetY) ? { transform: `translate(${offsetX}px, ${offsetY}px)` } : {}),
        }}>
            <div style={{
                position: 'absolute',
                top: topInset,
                right: rightInset,
                bottom: bottomInset,
                left: leftInset,
                overflow: 'hidden',
                opacity: (layer.urlOpacity ?? 100) / 100,
                ...(boxRadius ? { borderRadius: boxRadius } : {}),
            }}>
                <iframe
                    key={`${boxId}-${layer.id}`}
                    src={effectiveUrl}
                    title={`URL layer ${layer.id}`}
                    tabIndex={boxesLocked ? undefined : -1}
                    style={iframeStyle}
                />
            </div>
            <LayerOverlayView
                overlay={layer.overlay}
                layerId={layer.id}
                boxId={boxId}
                variableValues={variableValues}
                colorAnimation={colorAnimation}
                animationDuration={animationDuration}
            />
            {!boxesLocked && (
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    pointerEvents: 'auto',
                }} />
            )}
        </div>
    );
});

// ---- Text layer ------------------------------------------------------------
const TextLayerView = React.memo(({
    layer,
    boxId,
    variableValues,
    variableHtmlValues,
    textAnimation,
    colorAnimation,
    animationDuration,
    boxesLocked,
}: {
    layer: TextLayer;
    boxId: string;
    variableValues: { [key: string]: string };
    variableHtmlValues: { [key: string]: string };
    textAnimation: AnimationSettings['textAnimation'];
    colorAnimation: AnimationSettings['colorAnimation'];
    animationDuration: number;
    boxesLocked: boolean;
}) => {
    const current = (variableHtmlValues[`${layer.id}_label`] || '').trim();

    // Change-detection for animations (see comment in Box for the seeding pattern)
    const prevRef = useRef<string | null>(null);
    const [animating, setAnimating] = useState(false);
    const prev = prevRef.current;
    const didChange = prev !== null && prev !== current && !!current;
    prevRef.current = (prev !== null || !!current) ? current : null;

    const shouldAnimate = didChange && textAnimation !== 'none' && !!current;
    useLayoutEffect(() => {
        if (shouldAnimate) setAnimating(true);
    }, [shouldAnimate]);

    const handleEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
        if (e.animationName?.startsWith('box-')) {
            setAnimating(false);
        }
    };

    const animate = animating && textAnimation !== 'none' && !!current;

    const align = layer.align || 'center';
    const alignVertical = layer.alignVertical || 'middle';
    const justifyMap: { [key: string]: 'flex-start' | 'center' | 'flex-end' } = {
        left: 'flex-start',
        center: 'center',
        right: 'flex-end'
    };
    const verticalJustifyMap: { [key: string]: 'flex-start' | 'center' | 'flex-end' } = {
        top: 'flex-start',
        middle: 'center',
        bottom: 'flex-end'
    };

    const color = resolveLayerColor(layer.variableColors, layer.colorText, layer.color || '#ffffff', variableValues, `${layer.id}_colorText`);

    const offsetX = layer.offsetX ?? 0;
    const offsetY = layer.offsetY ?? 0;

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

    return (
        <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            display: layer.visible ? 'flex' : 'none',
            alignItems: verticalJustifyMap[alignVertical],
            justifyContent: justifyMap[align],
            pointerEvents: boxesLocked ? 'auto' : 'none',
            ...((offsetX || offsetY) ? { transform: `translate(${offsetX}px, ${offsetY}px)` } : {}),
        }}>
            <MarkdownContent
                key={`${boxId}-${layer.id}`}
                content={current}
                className={`content${animate ? ` anim-${textAnimation}` : ''}`}
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
                    ...(animate ? { animationDuration: `${animationDuration}ms` } : {}),
                    ...(colorAnimation === 'fade' ? {
                        transition: `color ${animationDuration}ms ease`
                    } : {}),
                }}
                onAnimationEnd={handleEnd}
            />
        </div>
    );
});

// ---- Overlay (per image/video layer) --------------------------------------
const LayerOverlayView = React.memo(({
    overlay,
    layerId,
    boxId,
    variableValues,
    colorAnimation,
    animationDuration,
}: {
    overlay: LayerOverlay;
    layerId: string;
    boxId: string;
    variableValues: { [key: string]: string };
    colorAnimation: AnimationSettings['colorAnimation'];
    animationDuration: number;
}) => {
    const size = computeLayerOverlaySize(overlay, layerId, variableValues);
    const color = resolveLayerColor(overlay.variableColors, overlay.colorText, overlay.color || '#00000000', variableValues, `${layerId}_colorText`);

    return (
        <div key={`overlay-${boxId}-${layerId}`} style={{
            position: 'absolute',
            ...(overlay.direction === 'left' ? {
                top: 0,
                left: 0,
                bottom: 0,
                width: `${size}%`
            } : overlay.direction === 'right' ? {
                top: 0,
                right: 0,
                bottom: 0,
                width: `${size}%`
            } : overlay.direction === 'top' ? {
                top: 0,
                left: 0,
                right: 0,
                height: `${size}%`
            } : {
                bottom: 0,
                left: 0,
                right: 0,
                height: `${size}%`
            }),
            backgroundColor: color,
            pointerEvents: 'none',
            transition: colorAnimation === 'fade'
                ? `width 0.3s ease, height 0.3s ease, background-color ${animationDuration}ms ease`
                : 'width 0.3s ease, height 0.3s ease'
        }} />
    );
});

// ============================================================================
// Box
// ============================================================================
export default React.memo(function Box({
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
    refreshRateMs = 250,
    isDragging = false,
    onDragStart,
    onDragEnd,
    boxesLocked = false,
    centralVariableValues,
    videoRelayManager,
    boxRef,
    isMultiSelect = false,
    pages = [],
    animationSettings,
}: {
    boxData: BoxData;
    isSelected: boolean;
    onSelect: (event?: React.MouseEvent) => void;
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
    centralVariableValues?: { [key: string]: string };
    onDragEnd?: () => void;
    boxesLocked?: boolean;
    videoRelayManager?: VideoRelayManager | null;
    videoRelayManagerReady?: boolean;
    boxRef?: (el: HTMLDivElement | null) => void;
    isMultiSelect?: boolean;
    pages?: PageData[];
    animationSettings?: AnimationSettings;
}) {

    const { textAnimation = 'none', backgroundImageAnimation = 'none', colorAnimation = 'none', animationDuration = 300 } = animationSettings || {};

    const targetRef = useRef<HTMLDivElement>(null);
    const [frame, setFrame] = useState(boxData.frame);
    const [showModal, setShowModal] = useState(false);
    const [isDragStartCalled, setIsDragStartCalled] = useState(false);

    // Update local frame when the box frame changes
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

    // Collect variable sources for the fetcher, namespaced per layer so multiple
    // text/color/overlay entries never collide with each other.
    const fetcherSources = useMemo(() => {
        const sources: { [key: string]: string } = {};

        for (const layer of boxData.layers || []) {
            if (layer.type === 'text') {
                sources[`${layer.id}_label`] = layer.source || '';
                sources[`${layer.id}_colorText`] = layer.colorText || '';
                (layer.variableColors || []).forEach(vc => { if (vc.variable) sources[vc.variable] = vc.variable; });
            } else if (layer.type === 'color') {
                sources[`${layer.id}_colorText`] = layer.colorText || '';
                (layer.variableColors || []).forEach(vc => { if (vc.variable) sources[vc.variable] = vc.variable; });
            } else if (layer.type === 'image' || layer.type === 'video' || layer.type === 'url') {
                const overlay = layer.overlay;
                if (layer.type === 'image') {
                    sources[`${layer.id}_imageSrc`] = layer.imageSrc || '';
                }
                if (layer.type === 'url') {
                    sources[`${layer.id}_urlSrc`] = layer.urlSrc || '';
                }
                sources[`${layer.id}_colorText`] = overlay.colorText || '';
                sources[`${layer.id}_sizeSource`] = overlay.sizeSource || '';
                (overlay.variableColors || []).forEach(vc => { if (vc.variable) sources[vc.variable] = vc.variable; });
                (overlay.sizeVariableValues || []).forEach(vs => { if (vs.variable) sources[vs.variable] = vs.variable; });
            }
        }

        sources.opacitySource = boxData.opacitySource || '';
        sources.borderColorTextSource = boxData.borderColorText || '';
        (boxData.opacityVariableValues || []).forEach(varOpacity => { if (varOpacity.variable) sources[varOpacity.variable] = varOpacity.variable; });
        (boxData.borderVariableColors || []).forEach(varColor => { if (varColor.variable) sources[varColor.variable] = varColor.variable; });

        return sources;
    }, [boxData]);

    // Use the enhanced variable fetcher
    const fetchedVariables = useVariableFetcher(companionBaseUrl, fetcherSources, connections, refreshRateMs, isDragging, centralVariableValues);

    const variableValues = fetchedVariables.values;
    const variableHtmlValues = fetchedVariables.htmlValues;

    // Compute opacity from variable or fallback to stored value
    const computedOpacity = () => {
        // 1. Variable opacity conditions first
        if (boxData.opacityVariableValues && Array.isArray(boxData.opacityVariableValues)) {
            for (const varOpacity of boxData.opacityVariableValues) {
                if (varOpacity && varOpacity.variable && varOpacity.value) {
                    const variableValue = variableValues[varOpacity.variable] || '';
                    if (evaluateComparison(variableValue, varOpacity.operator, varOpacity.value)) {
                        return varOpacity.opacity / 100;
                    }
                }
            }
        }

        // 2. opacitySource contains a variable pattern
        const hasVariable = boxData.opacitySource && boxData.opacitySource.includes('$(') && boxData.opacitySource.includes(')');

        if (hasVariable && variableValues.opacitySource) {
            const parsed = parseInt(variableValues.opacitySource);
            if (!isNaN(parsed)) {
                return Math.max(0, Math.min(100, parsed)) / 100;
            }
        }

        // 3. Stored opacity
        return boxData.opacity / 100;
    };

    // Helper to send Companion button press
    const sendCompanionButtonPress = async () => {
        console.log('sendCompanionButtonPress called', {
            companionButtonLocation: boxData.companionButtonLocation,
            companionButtonConnectionId: boxData.companionButtonConnectionId,
            companionBaseUrl,
            boxesLocked
        });

        if (!boxData.companionButtonLocation || !boxData.companionButtonLocation.trim()) {
            console.log('No companion button location set');
            return;
        }

        // Validate format: should be "page/row/column"
        const parts = boxData.companionButtonLocation.split('/');
        if (parts.length !== 3) {
            console.warn('Invalid Companion button location format. Expected: page/row/column');
            return;
        }

        // Determine which connection URL to use
        let baseUrl = companionBaseUrl; // Default to main connection
        if (boxData.companionButtonConnectionId) {
            const selectedConnection = connections.find(c => c.id === boxData.companionButtonConnectionId);
            if (selectedConnection) {
                baseUrl = selectedConnection.url;
            }
        }

        const [page, row, column] = parts;
        const url = `${baseUrl}/api/location/${page}/${row}/${column}/press`;

        console.log('Sending POST to:', url);

        try {
            const response = await fetch(url, { method: 'POST' });
            console.log('Response:', response.status, response.statusText);
        } catch (error) {
            console.error('Failed to send Companion button press:', error);
        }
    };

    const resolvedBorder = isImageUrl(resolveLayerColor(boxData.borderVariableColors, boxData.borderColorText, boxData.borderColor, variableValues, 'borderColorTextSource'))
        ? 'transparent'
        : resolveLayerColor(boxData.borderVariableColors, boxData.borderColorText, boxData.borderColor, variableValues, 'borderColorTextSource');

    return (
        <div>
            <DoubleTapBox onDoubleTap={() => { if (!boxesLocked) setShowModal(true) }}>
                <div className="box-container">
                    <div
                        ref={(el) => {
                            (targetRef as any).current = el;
                            if (boxRef) boxRef(el);
                        }}
                        className={`box ${boxData.noBorder ? 'no-border' : 'with-border'}${isSelected && !boxesLocked ? ' box-selected' : ''}`}
                        onClick={(e) => {
                            if (boxesLocked) {
                                // When locked, allow clicks to pass through to content
                                return;
                            }
                            e.stopPropagation();
                            if (e.altKey) {
                                // Duplicate this box with proper position offset based on anchor point
                                const getDisplayPos = (translate: [number, number], w: number, h: number, anchor: BoxData['anchorPoint']): [number, number] => {
                                    const [x, y] = translate;
                                    switch (anchor) {
                                        case 'top-left': return [x, y];
                                        case 'top-right': return [x + w, y];
                                        case 'bottom-left': return [x, y + h];
                                        case 'bottom-right': return [x + w, y + h];
                                        case 'center': return [x + w / 2, y + h / 2];
                                        default: return [x, y];
                                    }
                                };

                                const getInternalPos = (displayPos: [number, number], w: number, h: number, anchor: BoxData['anchorPoint']): [number, number] => {
                                    const [x, y] = displayPos;
                                    switch (anchor) {
                                        case 'top-left': return [x, y];
                                        case 'top-right': return [x - w, y];
                                        case 'bottom-left': return [x, y - h];
                                        case 'bottom-right': return [x - w, y - h];
                                        case 'center': return [x - w / 2, y - h / 2];
                                        default: return [x, y];
                                    }
                                };

                                const currentDisplayPos = getDisplayPos(boxData.frame.translate, boxData.frame.width, boxData.frame.height, boxData.anchorPoint);
                                const newDisplayPos: [number, number] = [currentDisplayPos[0] + 20, currentDisplayPos[1] + 20];
                                const newInternalPos = getInternalPos(newDisplayPos, boxData.frame.width, boxData.frame.height, boxData.anchorPoint);

                                const duplicatedBox: BoxData = {
                                    ...boxData,
                                    id: uuid(),
                                    frame: {
                                        ...boxData.frame,
                                        translate: newInternalPos
                                    },
                                    layers: duplicateLayers(boxData.layers || []),
                                };
                                onDuplicate(duplicatedBox);
                            } else {
                                // Pass the event to onSelect for multi-select support
                                onSelect(e);
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
                            backgroundColor: 'transparent',
                            border: boxData.noBorder ? 'none' : `5px solid ${resolvedBorder}`,
                            borderRadius: `${boxData.borderRadius ?? 15}px`,
                            clipPath: `inset(0 round ${boxData.borderRadius ?? 15}px)`,
                            WebkitTransform: `translate(${frame.translate[0]}px, ${frame.translate[1]}px) translateZ(0)`,
                            transform: `translate(${frame.translate[0]}px, ${frame.translate[1]}px) translateZ(0)`,
                            zIndex: boxData.zIndex,
                            opacity: computedOpacity(),
                            pointerEvents: (boxesLocked && boxData.companionButtonLocation && boxData.companionButtonLocation.trim()) || !boxesLocked ? 'auto' : 'none',
                            ...(colorAnimation === 'fade' && !boxData.noBorder ? { transition: `border-color ${animationDuration}ms ease` } : {}),
                        }}
                    >
                        {/* Layers (list order is top-first: index 0 paints on top, so render reversed) */}
                        {(boxData.layers || []).slice().reverse().map(layer => {
                            if (layer.type === 'color') {
                                return (
                                    <ColorLayerView
                                        key={layer.id}
                                        layer={layer}
                                        variableValues={variableValues}
                                        colorAnimation={layer.colorAnimation ?? colorAnimation}
                                        animationDuration={animationDuration}
                                        borderRadius={boxData.borderRadius ?? 15}
                                    />
                                );
                            }
                            if (layer.type === 'image') {
                                return (
                                    <ImageLayerView
                                        key={layer.id}
                                        layer={layer}
                                        boxId={boxData.id}
                                        variableValues={variableValues}
                                        backgroundImageAnimation={layer.backgroundImageAnimation ?? backgroundImageAnimation}
                                        colorAnimation={colorAnimation}
                                        animationDuration={animationDuration}
                                        borderRadius={boxData.borderRadius ?? 15}
                                    />
                                );
                            }
                            if (layer.type === 'video') {
                                return (
                                    <VideoLayerView
                                        key={layer.id}
                                        layer={layer}
                                        boxId={boxData.id}
                                        videoRelayManager={videoRelayManager}
                                        variableValues={variableValues}
                                        colorAnimation={colorAnimation}
                                        animationDuration={animationDuration}
                                        borderRadius={boxData.borderRadius ?? 15}
                                    />
                                );
                            }
                            if (layer.type === 'url') {
                                return (
                                    <UrlLayerView
                                        key={layer.id}
                                        layer={layer}
                                        boxId={boxData.id}
                                        variableValues={variableValues}
                                        colorAnimation={colorAnimation}
                                        animationDuration={animationDuration}
                                        borderRadius={boxData.borderRadius ?? 15}
                                        boxesLocked={boxesLocked}
                                    />
                                );
                            }
                            return (
                                <TextLayerView
                                    key={layer.id}
                                    layer={layer}
                                    boxId={boxData.id}
                                    variableValues={variableValues}
                                    variableHtmlValues={variableHtmlValues}
                                    textAnimation={layer.textAnimation ?? textAnimation}
                                    colorAnimation={colorAnimation}
                                    animationDuration={animationDuration}
                                    boxesLocked={boxesLocked}
                                />
                            );
                        })}

                        {/* Click interceptor for Companion button - only active when locked with valid button location */}
                        {boxesLocked && boxData.companionButtonLocation && boxData.companionButtonLocation.trim() && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    zIndex: 3,
                                    cursor: 'pointer'
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    sendCompanionButtonPress();
                                }}
                            />
                        )}
                    </div>

                    {isSelected && !boxesLocked && !isMultiSelect && (
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
                            useMutationObserver={true}
                            touchAction="none"
                            dragContainer={document.body}
                            preventDefault={true}
                            stopDragging={false}
                            onDrag={({ beforeTranslate }) => {
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
                    connections={connections}
                    pages={pages}
                    variableValues={variableValues}
                    variableHtmlValues={variableHtmlValues}
                    variableLookup={centralVariableValues}
                />
            )}
        </div>
    );
});