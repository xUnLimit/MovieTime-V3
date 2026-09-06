import { describe, expect, it } from 'vitest';
import { createMutationIntent } from './mutation-intent';

describe('mutation intent', () => {
  it('preserves the key on retry, including after editing and reverting a form', () => {
    const intent = createMutationIntent();
    const key = intent.keyFor({ amount: 10 });
    expect(intent.keyFor({ amount: 10 })).toBe(key);
    expect(intent.keyFor({ amount: 20 })).not.toBe(key);
    expect(intent.keyFor({ amount: 10 })).toBe(key);
  });

  it('keeps intentional identical operations separate', () => {
    expect(createMutationIntent().keyFor({ amount: 10 })).not.toBe(createMutationIntent().keyFor({ amount: 10 }));
  });
});
