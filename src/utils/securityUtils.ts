/**
 * Security utilities for input validation and sanitization
 * Prevents injection attacks and validates user inputs
 */

import { TAB_VALUES, type TabValue } from './tabsTools';

/**
 * Validate and sanitize timestamp parameters from URL
 * @param timestampStr - The timestamp string from URL parameters
 * @returns Valid timestamp or null if invalid
 */
export const validateTimestamp = (timestampStr: unknown): number | null => {
  // Ensure input is a string
  if (typeof timestampStr !== 'string') {
    return null;
  }

  // Remove any non-numeric characters to prevent injection
  const cleanedStr = timestampStr.replace(/[^0-9]/g, '');

  // Check if empty after cleaning
  if (!cleanedStr) {
    return null;
  }

  // Parse as integer with radix 10 to prevent octal/hex parsing
  const timestamp = parseInt(cleanedStr, 10);

  // Validate timestamp range (reasonable bounds)
  // Unix timestamp for 2000-01-01: 946684800
  // Unix timestamp for 2100-01-01: 4102444800
  const MIN_TIMESTAMP = 946684800; // Year 2000
  const MAX_TIMESTAMP = 4102444800; // Year 2100

  if (isNaN(timestamp) || timestamp < MIN_TIMESTAMP || timestamp > MAX_TIMESTAMP) {
    return null;
  }

  return timestamp;
};

/**
 * Validate tab parameter from URL
 * @param tabValue - The tab value from URL parameters
 * @returns Valid tab value or null if invalid
 */
export const validateTabValue = (tabValue: unknown): TabValue | null => {
  if (typeof tabValue !== 'string') {
    return null;
  }

  // Check against whitelist of valid tab values
  if (Object.values(TAB_VALUES).includes(tabValue as TabValue)) {
    return tabValue as TabValue;
  }

  return null;
};

/**
 * Validate service ID parameter
 * @param serviceId - The service ID string
 * @returns Valid service ID or null if invalid
 */
export const validateServiceId = (serviceId: unknown): string | null => {
  if (typeof serviceId !== 'string') {
    return null;
  }

  // Fastly service IDs are alphanumeric strings, typically 22 characters
  // Allow only alphanumeric characters and underscores
  const cleanedId = serviceId.replace(/[^a-zA-Z0-9_]/g, '');

  if (!cleanedId || cleanedId.length < 8 || cleanedId.length > 50) {
    return null;
  }

  return cleanedId;
};

/**
 * Validate token parameter
 * @param token - The token string
 * @returns Valid token or null if invalid
 */
export const validateToken = (token: unknown): string | null => {
  if (typeof token !== 'string') {
    return null;
  }

  // Remove any potentially dangerous characters
  // Allow only alphanumeric, hyphens, and underscores
  const cleanedToken = token.replace(/[^a-zA-Z0-9\-_]/g, '');

  if (!cleanedToken || cleanedToken.length < 10 || cleanedToken.length > 200) {
    return null;
  }

  return cleanedToken;
};

/**
 * Validate API endpoint parameters
 * @param param - The parameter value
 * @returns Valid parameter or null if invalid
 */
export const validateApiParam = (param: unknown): string | null => {
  if (typeof param !== 'string') {
    return null;
  }

  // Remove potentially dangerous characters
  // Allow alphanumeric, hyphens, underscores, and periods
  const cleanedParam = param.replace(/[^a-zA-Z0-9\-_.]/g, '');

  if (!cleanedParam || cleanedParam.length > 100) {
    return null;
  }

  return cleanedParam;
};

/**
 * Sanitize user input for display (prevent XSS)
 * @param input - The user input string
 * @returns Sanitized string safe for display
 */
export const sanitizeForDisplay = (input: unknown): string => {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Validate date range to prevent abuse
 * @param fromDate - Start date
 * @param toDate - End date
 * @returns True if valid date range, false otherwise
 */
export const validateDateRange = (fromDate: Date, toDate: Date): boolean => {
  // Check if dates are valid
  if (!(fromDate instanceof Date) || !(toDate instanceof Date)) {
    return false;
  }

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return false;
  }

  // Check if from date is before to date
  if (fromDate >= toDate) {
    return false;
  }

  // Prevent excessive date ranges (max 2 years)
  const maxRangeMs = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years in milliseconds
  if (toDate.getTime() - fromDate.getTime() > maxRangeMs) {
    return false;
  }

  // Prevent dates too far in the future
  const now = new Date();
  const maxFutureMs = 30 * 24 * 60 * 60 * 1000; // 30 days in the future
  if (fromDate.getTime() > now.getTime() + maxFutureMs) {
    return false;
  }

  return true;
};

/**
 * Create a secure URL search params object
 * @param params - Object with parameter key-value pairs
 * @returns URLSearchParams with validated parameters
 */
export const createSecureSearchParams = (params: Record<string, unknown>): URLSearchParams => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    // Validate key
    const cleanKey = key.replace(/[^a-zA-Z0-9_]/g, '');
    if (!cleanKey) return;

    // Validate and convert value
    let cleanValue: string | null = null;

    if (typeof value === 'string') {
      cleanValue = validateApiParam(value);
    } else if (typeof value === 'number') {
      cleanValue = value.toString();
    }

    if (cleanValue) {
      searchParams.append(cleanKey, cleanValue);
    }
  });

  return searchParams;
};

/**
 * Rate limiting helper to prevent abuse
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if request is allowed
   * @param identifier - Unique identifier for the client
   * @returns True if request is allowed, false if rate limited
   */
  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing requests for this identifier
    const requests = this.requests.get(identifier) || [];

    // Filter out old requests outside the window
    const recentRequests = requests.filter((timestamp) => timestamp > windowStart);

    // Check if under limit
    if (recentRequests.length >= this.maxRequests) {
      return false;
    }

    // Add current request
    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);

    return true;
  }

  /**
   * Clear old entries to prevent memory leaks
   */
  cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [identifier, requests] of this.requests.entries()) {
      const recentRequests = requests.filter((timestamp) => timestamp > windowStart);
      if (recentRequests.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, recentRequests);
      }
    }
  }
}
