import { describe, expect, it } from 'vitest';
import { extractConfirmationCode } from './confirmation-code';

describe('extractConfirmationCode', () => {
  it('reads a typed code and normalizes case', () => {
    expect(extractConfirmationCode(' gzcss-20613095 ')).toBe('GZCSS-20613095');
  });

  it('finds the code inside receipt text', () => {
    expect(extractConfirmationCode('Pago Yappy $2.00 Fecha 2026-10-02 Confirmación GZCSS-20613095 Gracias')).toBe('GZCSS-20613095');
  });

  it('does not mistake dates or phone numbers for a code', () => {
    expect(extractConfirmationCode('2026-10-02 6123-4567')).toBeNull();
  });

  it('returns null for several distinct codes and accepts a repeated one', () => {
    expect(extractConfirmationCode('AAAAA-12345678 y BBBBB-12345678')).toBeNull();
    expect(extractConfirmationCode('AAAAA-12345678 AAAAA-12345678')).toBe('AAAAA-12345678');
  });

  it('handles empty, non-string and oversized input', () => {
    expect(extractConfirmationCode(null)).toBeNull();
    expect(extractConfirmationCode('')).toBeNull();
    expect(extractConfirmationCode(`${'x'.repeat(3000)} AAAAA-12345678`)).toBeNull();
  });
});
