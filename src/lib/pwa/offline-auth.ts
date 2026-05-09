export type OfflineAuthDecision = 'preserve' | 'clear' | 'ignore';

type OfflineAuthDecisionInput = {
  isOnline: boolean;
  hasPersistedUser: boolean;
};

export function getOfflineAuthDecision({
  isOnline,
  hasPersistedUser,
}: OfflineAuthDecisionInput): OfflineAuthDecision {
  if (isOnline) return 'clear';
  return hasPersistedUser ? 'preserve' : 'ignore';
}
