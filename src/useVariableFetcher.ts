import { useEffect, useState } from 'react';

// Parse variables from a source string like "$(internal:time_hms_12)" or "$(custom:1266_active)"
const parseVariables = (source: string): string[] => {
    const variableRegex = /\$\(([^)]+)\)/g;
    const matches = [];
    let match;

    while ((match = variableRegex.exec(source)) !== null) {
        matches.push(match[1]); // Get the content inside $()
    }

    return matches;
};

// Convert variable reference to API path
const variableToApiPath = (variable: string): string => {
    const [connectionLabel, variableName] = variable.split(':', 2);
    return `/api/variable/${connectionLabel}/${variableName}/value`;
};

// Simple markdown parser for basic formatting
const parseMarkdown = (text: string): string => {
    return text
        // Handle escaped characters first (replace \* with placeholder, etc.)
        .replace(/\\(\*|_|\[|\]|\(|\)|!)/g, 'ESCAPED_$1_PLACEHOLDER')
        // Bold: **text** or __text__
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.*?)__/g, '<strong>$1</strong>')
        // Italic: *text* or _text_
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
        // Images: ![alt](url)
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; height: auto;" />')
        // Links: [text](url)
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        // Line breaks
        .replace(/\n/g, '<br>')
        // Restore escaped characters
        .replace(/ESCAPED_(.?)_PLACEHOLDER/g, '$1');
};

export const useVariableFetcher = (
    baseUrl: string,
    sources: { [key: string]: string } // e.g., { headerLabelSource: "$(internal:time_hms_12)", leftLabelSource: "Hello $(custom:test)" }
) => {
    const [values, setValues] = useState<{ [key: string]: string }>({});
    const [htmlValues, setHtmlValues] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        if (!baseUrl) return;

        const fetchVariables = async () => {
            const newValues: { [key: string]: string } = {};
            const newHtmlValues: { [key: string]: string } = {};

            for (const [sourceKey, sourceValue] of Object.entries(sources)) {
                if (!sourceValue) {
                    newValues[sourceKey] = '';
                    newHtmlValues[sourceKey] = '';
                    continue;
                }

                const variables = parseVariables(sourceValue);
                let processedString = sourceValue;

                // Replace each variable with its fetched value
                for (const variable of variables) {
                    try {
                        const apiPath = variableToApiPath(variable);
                        const response = await fetch(`${baseUrl}${apiPath}`);

                        if (response.ok) {
                            const data = await response.text(); // API returns plain text
                            processedString = processedString.replace(`$(${variable})`, data);
                        } else {
                            console.warn(`Failed to fetch ${variable}:`, response.status);
                            processedString = processedString.replace(`$(${variable})`, `[${variable}]`);
                        }
                    } catch (error) {
                        console.error(`Error fetching ${variable}:`, error);
                        processedString = processedString.replace(`$(${variable})`, `[${variable}]`);
                    }
                }

                newValues[sourceKey] = processedString;
                newHtmlValues[sourceKey] = parseMarkdown(processedString);
            }

            // Only update if values have actually changed
            setValues(prevValues => {
                const hasChanged = JSON.stringify(prevValues) !== JSON.stringify(newValues);
                return hasChanged ? newValues : prevValues;
            });
            setHtmlValues(prevHtmlValues => {
                const hasChanged = JSON.stringify(prevHtmlValues) !== JSON.stringify(newHtmlValues);
                return hasChanged ? newHtmlValues : prevHtmlValues;
            });
        };

        // Initial fetch
        fetchVariables();

        // Set up interval for every second
        const interval = setInterval(fetchVariables, 1000);

        return () => clearInterval(interval);
    }, [baseUrl, JSON.stringify(sources)]); // Re-run when baseUrl or sources change

    return { values, htmlValues };
};