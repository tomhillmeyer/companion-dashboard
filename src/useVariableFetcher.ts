import { useEffect, useState, useMemo, useRef } from 'react';

// A failed variable is not re-requested for this long, isolating a bad reference
// so it can't hammer the server or slow down the fetches that are working.
const VARIABLE_SKIP_MS = 5000;

// Shallow equality for the flat { key: string } maps used here. Equivalent to the
// previous JSON-compare change detection, but without serializing the whole map
// on every poll (which is GC-heavy with many boxes/variables).
const shallowEqual = (a: { [key: string]: string }, b: { [key: string]: string }): boolean => {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of bKeys) {
        if (a[key] !== b[key]) return false;
    }
    return true;
};

interface CompanionConnection {
    id: string;
    url: string;
    label: string;
}

// Parse variables from a source string like "$(internal:time_hms_12)" or "$(custom:1266_active)" or "[2]$(custom:test)"
// Also detects escaped variables like "\$(connection:variable)"
export const parseVariables = (source: string): Array<{variable: string, connectionIndex?: number, isEscaped: boolean, fullMatch: string}> => {
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
export const escapeMarkdown = (text: string): string => {
    // Escape markdown special characters: * _ [ ] ( ) !
    return text.replace(/([*_\[\]()!])/g, '\\$1');
};

// Simple markdown parser for basic formatting
export const parseMarkdown = (text: string): string => {
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

// Resolve every variable reference in a source string against a live variable lookup map.
// Lookup keys are the full "$(connection:name)" references. Unresolved/absent variables are
// stripped (matching the fetcher's behavior of showing surrounding text). Escaped variables
// ("\$(...)") are replaced with markdown-escaped values so their content stays literal.
export const resolveSourceValue = (
    source: string,
    variableLookup: { [key: string]: string } | undefined
): string => {
    if (!source || !variableLookup) {
        return source || '';
    }

    const variables = parseVariables(source);
    if (variables.length === 0) {
        return source;
    }

    let processed = source;
    for (const { variable, isEscaped, fullMatch } of variables) {
        const lookupKey = `$(${variable})`;
        const replacement = variableLookup[lookupKey];
        if (replacement === undefined || replacement === null) {
            processed = processed.replace(fullMatch, '');
        } else if (isEscaped) {
            processed = processed.replace(fullMatch, escapeMarkdown(replacement));
        } else {
            processed = processed.replace(fullMatch, replacement);
        }
    }

    return processed;
};

export const useVariableFetcher = (
    baseUrl: string,
    sources: { [key: string]: string }, // e.g., { headerLabelSource: "$(internal:time_hms_12)", leftLabelSource: "Hello $(custom:test)" }
    connections: CompanionConnection[] = [], // Additional connections
    refreshRateMs: number = 250, // Configurable refresh rate in milliseconds
    isDragging: boolean = false, // Pause updates during drag operations
    preFetchedRawValues?: { [key: string]: string } // Pre-fetched raw variable values (for web clients)
) => {
    // Track consecutive fetch failures for exponential backoff
    const consecutiveFailuresRef = useRef<number>(0);
    const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentIntervalTimeRef = useRef<number>(refreshRateMs);
    const inFlightRef = useRef<boolean>(false);
    // Per-variable skip window: a failed variable is not re-requested for a few
    // seconds so one bad reference can't hammer the server or degrade other fetches.
    const variableSkipUntilRef = useRef<Map<string, number>>(new Map());

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

    const [rawValues, setRawValues] = useState<{ [key: string]: string }>(() => {
        const initialRawValues: { [key: string]: string } = {};
        Object.entries(sources).forEach(([key, value]) => {
            if (!value) {
                initialRawValues[key] = '';
            } else {
                // Always process variables immediately to show surrounding text
                const variables = parseVariables(value);
                let processed = value;
                variables.forEach(({ fullMatch }) => {
                    processed = processed.replace(fullMatch, '');
                });
                initialRawValues[key] = processed;
            }
        });
        return initialRawValues;
    });

    // Create stable references for complex objects to prevent unnecessary re-renders
    const sourcesRef = useMemo(() => sources, [JSON.stringify(sources)]);
    const connectionsRef = useMemo(() => connections, [JSON.stringify(connections)]);

    useEffect(() => {
        // Reset failure tracking when baseUrl changes
        consecutiveFailuresRef.current = 0;
        currentIntervalTimeRef.current = refreshRateMs;
    }, [baseUrl, refreshRateMs]);

    useEffect(() => {
        const fetchVariables = async () => {

            // Skip if a previous fetch cycle is still running (prevents overlapping fetches)
            if (inFlightRef.current) {
                return;
            }
            inFlightRef.current = true;

            try {
            // If pre-fetched values are provided, use local processing only (no fetch)
            const usePreFetched = preFetchedRawValues && Object.keys(preFetchedRawValues).length > 0;

            const newValues: { [key: string]: string } = {};
            const newHtmlValues: { [key: string]: string } = {};
            const newRawValues: { [key: string]: string } = {};
            let totalVariablesAttempted = 0;
            let totalVariablesFailed = 0;

            for (const [sourceKey, sourceValue] of Object.entries(sourcesRef)) {
                if (!sourceValue) {
                    newValues[sourceKey] = '';
                    newHtmlValues[sourceKey] = '';
                    newRawValues[sourceKey] = '';
                    continue;
                }

                // If using pre-fetched values (web client mode), look up by source key directly
                if (usePreFetched && preFetchedRawValues) {
                    const preFetchedValue = preFetchedRawValues[sourceValue];

                    if (preFetchedValue !== undefined && preFetchedValue !== null) {
                        newValues[sourceKey] = preFetchedValue;
                        newRawValues[sourceKey] = preFetchedValue;
                        newHtmlValues[sourceKey] = parseMarkdown(preFetchedValue);
                    } else {
                        newValues[sourceKey] = '';
                        newRawValues[sourceKey] = '';
                        newHtmlValues[sourceKey] = '';
                    }
                    continue;
                }

                const variables = parseVariables(sourceValue);
                let processedString = sourceValue;

                // Replace each variable with its fetched value (Electron mode - fetch from Companion)
                for (const { variable, connectionIndex, isEscaped, fullMatch } of variables) {

                    // Otherwise, fetch from Companion (Electron mode)
                    // If no base URL is configured, just replace variables with empty strings
                    if (!baseUrl) {
                        processedString = processedString.replace(fullMatch, '');
                        continue;
                    }

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

                    // Skip recently-failed variables so a bad reference doesn't get
                    // re-requested every cycle (or slow down the ones that work).
                    const variableKey = `${targetUrl}|${variable}`;
                    if ((variableSkipUntilRef.current.get(variableKey) || 0) > Date.now()) {
                        processedString = processedString.replace(fullMatch, '');
                        continue;
                    }
                    totalVariablesAttempted += 1;

                    try {
                        const apiPath = variableToApiPath(variable);
                        const response = await fetch(`${targetUrl}${apiPath}`);

                        if (response.ok) {
                            variableSkipUntilRef.current.delete(variableKey);
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
                            variableSkipUntilRef.current.set(variableKey, Date.now() + VARIABLE_SKIP_MS);
                            totalVariablesFailed += 1;
                        }
                    } catch (error) {
                        console.error(`Error fetching ${variable}:`, error);
                        processedString = processedString.replace(fullMatch, '');
                        variableSkipUntilRef.current.set(variableKey, Date.now() + VARIABLE_SKIP_MS);
                        totalVariablesFailed += 1;
                    }
                }

                newValues[sourceKey] = processedString;
                newRawValues[sourceKey] = processedString; // Store raw value before markdown processing
                newHtmlValues[sourceKey] = parseMarkdown(processedString);
            }

            // Only slow down when the whole connection is unreachable (every attempted
            // variable failed). A single bad variable is isolated by the skip window
            // above and must never degrade fetching for the rest.
            if (!usePreFetched && totalVariablesAttempted > 0 && totalVariablesFailed >= totalVariablesAttempted) {
                consecutiveFailuresRef.current += 1;
                // Exponential backoff: 100ms → 1s → 5s → 30s (max)
                const backoffDelays = [100, 1000, 5000, 30000];
                const newInterval = backoffDelays[Math.min(consecutiveFailuresRef.current - 1, backoffDelays.length - 1)];

                if (currentIntervalTimeRef.current !== newInterval) {
                    currentIntervalTimeRef.current = newInterval;
                    console.warn(`Connection failed (${consecutiveFailuresRef.current} times), backing off to ${newInterval}ms`);

                    // Restart interval with new backoff delay
                    if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                        intervalRef.current = setInterval(() => {
                            if (!isDragging) {
                                fetchVariables();
                            }
                        }, newInterval);
                    }
                }
            } else if (!usePreFetched && totalVariablesAttempted > 0 && totalVariablesFailed < totalVariablesAttempted && consecutiveFailuresRef.current > 0) {
                // Any variable succeeded - connection is alive, resume the normal refresh rate
                consecutiveFailuresRef.current = 0;
                const normalInterval = baseUrl ? refreshRateMs : 5000;

                if (currentIntervalTimeRef.current !== normalInterval) {
                    currentIntervalTimeRef.current = normalInterval;
                    console.log('Connection recovered, resuming normal refresh rate');

                    // Restart interval with normal refresh rate
                    if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                        intervalRef.current = setInterval(() => {
                            if (!isDragging) {
                                fetchVariables();
                            }
                        }, normalInterval);
                    }
                }
            }

            // Only update if values have actually changed
            setValues(prevValues => (shallowEqual(prevValues, newValues) ? prevValues : newValues));
            setHtmlValues(prevHtmlValues => (shallowEqual(prevHtmlValues, newHtmlValues) ? prevHtmlValues : newHtmlValues));
            setRawValues(prevRawValues => (shallowEqual(prevRawValues, newRawValues) ? prevRawValues : newRawValues));
            } catch (error) {
                console.error('Variable fetch cycle error:', error);
            } finally {
                inFlightRef.current = false;
            }
        };

        // Initial fetch
        fetchVariables();

        // In pre-fetched mode there is no polling - this effect re-runs whenever preFetchedRawValues changes
        const usePreFetched = preFetchedRawValues && Object.keys(preFetchedRawValues).length > 0;
        if (usePreFetched) {
            return () => {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            };
        }

        // Set up interval - use configurable refresh rate when connection is available
        const intervalTime = baseUrl ? refreshRateMs : 5000; // Use refreshRateMs with connection, 5 seconds without
        intervalRef.current = setInterval(() => {
            // Skip updates during drag operations to prevent iOS touch interference
            if (!isDragging) {
                fetchVariables();
            }
        }, intervalTime);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [baseUrl, sourcesRef, connectionsRef, refreshRateMs, isDragging, preFetchedRawValues]); // Re-run when baseUrl, sources, connections, refresh rate, drag state, or pre-fetched values change

    return { values, htmlValues, rawValues };
};