/**
 * Box Layer Migration
 *
 * Converts the legacy flat BoxData schema (background/overlay/header/left/right)
 * into the layered schema (layers: BoxLayer[]). Also provides default layer
 * factories used by createNewBox and the BoxSettingsModal "+" add menu.
 */

import type { BoxData, BoxLayer, ColorLayer, ImageLayer, LayerMask, LayerOverlay, LayerType, TextLayer, VariableColor, VariableOverlaySize, VideoLayer } from './types';
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
            };
            return { ...layer, ...overrides } as VideoLayer;
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
            if ((l.type === 'image' || l.type === 'video') && !l.overlay) {
                l.overlay = createDefaultOverlay();
            }
            if (l.type === 'color' && !l.mask) {
                l.mask = createDefaultMask();
            }
            if (l.type === 'text') {
                if (l.alignVertical === undefined) {
                    l.alignVertical = 'middle';
                }
                const { background, backgroundText, backgroundVariableColors, label, ...rest } = l;
                l = rest;
            }
            return l as BoxLayer;
        });
    } else {
        layers = buildLayersFromLegacy(source);
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

function buildLayersFromLegacy(raw: any): BoxLayer[] {
    // Build bottom-first (this is the true paint order), then reverse so the
    // returned array reads top-first (index 0 paints on top).
    const bottomFirst: BoxLayer[] = [];

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
    if (hasHeaderBand) {
        bottomFirst.push({
            id: uuid(),
            type: 'color',
            offsetX: 0,
            offsetY: 0,
            color: raw.headerColor ?? '#19325c',
            colorText: raw.headerColorText ?? '',
            variableColors: normalizeConditions(raw.headerVariableColors) as VariableColor[],
            mask: { top: 0, bottom: 65, left: 0, right: 0 },
            radius: createDefaultRadius(),
        });
    }

    // Text layers (header, left, right).
    // Mapping: header -> top center, left -> middle left, right -> middle right.
    // Migration backfill: legacy left/right labels sit below the header band on
    // screen, so they get the same Y offset as the header layout when a band
    // exists. Band-less legacy boxes keep their text at the default (0) position.
    const bandOffset = hasHeaderBand ? 15 : 0;
    const textLayers = [
        {
            source: raw.headerLabelSource ?? '',
            size: raw.headerLabelSize ?? 16,
            align: (raw.headerLabelAlign ?? 'center') as TextLayer['align'],
            alignVertical: 'top' as TextLayer['alignVertical'],
            font: raw.headerLabelFont ?? '',
            color: raw.headerLabelColor ?? '#ffffff',
            colorText: raw.headerLabelColorText ?? '',
            variableColors: normalizeConditions(raw.headerLabelVariableColors) as VariableColor[],
            visible: raw.headerLabelVisible ?? true,
        },
        {
            source: raw.leftLabelSource ?? '',
            size: raw.leftLabelSize ?? 14,
            align: (raw.leftLabelAlign ?? 'left') as TextLayer['align'],
            alignVertical: 'middle' as TextLayer['alignVertical'],
            font: raw.leftLabelFont ?? '',
            color: raw.leftLabelColor ?? '#FFFFFF',
            colorText: raw.leftLabelColorText ?? '',
            variableColors: normalizeConditions(raw.leftLabelVariableColors) as VariableColor[],
            visible: raw.leftVisible ?? true,
            offsetY: bandOffset,
        },
        {
            source: raw.rightLabelSource ?? '',
            size: raw.rightLabelSize ?? 20,
            align: (raw.rightLabelAlign ?? 'right') as TextLayer['align'],
            alignVertical: 'middle' as TextLayer['alignVertical'],
            font: raw.rightLabelFont ?? '',
            color: raw.rightLabelColor ?? '#FFFFFF',
            colorText: raw.rightLabelColorText ?? '',
            variableColors: normalizeConditions(raw.rightLabelVariableColors) as VariableColor[],
            visible: raw.rightVisible ?? true,
            offsetY: bandOffset,
        },
    ];

    for (const t of textLayers) {
        bottomFirst.push({ id: uuid(), type: 'text', offsetX: 0, offsetY: 0, ...t });
    }

    return bottomFirst.reverse();
}