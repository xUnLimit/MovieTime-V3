type AuthRoutingState = {
  isHydrated: boolean;
  isAuthenticated: boolean;
  authRecoveryError: string | null;
};

export function shouldRedirectToLogin({
  isHydrated,
  isAuthenticated,
  authRecoveryError,
}: AuthRoutingState): boolean {
  return isHydrated && !isAuthenticated && authRecoveryError === null;
}
