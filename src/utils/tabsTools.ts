/**
 * Tab constants for the application
 * Centralizes tab values to ensure consistency across components
 */
export const TAB_VALUES = {
  REALTIME: '0',
  HISTORY: '1',
} as const;

/**
 * Type definition for valid tab values
 */
export type TabValue = (typeof TAB_VALUES)[keyof typeof TAB_VALUES];

/**
 * Helper function to check if a value is a valid tab value
 */
export const isValidTabValue = (value: unknown): value is TabValue => {
  return Object.values(TAB_VALUES).includes(value as TabValue);
};

/**
 * Get all valid tab values as an array
 */
export const getValidTabValues = (): TabValue[] => {
  return Object.values(TAB_VALUES);
};
