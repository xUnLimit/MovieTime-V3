import { ApiClientError } from '@/platform/api/contracts';
import { DomainError } from './domain-errors';
import { MutationCommittedError } from './mutation-committed-error';

export function getPublicErrorMessage(error: unknown, fallback: string): string {
  if (
    error instanceof DomainError ||
    error instanceof MutationCommittedError ||
    error instanceof ApiClientError
  ) {
    return error.message;
  }
  return fallback;
}
