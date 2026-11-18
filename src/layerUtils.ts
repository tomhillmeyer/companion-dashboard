import type { BaseLayer, BoxData, BoxNumberField, LayerMask, LayerNumberField, LayerOverlay, LayerRadius, ROI, VariableColor } from './types';
import { evaluateComparison, isVariableRef, resolveOperand } from './variableComparison';

// ----------------------------------------------------------------------------
// Variable-driven numeric fields
// ----------------------------------------------------------------------------

// Resolve a numeric field that may carry a "$(connection:variable)" override.
// The fetcher's resolved value map is keyed by the field's namespaced source key
// (e.g. "${layerId}_maskTop" or "box_frameWidth"). Unresolved/non-numeric values
// fall back to the stored number; the result is always clamped.
export const resolveNumberSource = (
    source: string | undefined,
    fallback: number,
    variableValues: { [key: string]: string } | undefined,
    sourceKey: string,
    min = -Infinity,
    max = Infinity
): number => {
    let value = fallback;

    if (source) {
        const resolved = variableValues?.[sourceKey];
        const raw = resolved !== undefined && resolved !== '' ? resolved : source;
        const parsed = parseFloat(raw);
        if (!isNaN(parsed)) value = parsed;
    }

    return Math.min(max, Math.max(min, value));
};

export const resolveLayerNumber = (
    layer: BaseLayer,
    field: LayerNumberField,
    variableValues: { [key: string]: string } | undefined,
    fallback: number,
    min = -Infinity,
    max = Infinity
): number => resolveNumberSource(layer.numberSources?.[field], fallback, variableValues, `${layer.id}_${field}`, min, max);

export const resolveBoxNumber = (
    boxData: BoxData,
    field: BoxNumberField,
    variableValues: { [key: string]: string } | undefined,
    fallback: number,
    min = -Infinity,
    max = Infinity
): number => resolveNumberSource(boxData.numberSources?.[field], fallback, variableValues, `box_${field}`, min, max);

// Resolved (0-100) mask percentages for a maskable layer.
export const resolveLayerMask = (
    layer: BaseLayer & { mask?: LayerMask },
    variableValues: { [key: string]: string } | undefined
): { top: number; right: number; bottom: number; left: number } => ({
    top: resolveLayerNumber(layer, 'maskTop', variableValues, layer.mask?.top ?? 0, 0, 100),
    right: resolveLayerNumber(layer, 'maskRight', variableValues, layer.mask?.right ?? 0, 0, 100),
    bottom: resolveLayerNumber(layer, 'maskBottom', variableValues, layer.mask?.bottom ?? 0, 0, 100),
    left: resolveLayerNumber(layer, 'maskLeft', variableValues, layer.mask?.left ?? 0, 0, 100),
});

// Resolved (px) offsets for any layer.
export const resolveLayerOffset = (
    layer: BaseLayer,
    variableValues: { [key: string]: string } | undefined
): { offsetX: number; offsetY: number } => ({
    offsetX: resolveLayerNumber(layer, 'offsetX', variableValues, layer.offsetX ?? 0),
    offsetY: resolveLayerNumber(layer, 'offsetY', variableValues, layer.offsetY ?? 0),
});

// Compute the ROI crop box as percentages of the container, preserving aspect
// ratio for both "contain" and "cover". The caller renders a centered box with
// these percentages and places the full video inside it scaled by 100/roi.width
// and 100/roi.height — that keeps the video's own aspect ratio exact.
export const computeRoiCropLayout = (
    containerWidth: number,
    containerHeight: number,
    videoWidth: number,
    videoHeight: number,
    roi: ROI,
    fit: 'cover' | 'contain'
): { left: number; top: number; width: number; height: number } => {
    const cw = Math.max(1, containerWidth);
    const ch = Math.max(1, containerHeight);
    const vw = Math.max(1, videoWidth);
    const vh = Math.max(1, videoHeight);
    const rw = Math.max(0.01, roi.width);
    const rh = Math.max(0.01, roi.height);

    const containerAR = cw / ch;
    const cropAR = (vw * (rw / 100)) / (vh * (rh / 100));

    let width: number;
    let height: number;

    if (fit === 'contain') {
        if (cropAR >= containerAR) {
            // Crop is wider than the container: width is limiting.
            width = 100;
            height = (containerAR / cropAR) * 100;
        } else {
            // Crop is taller than the container: height is limiting.
            height = 100;
            width = (cropAR / containerAR) * 100;
        }
    } else if (cropAR >= containerAR) {
        // Cover: crop is wider, so height must fill and width overflows.
        height = 100;
        width = (cropAR / containerAR) * 100;
    } else {
        width = 100;
        height = (containerAR / cropAR) * 100;
    }

    return {
        left: (100 - width) / 2,
        top: (100 - height) / 2,
        width,
        height,
    };
};

// Convert internal position (top-left) to display position (based on anchor point)
export const getDisplayPosition = (internalPos: [number, number], width: number, height: number, anchor: BoxData['anchorPoint']): [number, number] => {
    const [x, y] = internalPos;
    switch (anchor) {
        case 'top-left': return [x, y];
        case 'top-right': return [x + width, y];
        case 'bottom-left': return [x, y + height];
        case 'bottom-right': return [x + width, y + height];
        case 'center': return [x + width / 2, y + height / 2];
        default: return [x, y];
    }
};

// Convert display position to internal position (top-left)
export const getInternalPosition = (displayPos: [number, number], width: number, height: number, anchor: BoxData['anchorPoint']): [number, number] => {
    const [x, y] = displayPos;
    switch (anchor) {
        case 'top-left': return [x, y];
        case 'top-right': return [x - width, y];
        case 'bottom-left': return [x, y - height];
        case 'bottom-right': return [x - width, y - height];
        case 'center': return [x - width / 2, y - height / 2];
        default: return [x, y];
    }
};

// Resolve a layer's per-corner radius (px). Unset corners fall back to the box
// radius; any corner may be overridden by a variable source.
export const resolveLayerRadius = (
    layer: BaseLayer & { radius?: LayerRadius },
    boxRadius: number,
    variableValues?: { [key: string]: string }
): LayerRadius => ({
    topLeft: resolveLayerNumber(layer, 'radiusTopLeft', variableValues, layer.radius?.topLeft ?? boxRadius, 0, 500),
    topRight: resolveLayerNumber(layer, 'radiusTopRight', variableValues, layer.radius?.topRight ?? boxRadius, 0, 500),
    bottomLeft: resolveLayerNumber(layer, 'radiusBottomLeft', variableValues, layer.radius?.bottomLeft ?? boxRadius, 0, 500),
    bottomRight: resolveLayerNumber(layer, 'radiusBottomRight', variableValues, layer.radius?.bottomRight ?? boxRadius, 0, 500),
});

// True when any numeric field is variable-driven (used for clipping decisions).
export const hasRadiusSources = (layer: BaseLayer): boolean => {
    const sources = layer.numberSources;
    return !!sources && !!(
        sources.radiusTopLeft || sources.radiusTopRight ||
        sources.radiusBottomLeft || sources.radiusBottomRight
    );
};

// Resolve a color with priority: variable colors > colorText (fetched) > fallback.
// sourceKey maps to the fetcher's resolved value for colorText (namespaced per layer).
export const resolveLayerColor = (
    variableColors: VariableColor[] | undefined,
    colorText: string | undefined,
    fallbackColor: string,
    variableValues: { [key: string]: string },
    sourceKey: string
): string => {
    // 1. Variable colors first - first matching variable wins
    if (variableColors && Array.isArray(variableColors)) {
        for (const varColor of variableColors) {
            if (varColor && varColor.variable && varColor.value) {
                const leftValue = resolveOperand(varColor.variable, variableValues);
                const rightValue = resolveOperand(varColor.value, variableValues);
                if (evaluateComparison(leftValue, varColor.operator, rightValue)) {
                    return varColor.color;
                }
            }
        }
    }

    // 2. colorText has a value, resolve it via the fetcher so Companion variables work
    if (colorText && typeof colorText === 'string' && colorText.trim()) {
        return variableValues[sourceKey] || colorText;
    }

    // 3. Fall back to the picker color
    return fallbackColor;
};

// Compute a layer overlay's size (percent) with the same priority as the legacy overlay:
// variable size conditions > sizeSource variable > stored size.
export const computeLayerOverlaySize = (
    overlay: LayerOverlay,
    layerId: string,
    variableValues: { [key: string]: string }
): number => {
    // 1. Variable size conditions
    if (overlay.sizeVariableValues && Array.isArray(overlay.sizeVariableValues)) {
        for (const varSize of overlay.sizeVariableValues) {
            if (varSize && varSize.variable && varSize.value) {
                const leftValue = resolveOperand(varSize.variable, variableValues);
                const rightValue = resolveOperand(varSize.value, variableValues);
                if (evaluateComparison(leftValue, varSize.operator, rightValue)) {
                    return varSize.size;
                }
            }
        }
    }

    // 2. sizeSource contains a variable pattern
    const hasVariable = overlay.sizeSource && overlay.sizeSource.includes('$(') && overlay.sizeSource.includes(')');
    if (hasVariable && variableValues[`${layerId}_sizeSource`]) {
        const parsed = parseInt(variableValues[`${layerId}_sizeSource`]);
        if (!isNaN(parsed)) {
            return Math.max(0, Math.min(100, parsed));
        }
    }

    // 3. Stored size
    return overlay.size;
};

// Compute a box's opacity (0-1) with the same priority as the legacy overlay:
// variable opacity conditions > opacitySource variable > stored opacity.
export const computeBoxOpacity = (
    boxData: BoxData,
    variableValues: { [key: string]: string }
): number => {
    // 1. Variable opacity conditions first
    if (boxData.opacityVariableValues && Array.isArray(boxData.opacityVariableValues)) {
        for (const varOpacity of boxData.opacityVariableValues) {
            if (varOpacity && varOpacity.variable && varOpacity.value) {
                const leftValue = resolveOperand(varOpacity.variable, variableValues);
                const rightValue = resolveOperand(varOpacity.value, variableValues);
                if (evaluateComparison(leftValue, varOpacity.operator, rightValue)) {
                    return varOpacity.opacity / 100;
                }
            }
        }
    }

    // 2. opacitySource contains a variable pattern
    if (isVariableRef(boxData.opacitySource) && variableValues.opacitySource) {
        const parsed = parseInt(variableValues.opacitySource);
        if (!isNaN(parsed)) {
            return Math.max(0, Math.min(100, parsed)) / 100;
        }
    }

    // 3. Stored opacity
    return boxData.opacity / 100;
};

// IndexedDB helper for locally-uploaded images
export const getImageFromDB = async (filename: string): Promise<string | null> => {
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