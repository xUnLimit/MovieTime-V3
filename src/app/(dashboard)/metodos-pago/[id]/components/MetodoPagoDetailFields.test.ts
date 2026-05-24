import { describe, expect, it } from 'vitest';

import { maskCardNumber } from './MetodoPagoDetailFields';

describe('MetodoPagoDetailFields', () => {
  it('masks card numbers preserving only the last four digits', () => {
    expect(maskCardNumber('4111 1111 1111 1234')).toBe('•••• •••• •••• 1234');
    expect(maskCardNumber('5555-4444-3333-9999')).toBe('•••• •••• •••• 9999');
  });
});
