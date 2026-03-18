/**
 * Variable Comparison Utilities
 *
 * Provides comparison operators for variable conditions.
 */

import type { ComparisonOperator } from './types';

/**
 * Evaluates a comparison between a variable value and a target value using the specified operator.
 * Attempts numeric comparison first, falls back to string comparison.
 *
 * @param variableValue - The actual value from the variable
 * @param operator - The comparison operator to use
 * @param targetValue - The value to compare against
 * @returns true if the comparison evaluates to true, false otherwise
 */
export function evaluateComparison(
    variableValue: string | number,
    operator: ComparisonOperator,
    targetValue: string
): boolean {
    const varStr = String(variableValue);

    // Try numeric comparison if both values are numeric
    const varNum = parseFloat(varStr);
    const targetNum = parseFloat(targetValue);
    const bothNumeric = !isNaN(varNum) && !isNaN(targetNum);

    switch (operator) {
        case '==':
            return bothNumeric ? varNum === targetNum : varStr === targetValue;

        case '!=':
            return bothNumeric ? varNum !== targetNum : varStr !== targetValue;

        case '<':
            return bothNumeric ? varNum < targetNum : varStr < targetValue;

        case '<=':
            return bothNumeric ? varNum <= targetNum : varStr <= targetValue;

        case '>':
            return bothNumeric ? varNum > targetNum : varStr > targetValue;

        case '>=':
            return bothNumeric ? varNum >= targetNum : varStr >= targetValue;

        default:
            console.warn(`Unknown operator: ${operator}, defaulting to equality`);
            return bothNumeric ? varNum === targetNum : varStr === targetValue;
    }
}

/**
 * Gets a human-readable label for a comparison operator
 */
export function getOperatorLabel(operator: ComparisonOperator): string {
    switch (operator) {
        case '==': return 'equals';
        case '!=': return 'not equals';
        case '<': return 'less than';
        case '<=': return 'less than or equal';
        case '>': return 'greater than';
        case '>=': return 'greater than or equal';
        default: return operator;
    }
}
