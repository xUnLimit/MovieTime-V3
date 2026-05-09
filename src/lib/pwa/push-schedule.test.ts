import { describe, expect, it } from 'vitest';

import { getExecutivePushDueStatus } from './push-schedule';

describe('getExecutivePushDueStatus', () => {
  it('marks the summary due after the configured local send time', () => {
    const result = getExecutivePushDueStatus(
      {
        enabled: true,
        sendTime: '08:00',
        timezone: 'America/Bogota',
        lastSentDate: null,
      },
      new Date('2026-05-09T13:03:00.000Z')
    );

    expect(result).toMatchObject({ due: true, today: '2026-05-09' });
  });

  it('skips before the configured local send time', () => {
    const result = getExecutivePushDueStatus(
      {
        enabled: true,
        sendTime: '08:00',
        timezone: 'America/Bogota',
        lastSentDate: null,
      },
      new Date('2026-05-09T12:59:00.000Z')
    );

    expect(result).toEqual({ due: false, reason: 'before_send_time', today: '2026-05-09' });
  });

  it('skips when it already sent for the local day', () => {
    const result = getExecutivePushDueStatus(
      {
        enabled: true,
        sendTime: '08:00',
        timezone: 'America/Bogota',
        lastSentDate: '2026-05-09',
      },
      new Date('2026-05-09T18:00:00.000Z')
    );

    expect(result).toEqual({ due: false, reason: 'already_sent_today', today: '2026-05-09' });
  });
});
