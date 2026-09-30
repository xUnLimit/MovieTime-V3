import { describe, expect, it } from 'vitest';
import { formatMonto, formatVencimiento, greetingFor } from './whatsapp-template-render';

describe('message helpers', () => {
  it('formats amounts, dates and greetings', () => {
    expect(formatMonto(10)).toBe('$10.00');
    expect(formatVencimiento(null)).toBe('—');
    expect(greetingFor('María Pérez', 'Buenos días')).toBe('Buenos días, María');
    expect(greetingFor('   ', 'Buenos días')).toBe('Buenos días');
  });
});
