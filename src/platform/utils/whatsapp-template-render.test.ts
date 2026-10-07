import { describe, expect, it } from 'vitest';
import { formatMonto, formatVencimiento, greetingFor } from './whatsapp-template-render';

describe('message helpers', () => {
  it('shows dollar amounts with the symbol and preserves other currencies', () => {
    expect(formatMonto(10, 'USD')).toBe('$10.00');
    expect(formatMonto(0)).toBe('$0.00');
    expect(formatMonto(12.345)).toBe('$12.35');
    expect(formatMonto(10, 'EUR')).toBe('EUR 10.00');
  });
  it('formats amounts, dates and greetings', () => {
    expect(formatMonto(10)).toBe('$10.00');
    expect(formatVencimiento(null)).toBe('—');
    expect(greetingFor('María Pérez', 'Buenos días')).toBe('Buenos días, María');
    expect(greetingFor('   ', 'Buenos días')).toBe('Buenos días');
  });
});
