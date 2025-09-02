/**
 * Security middleware for route protection and request validation
 */

import type { Router, RouteLocationNormalized, NavigationGuardNext } from 'vue-router';
import { validateTabValue, validateTimestamp, RateLimiter } from './securityUtils';
import { TAB_VALUES } from './tabsTools';

// Global rate limiter instance
const globalRateLimiter = new RateLimiter(1000, 60000); // 1000 requests per minute

/**
 * Security middleware configuration
 */
interface SecurityConfig {
  enableRateLimit: boolean;
  enableParameterValidation: boolean;
  logSuspiciousActivity: boolean;
}

const defaultConfig: SecurityConfig = {
  enableRateLimit: true,
  enableParameterValidation: true,
  logSuspiciousActivity: true,
};

/**
 * Log security events
 */
const logSecurityEvent = (event: string, details: Record<string, unknown>) => {
  console.warn(`[SECURITY] ${event}:`, details);

  // In production, send to security monitoring system
  if (import.meta.env.PROD) {
    // Example: sendToSecurityMonitoring(event, details);
  }
};

/**
 * Get client identifier for rate limiting
 */
const getClientIdentifier = (): string => {
  // In a real application, this could be based on IP, user ID, session, etc.
  // For now, use a simple browser fingerprint
  const userAgent = navigator.userAgent;
  const language = navigator.language;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return btoa(`${userAgent}:${language}:${timezone}`).substring(0, 32);
};

/**
 * Validate route parameters for security issues
 */
const validateRouteParameters = (query: Record<string, unknown>): boolean => {
  let isValid = true;
  const issues: string[] = [];

  // Validate tab parameter
  if (query.tab !== undefined) {
    const validTab = validateTabValue(query.tab);
    if (validTab === null) {
      issues.push(`Invalid tab parameter: ${query.tab}`);
      isValid = false;
    }
  }

  // Validate timestamp parameters
  for (const param of ['from', 'to']) {
    if (query[param] !== undefined) {
      const validTimestamp = validateTimestamp(query[param]);
      if (validTimestamp === null) {
        issues.push(`Invalid ${param} parameter: ${query[param]}`);
        isValid = false;
      }
    }
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /eval\s*\(/i,
    /expression\s*\(/i,
    /%3Cscript/i,
    /vbscript:/i,
    /data:text\/html/i,
  ];

  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(value)) {
          issues.push(`Suspicious pattern in ${key}: ${value}`);
          isValid = false;
        }
      }
    }
  }

  if (!isValid) {
    logSecurityEvent('INVALID_ROUTE_PARAMETERS', {
      query,
      issues,
      timestamp: new Date().toISOString(),
    });
  }

  return isValid;
};

/**
 * Check rate limiting
 */
const checkRateLimit = (): boolean => {
  const clientId = getClientIdentifier();
  const isAllowed = globalRateLimiter.isAllowed(clientId);

  if (!isAllowed) {
    logSecurityEvent('RATE_LIMIT_EXCEEDED', {
      clientId,
      timestamp: new Date().toISOString(),
    });
  }

  return isAllowed;
};

/**
 * Main security middleware function
 */
export const securityMiddleware = (config: Partial<SecurityConfig> = {}) => {
  const finalConfig = { ...defaultConfig, ...config };

  return (to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext) => {
    try {
      // Rate limiting check
      if (finalConfig.enableRateLimit && !checkRateLimit()) {
        logSecurityEvent('ROUTE_ACCESS_BLOCKED', {
          reason: 'rate_limit_exceeded',
          route: to.path,
          timestamp: new Date().toISOString(),
        });

        // Redirect to an error page or show a message
        // For now, we'll allow the request but log it
        // In production, you might want to block it entirely
      }

      // Parameter validation
      if (finalConfig.enableParameterValidation && !validateRouteParameters(to.query)) {
        logSecurityEvent('ROUTE_ACCESS_BLOCKED', {
          reason: 'invalid_parameters',
          route: to.path,
          query: to.query,
          timestamp: new Date().toISOString(),
        });

        // Sanitize the query parameters by removing invalid ones
        const cleanedQuery: Record<string, unknown> = {};

        // Only keep valid parameters
        if (to.query.tab !== undefined) {
          const validTab = validateTabValue(to.query.tab);
          if (validTab !== null) {
            cleanedQuery.tab = validTab;
          } else {
            cleanedQuery.tab = TAB_VALUES.REALTIME; // Default to safe value
          }
        }

        if (to.query.from !== undefined) {
          const validFrom = validateTimestamp(to.query.from);
          if (validFrom !== null) {
            cleanedQuery.from = validFrom.toString();
          }
        }

        if (to.query.to !== undefined) {
          const validTo = validateTimestamp(to.query.to);
          if (validTo !== null) {
            cleanedQuery.to = validTo.toString();
          }
        }

        // Redirect with cleaned parameters
        next({ path: to.path, query: cleanedQuery });
        return;
      }

      // All checks passed, continue to route
      next();
    } catch (error) {
      logSecurityEvent('SECURITY_MIDDLEWARE_ERROR', {
        error: error instanceof Error ? error.message : 'Unknown error',
        route: to.path,
        timestamp: new Date().toISOString(),
      });

      // In case of error, continue but log it
      next();
    }
  };
};

/**
 * Install security middleware on router
 */
export const installSecurityMiddleware = (router: Router, config?: Partial<SecurityConfig>) => {
  router.beforeEach(securityMiddleware(config));

  // Cleanup rate limiter periodically
  setInterval(() => {
    globalRateLimiter.cleanup();
  }, 300000); // Every 5 minutes
};

/**
 * Manual security check for components
 */
export const performSecurityCheck = (
  query: Record<string, unknown>,
): { isValid: boolean; sanitizedQuery: Record<string, unknown> } => {
  const isValid = validateRouteParameters(query);
  const sanitizedQuery: Record<string, unknown> = {};

  // Sanitize known parameters
  if (query.tab !== undefined) {
    const validTab = validateTabValue(query.tab);
    if (validTab !== null) {
      sanitizedQuery.tab = validTab;
    }
  }

  if (query.from !== undefined) {
    const validFrom = validateTimestamp(query.from);
    if (validFrom !== null) {
      sanitizedQuery.from = validFrom.toString();
    }
  }

  if (query.to !== undefined) {
    const validTo = validateTimestamp(query.to);
    if (validTo !== null) {
      sanitizedQuery.to = validTo.toString();
    }
  }

  return { isValid, sanitizedQuery };
};

export default securityMiddleware;
