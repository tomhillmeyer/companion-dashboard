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
    // First, store escaped characters with unique placeholders
    const escapedChars: { [key: string]: string } = {};
    let placeholderIndex = 0;

    let processedText = text.replace(/\\(\*|_|\[|\]|\(|\)|!)/g, (char) => {
        const placeholder = `XESCAPEDX${placeholderIndex}XESCAPEDX`;
        escapedChars[placeholder] = char;
        placeholderIndex++;
        return placeholder;
    });

    // Now apply markdown formatting
    processedText = processedText
        // Bold: **text** or __text__
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.*?)__/g, '<strong>$1</strong>')
        // Italic: *text* or _text_
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
        // Images: ![alt](url)
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="width: auto; height: 100%;" />')
        // Links: [text](url)
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        // Handle literal \n strings
        .replace(/\\n/g, '\n')
        // Line breaks
        .replace(/\n/g, '<br>');

    // Finally, restore escaped characters
    Object.keys(escapedChars).forEach(placeholder => {
        processedText = processedText.replace(new RegExp(placeholder, 'g'), escapedChars[placeholder]);
    });

    return processedText;
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
                            // If API returns the variable name itself or null, treat as empty
                            if (data === variable || data === 'null' || data === null || data === undefined) {
                                processedString = processedString.replace(`$(${variable})`, ``);
                            } else {
                                processedString = processedString.replace(`$(${variable})`, data);
                            }
                        } else {
                            console.warn(`Failed to fetch ${variable}:`, response.status);
                            processedString = processedString.replace(`$(${variable})`, ``);
                        }
                    } catch (error) {
                        console.error(`Error fetching ${variable}:`, error);
                        processedString = processedString.replace(`$(${variable})`, ``);
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