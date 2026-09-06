import { describe, expect, it } from 'vitest';
import { afterCommit, MutationCommittedError } from './mutation-committed-error';

describe('afterCommit', () => {
  it('preserves the result when secondary work succeeds', async () => {
    await expect(afterCommit('payment', async () => ({ saved: true }))).resolves.toEqual({ saved: true });
  });
  it('identifies committed operations and retains the cause', async () => {
    const cause = new Error('refresh failed');
    await expect(afterCommit('payment', async () => { throw cause; })).rejects.toMatchObject({
      name: 'MutationCommittedError', operationId: 'payment', cause,
    });
  });
  it('does not overwrite an inner committed operation identifier', async () => {
    const error = new MutationCommittedError('payment', new Error('log failed'));
    await expect(afterCommit('sale', async () => { throw error; })).rejects.toBe(error);
  });
});
