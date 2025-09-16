import { computed, reactive } from 'vue';

export interface SecurityAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  details?: string;
  timestamp: Date;
  dismissed: boolean;
  autoHide?: boolean;
  onRetry?: () => void;
}

// Global security store using Vue's reactivity
const securityState = reactive({
  alerts: [] as SecurityAlert[],
  securityEvents: [] as Array<{
    type: string;
    details: Record<string, unknown>;
    timestamp: Date;
  }>,
});

export const useSecurityStore = () => {
  // Getters
  const activeAlerts = computed(() => securityState.alerts.filter((alert) => !alert.dismissed));

  const criticalAlerts = computed(() => activeAlerts.value.filter((alert) => alert.type === 'error'));

  const hasActiveAlerts = computed(() => activeAlerts.value.length > 0);

  const hasCriticalAlerts = computed(() => criticalAlerts.value.length > 0);

  // Actions
  const addAlert = (alert: Omit<SecurityAlert, 'id' | 'timestamp' | 'dismissed'>): string => {
    const id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newAlert: SecurityAlert = {
      ...alert,
      id,
      timestamp: new Date(),
      dismissed: false,
    };

    securityState.alerts.unshift(newAlert);

    // Log security event
    logSecurityEvent('ALERT_CREATED', {
      alertId: id,
      type: alert.type,
      title: alert.title,
    });

    // Auto-remove old alerts (keep only last 50)
    if (securityState.alerts.length > 50) {
      securityState.alerts = securityState.alerts.slice(0, 50);
    }

    return id;
  };

  const dismissAlert = (alertId: string) => {
    const alert = securityState.alerts.find((a: SecurityAlert) => a.id === alertId);
    if (alert) {
      alert.dismissed = true;
      logSecurityEvent('ALERT_DISMISSED', { alertId });
    }
  };

  const dismissAllAlerts = () => {
    securityState.alerts.forEach((alert: SecurityAlert) => {
      alert.dismissed = true;
    });
    logSecurityEvent('ALL_ALERTS_DISMISSED', { count: securityState.alerts.length });
  };

  const removeAlert = (alertId: string) => {
    const index = securityState.alerts.findIndex((a: SecurityAlert) => a.id === alertId);
    if (index !== -1) {
      securityState.alerts.splice(index, 1);
      logSecurityEvent('ALERT_REMOVED', { alertId });
    }
  };

  const clearOldAlerts = (olderThanHours = 24) => {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const initialCount = securityState.alerts.length;

    securityState.alerts = securityState.alerts.filter((alert: SecurityAlert) => alert.timestamp > cutoffTime);

    const removedCount = initialCount - securityState.alerts.length;
    if (removedCount > 0) {
      logSecurityEvent('OLD_ALERTS_CLEARED', { removedCount, olderThanHours });
    }
  };

  const logSecurityEvent = (type: string, details: Record<string, unknown>) => {
    securityState.securityEvents.unshift({
      type,
      details,
      timestamp: new Date(),
    });

    // Keep only last 100 events
    if (securityState.securityEvents.length > 100) {
      securityState.securityEvents = securityState.securityEvents.slice(0, 100);
    }

    // In development, log to console
    if (import.meta.env.DEV) {
      console.warn(`[SECURITY] ${type}:`, details);
    }

    // In production, send to monitoring service
    if (import.meta.env.PROD) {
      // Example: sendToMonitoringService(type, details);
    }
  };

  // Quick helper methods for common alert types
  const addWarning = (title: string, message: string, details?: string) => {
    return addAlert({
      type: 'warning',
      title,
      message,
      details,
      autoHide: true,
    });
  };

  const addError = (title: string, message: string, details?: string, onRetry?: () => void) => {
    return addAlert({
      type: 'error',
      title,
      message,
      details,
      autoHide: false,
      onRetry,
    });
  };

  const addInfo = (title: string, message: string, details?: string) => {
    return addAlert({
      type: 'info',
      title,
      message,
      details,
      autoHide: true,
    });
  };

  // Security-specific alert methods
  const addParameterValidationError = (invalidParams: string[]) => {
    return addError(
      'Invalid parameters detected',
      'Some URL parameters have been corrected for security reasons.',
      `Invalid parameters: ${invalidParams.join(', ')}`,
    );
  };

  const addRateLimitWarning = () => {
    return addWarning(
      'Request limit reached',
      'You are making too many requests. Please slow down.',
      'This limitation protects the application against abuse.',
    );
  };

  const addSuspiciousActivityAlert = (activity: string, details: Record<string, unknown>) => {
    return addError(
      'Suspicious activity detected',
      `Potentially malicious activity: ${activity}`,
      JSON.stringify(details, null, 2),
    );
  };

  const addCredentialError = () => {
    return addError(
      'Authentication error',
      'The provided credentials are invalid or corrupted.',
      'Please check your credentials and try again.',
    );
  };

  // Auto-cleanup: run periodically to clean old data
  const startAutoCleanup = () => {
    // Clean old alerts every hour
    setInterval(
      () => {
        clearOldAlerts(24); // Remove alerts older than 24 hours
      },
      60 * 60 * 1000,
    );

    // Clean old events every 6 hours
    setInterval(
      () => {
        const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours
        const initialCount = securityState.securityEvents.length;

        securityState.securityEvents = securityState.securityEvents.filter((event) => event.timestamp > cutoffTime);

        const removedCount = initialCount - securityState.securityEvents.length;
        if (removedCount > 0) {
          logSecurityEvent('OLD_EVENTS_CLEARED', { removedCount });
        }
      },
      6 * 60 * 60 * 1000,
    );
  };

  return {
    // State
    alerts: securityState.alerts,
    securityEvents: securityState.securityEvents,

    // Getters
    activeAlerts,
    criticalAlerts,
    hasActiveAlerts,
    hasCriticalAlerts,

    // Actions
    addAlert,
    dismissAlert,
    dismissAllAlerts,
    removeAlert,
    clearOldAlerts,
    logSecurityEvent,

    // Quick helpers
    addWarning,
    addError,
    addInfo,

    // Security-specific
    addParameterValidationError,
    addRateLimitWarning,
    addSuspiciousActivityAlert,
    addCredentialError,

    // Cleanup
    startAutoCleanup,
  };
};
