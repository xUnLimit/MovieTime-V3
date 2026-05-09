type ExecutivePushSchedule = {
  enabled: boolean;
  sendTime: string;
  timezone: string;
  lastSentDate?: string | null;
};

export type ExecutivePushDueResult =
  | { due: true; today: string; currentMinutes: number; scheduledMinutes: number }
  | { due: false; reason: 'disabled' | 'invalid_time' | 'already_sent_today' | 'before_send_time'; today: string };

function parseSendTime(sendTime: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(sendTime);
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

export function getExecutivePushDueStatus(
  schedule: ExecutivePushSchedule,
  now: Date = new Date()
): ExecutivePushDueResult {
  const { today, currentMinutes } = getLocalParts(now, schedule.timezone);

  if (!schedule.enabled) {
    return { due: false, reason: 'disabled', today };
  }

  const scheduledMinutes = parseSendTime(schedule.sendTime);
  if (scheduledMinutes === null) {
    return { due: false, reason: 'invalid_time', today };
  }

  if (schedule.lastSentDate === today) {
    return { due: false, reason: 'already_sent_today', today };
  }

  if (currentMinutes < scheduledMinutes) {
    return { due: false, reason: 'before_send_time', today };
  }

  return { due: true, today, currentMinutes, scheduledMinutes };
}

export function getExecutivePushDeliverySkipReason(subscriptionCount: number, sent: number) {
  if (subscriptionCount === 0) return 'no_active_subscriptions';
  if (sent === 0) return 'no_successful_deliveries';
  return null;
}
