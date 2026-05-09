import { describe, expect, it } from 'vitest';

import { getOfflineAuthDecision } from './offline-auth';

describe('getOfflineAuthDecision', () => {
  it('preserves persisted auth when the app is offline', () => {
    expect(getOfflineAuthDecision({ isOnline: false, hasPersistedUser: true })).toBe('preserve');
  });

  it('ignores offline auth loss when no user was persisted', () => {
    expect(getOfflineAuthDecision({ isOnline: false, hasPersistedUser: false })).toBe('ignore');
  });

  it('clears auth on online auth loss or profile failure', () => {
    expect(getOfflineAuthDecision({ isOnline: true, hasPersistedUser: true })).toBe('clear');
  });
});
