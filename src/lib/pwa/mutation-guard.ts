import { isOfflineEnvironment, offlineMutationError } from './offline-helpers';
import { isOfflineAuthSessionActive } from './offline-auth';

export function assertOnlineMutation(): void {
  if (isOfflineEnvironment() || isOfflineAuthSessionActive()) {
    throw offlineMutationError();
  }
}
