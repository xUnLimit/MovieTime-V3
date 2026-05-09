import { describe, expect, it } from 'vitest';

import { getExecutivePushDeliverySkipReason, getExecutivePushDueStatus } from './push-schedule';

describe('getExecutivePushDueStatus', () => {
  it('marks the summary due inside the configured local window', () => {
    const result = getExecutivePushDueStatus(
      {
        enabled: true,
        windowStart: '08:00',
        windowEnd: '22:00',
        intervalHours: 4,
        timezone: 'America/Bogota',
        lastSentAt: null,
      },
      new Date('2026-05-09T13:03:00.000Z')
    );

    expect(result).toMatchObject({ due: true, today: '2026-05-09' });
  });

  it('skips outside the configured local window', () => {
    const result = getExecutivePushDueStatus(
      {
        enabled: true,
        windowStart: '08:00',
        windowEnd: '22:00',
        intervalHours: 4,
        timezone: 'America/Bogota',
        lastSentAt: null,
      },
      new Date('2026-05-09T12:59:00.000Z')
    );

    expect(result).toEqual({ due: false, reason: 'outside_window', today: '2026-05-09' });
  });

  it('skips until the configured interval has elapsed after the last successful send', () => {
    const result = getExecutivePushDueStatus(
      {
        enabled: true,
        windowStart: '08:00',
        windowEnd: '22:00',
        intervalHours: 4,
        timezone: 'America/Bogota',
        lastSentAt: '2026-05-09T13:00:00.000Z',
      },
      new Date('2026-05-09T16:59:00.000Z')
    );

    expect(result).toEqual({ due: false, reason: 'interval_not_elapsed', today: '2026-05-09' });
  });

  it('supports windows that cross midnight', () => {
    const result = getExecutivePushDueStatus(
      {
        enabled: true,
        windowStart: '22:00',
        windowEnd: '06:00',
        intervalHours: 4,
        timezone: 'UTC',
        lastSentAt: null,
      },
      new Date('2026-05-09T23:00:00.000Z')
    );

    expect(result).toMatchObject({ due: true, today: '2026-05-09' });
  });

  it('keeps the daily push retryable when no delivery succeeded', () => {
    expect(getExecutivePushDeliverySkipReason(0, 0)).toBe('no_active_subscriptions');
    expect(getExecutivePushDeliverySkipReason(2, 0)).toBe('no_successful_deliveries');
    expect(getExecutivePushDeliverySkipReason(2, 1)).toBeNull();
  });
});
