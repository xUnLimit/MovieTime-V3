import { describe, expect, it } from 'vitest';

import { shouldRedirectToLogin } from './auth-routing';

describe('shouldRedirectToLogin', () => {
  it('redirects only after hydration confirms there is no session to recover', () => {
    expect(
      shouldRedirectToLogin({
        isHydrated: true,
        isAuthenticated: false,
        authRecoveryError: null,
      })
    ).toBe(true);
  });

  it('keeps the user on the current screen while a saved session can be recovered', () => {
    expect(
      shouldRedirectToLogin({
        isHydrated: true,
        isAuthenticated: false,
        authRecoveryError: 'temporary failure',
      })
    ).toBe(false);
  });

  it('does not redirect before hydration finishes', () => {
    expect(
      shouldRedirectToLogin({
        isHydrated: false,
        isAuthenticated: false,
        authRecoveryError: null,
      })
    ).toBe(false);
  });
});
