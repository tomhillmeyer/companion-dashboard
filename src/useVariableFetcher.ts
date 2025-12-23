import { useEffect, useState, useMemo } from 'react';

interface CompanionConnection {
    id: string;
    url: string;
    label: string;
}

// Parse variables from a source string like "$(internal:time_hms_12)" or "$(custom:1266_active)" or "[2]$(custom:test)"
// Also detects escaped variables like "\$(connection:variable)"
const parseVariables = (source: string): Array<{variable: string, connectionIndex?: number, isEscaped: boolean, fullMatch: string}> => {
    const variableRegex = /(\\)?(\[(\d+)\])?\$\(([^)]+)\)/g;
    const matches = [];
    let match;

    while ((match = variableRegex.exec(source)) !== null) {
        const isEscaped = match[1] === '\\';
        const connectionIndex = match[3] ? parseInt(match[3]) : undefined;
        const variable = match[4]; // Get the content inside $()
        const fullMatch = match[0]; // The complete matched string
        matches.push({ variable, connectionIndex, isEscaped, fullMatch });
    }

    return matches;
};

// Convert variable reference to API path
const variableToApiPath = (variable: string): string => {
    const [connectionLabel, variableName] = variable.split(':', 2);
    return `/api/variable/${connectionLabel}/${variableName}/value`;
};

// Escape markdown characters in text
const escapeMarkdown = (text: string): string => {
    // Escape markdown special characters: * _ [ ] ( ) !
    return text.replace(/([*_\[\]()!])/g, '\\$1');
};

// Simple markdown parser for basic formatting
const parseMarkdown = (text: string): string => {
    // First, store escaped characters with unique placeholders
    const escapedChars: { [key: string]: string } = {};
    let placeholderIndex = 0;

    let processedText = text.replace(/\\(\*|_|\[|\]|\(|\)|!)/g, (_match, char) => {
        const placeholder = `XESCAPEDX${placeholderIndex}XESCAPEDX`;
        escapedChars[placeholder] = char; // Store just the character, not the backslash
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

    // Finally, restore escaped characters (without the backslash)
    Object.keys(escapedChars).forEach(placeholder => {
        processedText = processedText.replace(new RegExp(placeholder, 'g'), escapedChars[placeholder]);
    });

    return processedText;
};

export const useVariableFetcher = (
    baseUrl: string,
    sources: { [key: string]: string }, // e.g., { headerLabelSource: "$(internal:time_hms_12)", leftLabelSource: "Hello $(custom:test)" }
    connections: CompanionConnection[] = [], // Additional connections
    refreshRateMs: number = 100, // Configurable refresh rate in milliseconds
    isDragging: boolean = false // Pause updates during drag operations
) => {
    // Initialize state with processed values - remove variables immediately to show surrounding text
    const [values, setValues] = useState<{ [key: string]: string }>(() => {
        const initialValues: { [key: string]: string } = {};
        Object.entries(sources).forEach(([key, value]) => {
            if (!value) {
                initialValues[key] = '';
            } else {
                // Always process variables immediately to show surrounding text
                const variables = parseVariables(value);
                let processed = value;
                variables.forEach(({ fullMatch }) => {
                    processed = processed.replace(fullMatch, '');
                });
                initialValues[key] = processed;
            }
        });
        return initialValues;
    });

    const [htmlValues, setHtmlValues] = useState<{ [key: string]: string }>(() => {
        const initialHtmlValues: { [key: string]: string } = {};
        Object.entries(sources).forEach(([key, value]) => {
            if (!value) {
                initialHtmlValues[key] = '';
            } else {
                // Always process variables immediately to show surrounding text
                const variables = parseVariables(value);
                let processed = value;
                variables.forEach(({ fullMatch }) => {
                    processed = processed.replace(fullMatch, '');
                });
                initialHtmlValues[key] = parseMarkdown(processed);
            }
        });
        return initialHtmlValues;
    });

    // Create stable references for complex objects to prevent unnecessary re-renders
    const sourcesRef = useMemo(() => sources, [JSON.stringify(sources)]);
    const connectionsRef = useMemo(() => connections, [JSON.stringify(connections)]);

    useEffect(() => {
        const fetchVariables = async () => {
            const newValues: { [key: string]: string } = {};
            const newHtmlValues: { [key: string]: string } = {};

            for (const [sourceKey, sourceValue] of Object.entries(sourcesRef)) {
                if (!sourceValue) {
                    newValues[sourceKey] = '';
                    newHtmlValues[sourceKey] = '';
                    continue;
                }

                const variables = parseVariables(sourceValue);
                let processedString = sourceValue;

                // Replace each variable with its fetched value
                for (const { variable, connectionIndex, isEscaped, fullMatch } of variables) {
                    // If no base URL is configured, just replace variables with empty strings
                    if (!baseUrl) {
                        processedString = processedString.replace(fullMatch, '');
                        continue;
                    }

                    try {
                        let targetUrl = baseUrl;

                        // If connectionIndex is specified, use the corresponding connection
                        if (connectionIndex !== undefined) {
                            if (connectionIndex === 0) {
                                // Connection [0] is the default connection
                                targetUrl = baseUrl;
                            } else {
                                // Use the additional connection
                                const connectionArray = connectionsRef;
                                const targetConnection = connectionArray[connectionIndex - 1];
                                if (targetConnection && targetConnection.url) {
                                    targetUrl = targetConnection.url;
                                } else {
                                    console.warn(`Connection [${connectionIndex}] not found or has no URL`);
                                    processedString = processedString.replace(fullMatch, '');
                                    continue;
                                }
                            }
                        }

                        const apiPath = variableToApiPath(variable);
                        const response = await fetch(`${targetUrl}${apiPath}`);

                        if (response.ok) {
                            const data = await response.text(); // API returns plain text
                            // If API returns the variable name itself or null, treat as empty
                            if (data === variable || data === 'null' || data === null || data === undefined) {
                                processedString = processedString.replace(fullMatch, '');
                            } else {
                                // If the variable is escaped, escape markdown in the value
                                const replacementValue = isEscaped ? escapeMarkdown(data) : data;
                                processedString = processedString.replace(fullMatch, replacementValue);
                            }
                        } else {
                            console.warn(`Failed to fetch ${variable} from ${targetUrl}:`, response.status);
                            processedString = processedString.replace(fullMatch, '');
                        }
                    } catch (error) {
                        console.error(`Error fetching ${variable}:`, error);
                        processedString = processedString.replace(fullMatch, '');
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

        // Set up interval - use configurable refresh rate when connection is available
        const intervalTime = baseUrl ? refreshRateMs : 5000; // Use refreshRateMs with connection, 5 seconds without
        const interval = setInterval(() => {
            // Skip updates during drag operations to prevent iOS touch interference
            if (!isDragging) {
                fetchVariables();
            }
        }, intervalTime);

        return () => clearInterval(interval);
    }, [baseUrl, sourcesRef, connectionsRef, refreshRateMs, isDragging]); // Re-run when baseUrl, sources, connections, refresh rate, or drag state change

    return { values, htmlValues };
};