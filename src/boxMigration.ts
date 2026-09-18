/**
 * Box Layer Migration
 *
 * Converts the legacy flat BoxData schema (background/overlay/header/left/right)
 * into the layered schema (layers: BoxLayer[]). Also provides default layer
 * factories used by createNewBox and the BoxSettingsModal "+" add menu.
 */

import type { BoxData, BoxLayer, ColorLayer, ImageLayer, LayerMask, LayerOverlay, LayerRadius, LayerType, TextLayer, UrlLayer, VariableColor, VariableOverlaySize, VideoLayer } from './types';
import { v4 as uuid } from 'uuid';

// ============================================================================
// Small helpers
// ============================================================================

export const createDefaultMask = (): LayerMask => ({ top: 0, bottom: 0, left: 0, right: 0 });

export const createDefaultRadius = () => ({ topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 });

export const isMasked = (mask?: LayerMask): boolean => !!mask && (mask.top > 0 || mask.bottom > 0 || mask.left > 0 || mask.right > 0);

const normalizeConditions = (arr?: any[]): any[] =>
    (arr || []).map((entry) => ({ ...entry, operator: entry.operator ?? '==' }));

export const isImageUrl = (str?: string): boolean => {
    if (!str) return false;
    const trimmed = str.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return true;
    if (trimmed.startsWith('data:image/')) return true;
    if (/\.(jpe?g|png|gif|bmp|webp|svg)(\?.*)?$/i.test(trimmed)) return true;
    return false;
};

// ============================================================================
// Pixel scaling relative to the default box size
// ============================================================================

// Dimensions of a brand-new box (see App.tsx createNewBox / migrateBoxData
// fallback). Migrated pixel values are scaled against this reference so a box
// of any size keeps the visual proportions of the default. At the reference
// size the scale factors are 1 and migration is a no-op.
export const REFERENCE_BOX_WIDTH = 600;
export const REFERENCE_BOX_HEIGHT = 105;

const roundPx = (value: number): number => Math.round(value * 100) / 100;

/**
 * Scale every pixel-based value in a layer relative to the reference box size.
 * X offsets follow width; Y offsets, text sizes, and radii follow height so the
 * text keeps tracking the percentage-based header band as the box grows.
 */
export const scaleLayerPx = <T extends BoxLayer>(layer: T, sx: number, sy: number): T => {
    const scaled: any = {
        ...layer,
        offsetX: roundPx((layer.offsetX ?? 0) * sx),
        offsetY: roundPx((layer.offsetY ?? 0) * sy),
    };
    if (layer.type === 'text') {
        scaled.size = roundPx(layer.size * sy);
    } else {
        const radius = (layer as any).radius as LayerRadius | undefined;
        if (radius) {
            const r = Math.min(sx, sy);
            scaled.radius = {
                topLeft: roundPx(radius.topLeft * r),
                topRight: roundPx(radius.topRight * r),
                bottomLeft: roundPx(radius.bottomLeft * r),
                bottomRight: roundPx(radius.bottomRight * r),
            };
        }
    }
    return scaled as T;
};

// ============================================================================
// Default layer factories
// ============================================================================

export const createDefaultOverlay = (): LayerOverlay => ({
    color: '#00000000',
    colorText: '',
    variableColors: [],
    direction: 'left',
    size: 100,
    sizeSource: '',
    sizeVariableValues: [],
});

export function createDefaultLayer(type: LayerType, overrides: Partial<BoxLayer> = {}): BoxLayer {
    switch (type) {
        case 'color': {
            const layer: ColorLayer = {
                id: uuid(),
                type: 'color',
                offsetX: 0,
                offsetY: 0,
                color: '#262626',
                colorText: '',
                variableColors: [],
                mask: createDefaultMask(),
            };
            return { ...layer, ...overrides } as ColorLayer;
        }
        case 'image': {
            const layer: ImageLayer = {
                id: uuid(),
                type: 'image',
                offsetX: 0,
                offsetY: 0,
                imageSrc: '',
                imageSize: 'cover',
                imageOpacity: 100,
                overlay: createDefaultOverlay(),
                mask: createDefaultMask(),
            };
            return { ...layer, ...overrides } as ImageLayer;
        }
        case 'video': {
            const layer: VideoLayer = {
                id: uuid(),
                type: 'video',
                offsetX: 0,
                offsetY: 0,
                deviceId: '',
                videoSize: 'cover',
                overlay: createDefaultOverlay(),
                mask: createDefaultMask(),
            };
            return { ...layer, ...overrides } as VideoLayer;
        }
        case 'url': {
            const layer: UrlLayer = {
                id: uuid(),
                type: 'url',
                offsetX: 0,
                offsetY: 0,
                urlSrc: '',
                urlOpacity: 100,
                overlay: createDefaultOverlay(),
                mask: createDefaultMask(),
            };
            return { ...layer, ...overrides } as UrlLayer;
        }
        case 'text': {
            const layer: TextLayer = {
                id: uuid(),
                type: 'text',
                offsetX: 0,
                offsetY: 0,
                source: '',
                size: 16,
                align: 'center',
                alignVertical: 'middle',
                wrap: 'word',
                scrollable: false,
                maxWidth: 100,
                maxHeight: 100,
                font: '',
                color: '#ffffff',
                colorText: '',
                variableColors: [],
                visible: true,
            };
            return { ...layer, ...overrides } as TextLayer;
        }
    }
}

// Default stack for brand-new boxes (list order = top-first: index 0 is on top).
// Mirrors the old default: color bg + top band (masked color) + header/left/right text.
export function createDefaultBoxLayers(): BoxLayer[] {
    return [
        createDefaultLayer('text', {
            source: '$(internal:time_hms_12)',
            size: 20,
            align: 'right',
            alignVertical: 'middle',
            color: '#FFFFFF',
            offsetY: 15,
            visible: true,
        }),
        createDefaultLayer('text', {
            source: 'Time',
            size: 14,
            align: 'left',
            alignVertical: 'middle',
            color: '#FFFFFF',
            offsetY: 15,
            visible: true,
        }),
        createDefaultLayer('text', {
            source: 'Time of Day',
            size: 16,
            align: 'center',
            alignVertical: 'top',
            color: '#ffffff',
            visible: true,
        }),
        createDefaultLayer('color', {
            color: '#19325c',
            mask: { top: 0, bottom: 65, left: 0, right: 0 },
            radius: createDefaultRadius(),
        }),
        createDefaultLayer('color', { color: '#262626' }),
    ];
}

export function duplicateLayers(layers: BoxLayer[]): BoxLayer[] {
    return layers.map((layer) => {
        const copy = { ...layer, id: uuid() } as any;
        if (copy.overlay) {
            copy.overlay = { ...copy.overlay, variableColors: normalizeConditions(copy.overlay.variableColors), sizeVariableValues: normalizeConditions(copy.overlay.sizeVariableValues) };
        }
        if (copy.variableColors) copy.variableColors = normalizeConditions(copy.variableColors);
        return copy as BoxLayer;
    });
}

export const hasLayers = (box: any): boolean => !!(box && Array.isArray(box.layers));

// ============================================================================
// Migration
// ============================================================================

/**
 * Upgrade a box (legacy flat schema OR already-layered) to the current BoxData
 * schema. Idempotent: layered boxes pass through with defaults filled in.
 */
export function migrateBoxData(raw: any): BoxData {
    const source = raw || {};
    const base = {
        id: source.id || uuid(),
        pageId: source.pageId ?? '',
        frame: source.frame ?? { translate: [30, 60] as [number, number], width: 600, height: 105 },
        anchorPoint: source.anchorPoint ?? 'top-left',
        zIndex: source.zIndex ?? 1,
        opacity: source.opacity ?? 100,
        opacitySource: source.opacitySource ?? '',
        opacityVariableValues: normalizeConditions(source.opacityVariableValues) as BoxData['opacityVariableValues'],
        borderColor: source.borderColor ?? '#61BAFA',
        borderColorText: source.borderColorText ?? '',
        borderVariableColors: normalizeConditions(source.borderVariableColors) as BoxData['borderVariableColors'],
        noBorder: source.noBorder ?? true,
        borderRadius: source.borderRadius ?? 15,
    };

    let layers: BoxLayer[];
    if (hasLayers(source)) {
        layers = source.layers.map((l: any) => {
            if (!l || !l.id) l = { ...l, id: uuid() };
            if (l.offsetX === undefined) l.offsetX = 0;
            if (l.offsetY === undefined) l.offsetY = 0;
            if ((l.type === 'image' || l.type === 'video' || l.type === 'url') && !l.overlay) {
                l.overlay = createDefaultOverlay();
            }
            if ((l.type === 'image' || l.type === 'video' || l.type === 'url') && !l.mask) {
                l.mask = createDefaultMask();
            }
            if (l.type === 'color' && !l.mask) {
                l.mask = createDefaultMask();
            }
            if (l.type === 'text') {
                if (l.alignVertical === undefined) {
                    l.alignVertical = 'middle';
                }
                if (l.wrap === undefined) {
                    l.wrap = 'word';
                }
                if (l.scrollable === undefined) {
                    l.scrollable = false;
                }
                if (l.maxWidth === undefined) {
                    l.maxWidth = 100;
                }
                if (l.maxHeight === undefined) {
                    l.maxHeight = 100;
                }
                // Convert the interim 4-side text mask (if any) into width/height constraints
                if (l.mask !== undefined && l.mask !== null) {
                    const m = l.mask;
                    if (m.left > 0 || m.right > 0 || m.top > 0 || m.bottom > 0) {
                        l.maxWidth = Math.max(0, 100 - (m.left + m.right));
                        l.maxHeight = Math.max(0, 100 - (m.top + m.bottom));
                    }
                    delete l.mask;
                }
                const { background, backgroundText, backgroundVariableColors, label, ...rest } = l;
                l = rest;
            }
            return l as BoxLayer;
        });
    } else {
        layers = buildLayersFromLegacy(source, base.frame);
    }

    const migrated: BoxData = {
        ...base,
        layers,
        ...(source.companionButtonLocation !== undefined && source.companionButtonLocation !== null
            ? { companionButtonLocation: source.companionButtonLocation }
            : {}),
        ...(source.companionButtonConnectionId !== undefined && source.companionButtonConnectionId !== null
            ? { companionButtonConnectionId: source.companionButtonConnectionId }
            : {}),
    };
    return migrated;
}

function buildLayersFromLegacy(raw: any, frame: BoxData['frame']): BoxLayer[] {
    // Build bottom-first (this is the true paint order), then reverse so the
    // returned array reads top-first (index 0 paints on top).
    const bottomFirst: BoxLayer[] = [];

    // Size-aware pixel scaling (no-op at the reference 600x105 box)
    const sx = (frame?.width || REFERENCE_BOX_WIDTH) / REFERENCE_BOX_WIDTH;
    const sy = (frame?.height || REFERENCE_BOX_HEIGHT) / REFERENCE_BOX_HEIGHT;

    // Legacy visibility gating: hidden header/left/right labels are not
    // recreated. Missing flags default to visible (older configs never stored them).
    const headerVisible = raw.headerLabelVisible ?? true;
    const leftVisible = raw.leftVisible ?? true;
    const rightVisible = raw.rightVisible ?? true;

    // Header band height follows the header text size using the legacy
    // content-box formula (.header: line-height 1.5 + 10px padding top/bottom).
    // The 20px padding is intentionally not scaled with the box.
    const boxHeight = frame?.height || REFERENCE_BOX_HEIGHT;
    const scaledHeaderSize = (raw.headerLabelSize ?? 16) * sy;
    const bandPx = 1.5 * scaledHeaderSize + 20;
    const bandMaskBottom = Math.max(0, Math.min(100, 100 - (bandPx / boxHeight) * 100));
    const bodyOffsetY = headerVisible ? bandPx / 2 : 0;

    // Color layer (always present in legacy schema)
    bottomFirst.push({
        id: uuid(),
        type: 'color',
        offsetX: 0,
        offsetY: 0,
        color: raw.backgroundColor ?? '#262626',
        colorText: raw.backgroundColorText ?? '',
        variableColors: normalizeConditions(raw.backgroundVariableColors) as VariableColor[],
        mask: createDefaultMask(),
    });

    // Background overlay (single overlay covered the whole background stack).
    // Per the product decision: overlays only exist on image/video layers.
    const overlay: LayerOverlay = {
        color: raw.overlayColor ?? '#00000000',
        colorText: raw.overlayColorText ?? '',
        variableColors: normalizeConditions(raw.overlayVariableColors) as VariableColor[],
        direction: raw.overlayDirection ?? 'left',
        size: raw.overlaySize ?? 100,
        sizeSource: raw.overlaySizeSource ?? '',
        sizeVariableValues: normalizeConditions(raw.overlaySizeVariableValues) as VariableOverlaySize[],
    };

    // Image layer if a file was uploaded, or backgroundColorText was a literal image URL
    if (raw.backgroundImage) {
        bottomFirst.push({
            id: uuid(),
            type: 'image',
            offsetX: 0,
            offsetY: 0,
            imageSrc: raw.backgroundImage,
            imageSize: raw.backgroundImageSize ?? 'cover',
            imageOpacity: raw.backgroundImageOpacity ?? 100,
            overlay: { ...overlay },
        });
    } else if (isImageUrl(raw.backgroundColorText)) {
        bottomFirst.push({
            id: uuid(),
            type: 'image',
            offsetX: 0,
            offsetY: 0,
            imageSrc: raw.backgroundColorText,
            imageSize: raw.backgroundImageSize ?? 'cover',
            imageOpacity: raw.backgroundImageOpacity ?? 100,
            overlay: { ...overlay },
        });
    }

    // Video layer
    if (raw.backgroundVideoDeviceId) {
        bottomFirst.push({
            id: uuid(),
            type: 'video',
            offsetX: 0,
            offsetY: 0,
            deviceId: raw.backgroundVideoDeviceId,
            videoSize: raw.backgroundVideoSize ?? 'cover',
            ...(raw.backgroundVideoROI ? { roi: raw.backgroundVideoROI } : {}),
            overlay: { ...overlay },
        });
    }

    // Header band: the legacy headerColor was a full-box top band rendered as a
    // text-layer background. It becomes a dedicated color layer masked to the top
    // (bottom mask ~65%). Text layers no longer carry backgrounds.
    const hasHeaderColor = raw.headerColor && raw.headerColor !== 'transparent';
    const hasHeaderColorText = raw.headerColorText;
    const hasHeaderVariables = (raw.headerVariableColors || []).length > 0;
    const hasHeaderBand = hasHeaderColor || hasHeaderColorText || hasHeaderVariables;
    // The legacy band was the header element's background, so hiding the header
    // hid the band as well - only recreate it when the header is visible.
    if (headerVisible && hasHeaderBand) {
        bottomFirst.push({
            id: uuid(),
            type: 'color',
            offsetX: 0,
            offsetY: 0,
            color: raw.headerColor ?? '#19325c',
            colorText: raw.headerColorText ?? '',
            variableColors: normalizeConditions(raw.headerVariableColors) as VariableColor[],
            mask: { top: 0, bottom: bandMaskBottom, left: 0, right: 0 },
            radius: createDefaultRadius(),
        });
    }

    // Text layers (header, left, right).
    // Mapping: header -> top center, left -> middle left, right -> middle right.
    // Visibility: hidden labels are not recreated. Legacy left/right labels sit
    // below the header element, so their Y offset is half the band height (the
    // center of the remaining body area); a hidden header collapses that space,
    // leaving them at 0.
    const textLayers = [
        {
            enabled: headerVisible,
            isBody: false,
            data: {
                source: raw.headerLabelSource ?? '',
                size: raw.headerLabelSize ?? 16,
                align: (raw.headerLabelAlign ?? 'center') as TextLayer['align'],
                alignVertical: 'top' as TextLayer['alignVertical'],
                font: raw.headerLabelFont ?? '',
                color: raw.headerLabelColor ?? '#ffffff',
                colorText: raw.headerLabelColorText ?? '',
                variableColors: normalizeConditions(raw.headerLabelVariableColors) as VariableColor[],
                visible: true,
            },
        },
        {
            enabled: leftVisible,
            isBody: true,
            data: {
                source: raw.leftLabelSource ?? '',
                size: raw.leftLabelSize ?? 14,
                align: (raw.leftLabelAlign ?? 'left') as TextLayer['align'],
                alignVertical: 'middle' as TextLayer['alignVertical'],
                font: raw.leftLabelFont ?? '',
                color: raw.leftLabelColor ?? '#FFFFFF',
                colorText: raw.leftLabelColorText ?? '',
                variableColors: normalizeConditions(raw.leftLabelVariableColors) as VariableColor[],
                visible: true,
            },
        },
        {
            enabled: rightVisible,
            isBody: true,
            data: {
                source: raw.rightLabelSource ?? '',
                size: raw.rightLabelSize ?? 20,
                align: (raw.rightLabelAlign ?? 'right') as TextLayer['align'],
                alignVertical: 'middle' as TextLayer['alignVertical'],
                font: raw.rightLabelFont ?? '',
                color: raw.rightLabelColor ?? '#FFFFFF',
                colorText: raw.rightLabelColorText ?? '',
                variableColors: normalizeConditions(raw.rightLabelVariableColors) as VariableColor[],
                visible: true,
            },
        },
    ];

    const bodyTextIds = new Set<string>();
    for (const { enabled, isBody, data } of textLayers) {
        if (!enabled) continue;
        const id = uuid();
        if (isBody) bodyTextIds.add(id);
        bottomFirst.push({ id, type: 'text', offsetX: 0, offsetY: 0, ...data });
    }

    // Scale px values, then apply the header-derived body offset. bandPx already
    // reflects the scaled font size, so the offset must not be scaled a second time.
    const scaledLayers = bottomFirst.reverse().map(layer => scaleLayerPx(layer, sx, sy));
    for (const layer of scaledLayers) {
        if (layer.type === 'text' && bodyTextIds.has(layer.id)) {
            layer.offsetY = bodyOffsetY;
        }
    }

    return scaledLayers;
}