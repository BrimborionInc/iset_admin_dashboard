const SURFACE = 'admin';

const TEXT = {
  en: {
    scheduledTitle: 'Scheduled maintenance',
    unscheduledTitle: 'Urgent maintenance notice',
    upcomingDefault: 'PATH will be unavailable for maintenance soon.',
    upcomingWithCountdown: countdown => `PATH will be unavailable for maintenance in ${countdown}.`,
    activeDefault: 'PATH is currently undergoing maintenance.',
    activeOverdue: 'PATH is still undergoing maintenance and is taking longer than expected.',
    saveProgress: 'Save your progress now.',
    expectedDowntime: duration => `Expected downtime: ${duration}.`,
    startingSoon: 'starting soon',
  },
};

export function isMaintenanceAnnouncementVisible(announcement) {
  if (!announcement || announcement.enabled !== true) return false;
  const surfaces = Array.isArray(announcement.surfaces) ? announcement.surfaces : [];
  return surfaces.includes(SURFACE);
}

export function getMaintenanceAnnouncementPhase(announcement, now = new Date()) {
  if (!isMaintenanceAnnouncementVisible(announcement)) return 'hidden';
  const startsAt = announcement?.startsAt ? Date.parse(announcement.startsAt) : null;
  if (Number.isFinite(startsAt) && startsAt > now.getTime()) {
    return 'scheduled';
  }
  return 'active';
}

function formatDuration(minutes) {
  const numeric = Number(minutes);
  if (!Number.isFinite(numeric) || numeric <= 0) return '';
  if (numeric < 60) {
    return `${numeric} minute${numeric === 1 ? '' : 's'}`;
  }
  const hours = Math.floor(numeric / 60);
  const remainder = numeric % 60;
  if (!remainder) {
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  return `${hours} hour${hours === 1 ? '' : 's'} ${remainder} minute${remainder === 1 ? '' : 's'}`;
}

function formatCountdown(target, now = new Date()) {
  const diffSeconds = Math.max(0, Math.round((Date.parse(target) - now.getTime()) / 1000));
  if (diffSeconds < 60) {
    return `${diffSeconds} second${diffSeconds === 1 ? '' : 's'}`;
  }
  const minutes = Math.round(diffSeconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  return formatDuration(Math.round(diffSeconds / 60));
}

export function buildMaintenanceAnnouncementDisplay(announcement, { now = new Date(), locale = 'en' } = {}) {
  const copy = TEXT[locale] || TEXT.en;
  const phase = getMaintenanceAnnouncementPhase(announcement, now);
  if (phase === 'hidden') return null;

  const title = announcement?.title?.[locale]
    || (announcement?.status === 'unscheduled' ? copy.unscheduledTitle : copy.scheduledTitle);
  const customBody = announcement?.body?.[locale] || '';
  const durationText = formatDuration(announcement?.expectedDurationMinutes);
  const expectedEndAt = announcement?.expectedEndAt ? Date.parse(announcement.expectedEndAt) : null;
  const isPastExpectedEnd = Number.isFinite(expectedEndAt) && expectedEndAt < now.getTime();

  let message = customBody;
  if (!message) {
    if (phase === 'scheduled') {
      message = announcement?.startsAt
        ? copy.upcomingWithCountdown(formatCountdown(announcement.startsAt, now))
        : copy.upcomingDefault;
    } else {
      message = isPastExpectedEnd ? copy.activeOverdue : copy.activeDefault;
    }
  }

  const detailParts = [];
  if (durationText) {
    detailParts.push(copy.expectedDowntime(durationText));
  }
  if (phase === 'scheduled') {
    detailParts.push(copy.saveProgress);
  }

  return {
    title,
    message,
    detail: detailParts.join(' '),
  };
}
