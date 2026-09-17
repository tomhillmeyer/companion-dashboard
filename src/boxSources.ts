import type { BoxData } from './types';
import { isVariableRef } from './variableComparison';
import { parseVariables } from './useVariableFetcher';

/**
 * Build the map of variable sources a box needs fetched. Keys are the fetcher's
 * source keys (e.g. "${layerId}_label", "${layerId}_colorText", "opacitySource")
 * and the raw "$(connection:name)" references used by comparison conditions.
 *
 * Individual "$(connection:name)" references are also registered as their own
 * sources so the resolved value map can double as a variable lookup for
 * resolveSourceValue (which looks values up by their full "$(...)" reference).
 */
export const buildBoxSources = (boxData: BoxData): { [key: string]: string } => {
    const sources: { [key: string]: string } = {};

    // Register both operands of a condition when they are variable references;
    // either side may be a literal string or a "$(connection:name)" variable.
    const registerConditionSources = (condition: { variable?: string; value?: string } | undefined) => {
        if (!condition) return;
        if (isVariableRef(condition.variable)) sources[condition.variable] = condition.variable;
        if (isVariableRef(condition.value)) sources[condition.value] = condition.value;
    };

    for (const layer of boxData.layers || []) {
        if (layer.type === 'text') {
            sources[`${layer.id}_label`] = layer.source || '';
            sources[`${layer.id}_colorText`] = layer.colorText || '';
            (layer.variableColors || []).forEach(registerConditionSources);
        } else if (layer.type === 'color') {
            sources[`${layer.id}_colorText`] = layer.colorText || '';
            (layer.variableColors || []).forEach(registerConditionSources);
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
            (overlay.variableColors || []).forEach(registerConditionSources);
            (overlay.sizeVariableValues || []).forEach(registerConditionSources);
        }
    }

    sources.opacitySource = boxData.opacitySource || '';
    sources.borderColorTextSource = boxData.borderColorText || '';
    (boxData.opacityVariableValues || []).forEach(registerConditionSources);
    (boxData.borderVariableColors || []).forEach(registerConditionSources);

    // Add every individual "$(connection:name)" reference found in the sources above.
    // Snapshot the values first since we mutate the map while iterating.
    for (const sourceString of Object.values(sources)) {
        parseVariables(sourceString).forEach(({ variable }) => {
            sources[`$(${variable})`] = `$(${variable})`;
        });
    }

    return sources;
};
