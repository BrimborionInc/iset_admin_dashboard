export const REMINDER_BUSINESS_TIMEZONE = 'America/Toronto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const REMINDER_BUSINESS_DAY_FORMATTER =
  typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function'
    ? new Intl.DateTimeFormat('en-CA', {
        timeZone: REMINDER_BUSINESS_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    : null;

const REMINDER_BUSINESS_DATE_LABEL_FORMATTER =
  typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function'
    ? new Intl.DateTimeFormat('en-CA', {
        timeZone: REMINDER_BUSINESS_TIMEZONE,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

const parseReminderBusinessDayParts = value => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  if (REMINDER_BUSINESS_DAY_FORMATTER && typeof REMINDER_BUSINESS_DAY_FORMATTER.formatToParts === 'function') {
    try {
      const parts = REMINDER_BUSINESS_DAY_FORMATTER.formatToParts(date);
      let year = '';
      let month = '';
      let day = '';
      for (const part of parts) {
        if (part.type === 'year') year = part.value;
        if (part.type === 'month') month = part.value;
        if (part.type === 'day') day = part.value;
      }
      if (year && month && day) {
        return {
          year: Number(year),
          month: Number(month),
          day: Number(day),
        };
      }
    } catch (_) {
      // Fall through to UTC fallback below.
    }
  }

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
};

export const getReminderBusinessDayStamp = value => {
  const parts = parseReminderBusinessDayParts(value);
  if (!parts) return null;
  return Date.UTC(parts.year, parts.month - 1, parts.day);
};

export const getReminderBusinessDayKey = value => {
  const parts = parseReminderBusinessDayParts(value);
  if (!parts) return null;
  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
};

export const getReminderBusinessDayDiffDays = (earlier, later = new Date()) => {
  const earlierStamp = getReminderBusinessDayStamp(earlier);
  const laterStamp = getReminderBusinessDayStamp(later);
  if (earlierStamp === null || laterStamp === null) return null;
  return Math.floor((laterStamp - earlierStamp) / MS_PER_DAY);
};

export const getReminderBusinessDate = value => {
  const parts = parseReminderBusinessDayParts(value);
  if (!parts) return null;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0));
};

export const formatReminderBusinessDate = value => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  if (REMINDER_BUSINESS_DATE_LABEL_FORMATTER) {
    try {
      return REMINDER_BUSINESS_DATE_LABEL_FORMATTER.format(date);
    } catch (_) {
      // Fall through to calendar-date fallback below.
    }
  }

  const businessDate = getReminderBusinessDate(date);
  return businessDate ? businessDate.toISOString().slice(0, 10) : '';
};
