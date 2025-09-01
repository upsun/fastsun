// Date period constants
export const DATE_PERIODS = {
  WEEK: 'week',
  MONTH: 'month',
  YEAR: 'year',
} as const;

export type DatePeriod = (typeof DATE_PERIODS)[keyof typeof DATE_PERIODS];

// Utility functions for timestamp formatting
export const formatDateForUrl = (date: Date): string => {
  return date.getTime().toString(); // Convert to timestamp
};

export const parseDateFromUrl = (timestampStr: string): Date | null => {
  if (!timestampStr) return null;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return null;
  const date = new Date(timestamp);
  return isNaN(date.getTime()) ? null : date;
};

// Get current week's start (Monday) and end (Sunday)
export const getCurrentWeek = (): [Date, Date] => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust when day is Sunday

  const startOfWeek = new Date(now.setDate(diff));
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  return [startOfWeek, endOfWeek];
};

// Get current month's start and end
export const getCurrentMonth = (): [Date, Date] => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return [startOfMonth, endOfMonth];
};

// Get current year's start and end
export const getCurrentYear = (): [Date, Date] => {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const endOfYear = new Date(now.getFullYear(), 11, 31);

  return [startOfYear, endOfYear];
};

// Get current period based on selected option
export const getCurrentPeriod = (period: string): [Date, Date] => {
  switch (period) {
    case DATE_PERIODS.WEEK:
      return getCurrentWeek();
    case DATE_PERIODS.MONTH:
      return getCurrentMonth();
    case DATE_PERIODS.YEAR:
      return getCurrentYear();
    default:
      return getCurrentMonth();
  }
};
