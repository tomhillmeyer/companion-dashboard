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
    /*if (variable.startsWith('custom:')) {
        const name = variable.replace('custom:', '');
        return `/api/custom-variable/${name}/value`;
    } else {
        // Format: "internal:time_hms_12" -> "/api/variable/internal/time_hms_12/value"
        const [connectionLabel, variableName] = variable.split(':', 2);
        return `/api/variable/${connectionLabel}/${variableName}/value`;
    }*/

    const [connectionLabel, variableName] = variable.split(':', 2);
    return `/api/variable/${connectionLabel}/${variableName}/value`;
};

export const useVariableFetcher = (
    baseUrl: string,
    sources: { [key: string]: string } // e.g., { headerLabelSource: "$(internal:time_hms_12)", leftLabelSource: "Hello $(custom:test)" }
) => {
    const [values, setValues] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        if (!baseUrl) return;

        const fetchVariables = async () => {
            const newValues: { [key: string]: string } = {};

            for (const [sourceKey, sourceValue] of Object.entries(sources)) {
                if (!sourceValue) {
                    newValues[sourceKey] = '';
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
            }

            setValues(newValues);
        };

        // Initial fetch
        fetchVariables();

        // Set up interval for every second
        const interval = setInterval(fetchVariables, 1000);

        return () => clearInterval(interval);
    }, [baseUrl, JSON.stringify(sources)]); // Re-run when baseUrl or sources change

    return values;
};