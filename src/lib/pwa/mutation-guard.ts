import { isOfflineEnvironment, offlineMutationError } from './offline-helpers';

export function assertOnlineMutation(): void {
  if (isOfflineEnvironment()) {
    throw offlineMutationError();
  }
}
