type ExecutivePushSchedule = {
  enabled: boolean;
  sendTime?: string;
  windowStart?: string;
  windowEnd?: string;
  intervalHours?: number;
  timezone: string;
  lastSentAt?: string | Date | null;
  lastSentDate?: string | null;
  lastSentSlot?: string | null;
};

export type ExecutivePushDueResult =
  | {
      due: true;
      today: string;
      currentMinutes: number;
      windowStartMinutes: number;
      windowEndMinutes: number;
      intervalHours: number;
      scheduledMinutes: number;
      slotKey: string;
    }
  | {
      due: false;
      reason:
        | 'disabled'
        | 'invalid_time'
        | 'invalid_interval'
        | 'outside_window'
        | 'interval_not_elapsed'
        | 'slot_already_sent';
      today: string;
      slotKey?: string;
    };

function parseTime(value: string | undefined) {
  const match = /^(\d{2}):(\d{2})$/.exec(value ?? '');
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
}

function getLocalParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  const hour = Number(value('hour'));
  const minute = Number(value('minute'));

  return {
    today: `${value('year')}-${value('month')}-${value('day')}`,
    currentMinutes: hour * 60 + minute,
  };
}

function isInsideWindow(currentMinutes: number, windowStartMinutes: number, windowEndMinutes: number) {
  if (windowStartMinutes === windowEndMinutes) return false;
  if (windowStartMinutes < windowEndMinutes) {
    return currentMinutes >= windowStartMinutes && currentMinutes < windowEndMinutes;
  }
  return currentMinutes >= windowStartMinutes || currentMinutes < windowEndMinutes;
}

function normalizeIntervalHours(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return null;
  const hours = Number(value);
  if (!Number.isInteger(hours) || hours < 1 || hours > 24) return null;
  return hours;
}

function parseLastSentAt(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTimeFromMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(remainingMinutes).padStart(2, '0')}`;
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getCurrentSlot(
  today: string,
  currentMinutes: number,
  windowStartMinutes: number,
  windowEndMinutes: number,
  intervalHours: number
) {
  const stepMinutes = intervalHours * 60;

  if (windowStartMinutes < windowEndMinutes) {
    const scheduledMinutes = windowStartMinutes
      + Math.floor((currentMinutes - windowStartMinutes) / stepMinutes) * stepMinutes;

    return {
      scheduledMinutes,
      slotKey: `${today}T${formatTimeFromMinutes(scheduledMinutes)}`,
    };
  }

  const currentExtendedMinutes = currentMinutes >= windowStartMinutes
    ? currentMinutes
    : currentMinutes + 24 * 60;
  const scheduledExtendedMinutes = windowStartMinutes
    + Math.floor((currentExtendedMinutes - windowStartMinutes) / stepMinutes) * stepMinutes;
  const scheduledMinutes = scheduledExtendedMinutes % (24 * 60);
  const slotDate = scheduledExtendedMinutes >= 24 * 60
    ? today
    : currentMinutes < windowEndMinutes
      ? addDays(today, -1)
      : today;

  return {
    scheduledMinutes,
    slotKey: `${slotDate}T${formatTimeFromMinutes(scheduledMinutes)}`,
  };
}

export function getExecutivePushDueStatus(
  schedule: ExecutivePushSchedule,
  now: Date = new Date()
): ExecutivePushDueResult {
  const { today, currentMinutes } = getLocalParts(now, schedule.timezone);

  if (!schedule.enabled) {
    return { due: false, reason: 'disabled', today };
  }

  const windowStartMinutes = parseTime(schedule.windowStart ?? schedule.sendTime ?? '08:00');
  const windowEndMinutes = parseTime(schedule.windowEnd ?? '22:00');
  if (windowStartMinutes === null || windowEndMinutes === null || windowStartMinutes === windowEndMinutes) {
    return { due: false, reason: 'invalid_time', today };
  }

  const intervalHours = normalizeIntervalHours(schedule.intervalHours ?? 24);
  if (intervalHours === null) {
    return { due: false, reason: 'invalid_interval', today };
  }

  if (!isInsideWindow(currentMinutes, windowStartMinutes, windowEndMinutes)) {
    return { due: false, reason: 'outside_window', today };
  }

  const currentSlot = getCurrentSlot(
    today,
    currentMinutes,
    windowStartMinutes,
    windowEndMinutes,
    intervalHours
  );

  if (schedule.lastSentSlot && schedule.lastSentSlot === currentSlot.slotKey) {
    return { due: false, reason: 'slot_already_sent', today, slotKey: currentSlot.slotKey };
  }

  const lastSentAt = parseLastSentAt(schedule.lastSentAt);
  if (lastSentAt && !schedule.lastSentSlot) {
    const elapsedMs = now.getTime() - lastSentAt.getTime();
    if (elapsedMs < intervalHours * 60 * 60 * 1000) {
      return { due: false, reason: 'interval_not_elapsed', today };
    }
  }

  return {
    due: true,
    today,
    currentMinutes,
    windowStartMinutes,
    windowEndMinutes,
    intervalHours,
    scheduledMinutes: currentSlot.scheduledMinutes,
    slotKey: currentSlot.slotKey,
  };
}

export function getExecutivePushDeliverySkipReason(subscriptionCount: number, sent: number) {
  if (subscriptionCount === 0) return 'no_active_subscriptions';
  if (sent === 0) return 'no_successful_deliveries';
  return null;
}
