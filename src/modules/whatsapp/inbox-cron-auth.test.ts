import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { isAuthorizedInboxCron } from './inbox-cron-auth';

describe('inbox cron authorization', () => {
  it('requires configured strong secret and bounded bearer credentials', () => {
    const secret = randomBytes(32).toString('hex');
    const request = (authorization?: string) => new Request('https://example.test', { headers: authorization ? { authorization } : {} });
    expect(isAuthorizedInboxCron(request(`Bearer ${secret}`), secret)).toBe(true);
    expect(isAuthorizedInboxCron(request(`Bearer ${secret}`), '')).toBe(false);
    expect(isAuthorizedInboxCron(request('Bearer short'), 'short')).toBe(false);
    expect(isAuthorizedInboxCron(request(`Bearer ${randomBytes(32).toString('hex')}`), secret)).toBe(false);
    expect(isAuthorizedInboxCron(request(), secret)).toBe(false);
    expect(isAuthorizedInboxCron(request(`Basic ${secret}`), secret)).toBe(false);
    expect(isAuthorizedInboxCron(request(`Bearer ${'a'.repeat(2048)}`), secret)).toBe(false);
  });
});
