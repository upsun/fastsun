import mitt from 'mitt';

/**
 * List of global event type.
 */
export const enum EventType {
  LOG_REFRESH = 'log.refresh',
}

/**
 * Global event engine.
 */
export const eventBus = mitt();
