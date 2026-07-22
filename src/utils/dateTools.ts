// Utility functions for timestamp formatting
export const formatDateForUrl = (date: Date): string => {
  return Math.floor(date.getTime() / 1000).toString(); // Convert to timestamp in seconds
};

export const parseDateFromUrl = (timestampStr: string): Date | null => {
  if (!timestampStr) return null;

  // Remove any non-numeric characters to prevent injection
  const cleanedStr = timestampStr.replace(/[^0-9]/g, '');

  if (!cleanedStr) return null;

  // Parse as integer with radix 10 to prevent octal/hex parsing
  const timestamp = parseInt(cleanedStr, 10);

  // Validate timestamp range (reasonable bounds)
  const MIN_TIMESTAMP = 946684800; // Year 2000
  const MAX_TIMESTAMP = 4102444800; // Year 2100

  if (isNaN(timestamp) || timestamp < MIN_TIMESTAMP || timestamp > MAX_TIMESTAMP) {
    return null;
  }

  const date = new Date(timestamp * 1000); // Convert from seconds to milliseconds
  return isNaN(date.getTime()) ? null : date;
};

// Timezone modes for the historical view
export const TIME_ZONES = {
  UTC: 'utc',
  LOCAL: 'local',
} as const;

export type TimeZoneMode = (typeof TIME_ZONES)[keyof typeof TIME_ZONES];

/**
 * Transforms a real epoch (ms) into a value that, when rendered by a
 * local-timezone chart formatter, displays the desired wall-clock time.
 * In 'local' mode the epoch is returned unchanged; in 'utc' mode it is
 * shifted so the local formatter prints the UTC wall-clock instead.
 * The offset is computed per-timestamp so DST transitions are handled.
 *
 * Caveat: toWallClockDate()/fromWallClock() derive the offset from slightly
 * different instants, so the round-trip can drift by up to 1h for wall-clock
 * times that land within a DST transition. This only affects the custom-range
 * picker seed in UTC mode near a transition and is considered acceptable.
 */
export const toDisplayTimestamp = (epochMs: number, tz: TimeZoneMode): number => {
  if (tz === TIME_ZONES.UTC) {
    return epochMs + new Date(epochMs).getTimezoneOffset() * 60000;
  }
  return epochMs;
};

/**
 * Interprets the wall-clock fields of a Date (as produced by a date/time
 * picker) in the selected timezone and returns the real epoch (ms).
 * Inverse of toDisplayTimestamp.
 */
export const fromWallClock = (date: Date, tz: TimeZoneMode): number => {
  if (tz === TIME_ZONES.UTC) {
    return date.getTime() - date.getTimezoneOffset() * 60000;
  }
  return date.getTime();
};

/**
 * Builds a Date whose local wall-clock fields equal the given epoch's
 * wall-clock in the selected timezone (used to seed the custom pickers).
 */
export const toWallClockDate = (epochMs: number, tz: TimeZoneMode): Date => {
  return new Date(toDisplayTimestamp(epochMs, tz));
};

/**
 * Chooses a sensible x-axis tick unit from the total span of the range,
 * independent of the data resolution (mirrors the Fastly chart behaviour).
 */
export const displayUnitForSpan = (spanMs: number): string => {
  const HOUR = 3600000;
  const DAY = 86400000;
  if (spanMs <= 2 * HOUR) return 'minute';
  if (spanMs <= 3 * DAY) return 'hour';
  if (spanMs <= 60 * DAY) return 'day';
  return 'month';
};
