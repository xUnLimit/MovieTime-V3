import { describe, expect, it } from 'vitest';
import { deliveryPassword } from './code-access';
describe('deliveryPassword', () => {
  it.each([true, false, undefined])('uses the account policy (%s)', (flag) => {
    expect(deliveryPassword('private-test-password', flag)).toBe(flag ? '' : 'private-test-password');
  });
  it.each([null, undefined, ''])('never manufactures a missing password', (password) => {
    expect(deliveryPassword(password, false)).toBe('');
    expect(deliveryPassword(password, true)).toBe('');
  });
});
