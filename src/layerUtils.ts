import type { BoxData, LayerOverlay, LayerRadius, VariableColor } from './types';
import { evaluateComparison } from './variableComparison';

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

// Resolve a layer's per-corner radius; unset corners fall back to the box radius.
export const resolveLayerRadius = (
    radius: LayerRadius | undefined,
    boxRadius: number
): LayerRadius => ({
    topLeft: radius?.topLeft ?? boxRadius,
    topRight: radius?.topRight ?? boxRadius,
    bottomLeft: radius?.bottomLeft ?? boxRadius,
    bottomRight: radius?.bottomRight ?? boxRadius,
});

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
                const variableValue = variableValues[varColor.variable] || '';
                if (evaluateComparison(variableValue, varColor.operator, varColor.value)) {
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
                const variableValue = variableValues[varSize.variable] || '';
                if (evaluateComparison(variableValue, varSize.operator, varSize.value)) {
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