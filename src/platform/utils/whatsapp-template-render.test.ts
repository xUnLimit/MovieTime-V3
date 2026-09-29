import { describe, expect, it, vi } from 'vitest';

import { getSaludo } from './whatsapp';
import { formatMonto, formatVencimiento, greetingFor, renderEditorTemplate } from './whatsapp-template-render';

const context = {
  clienteNombre: 'María José Pérez',
  categoriaNombre: 'Netflix',
  servicioNombre: 'Netflix 01',
  perfilNombre: 'María',
  correo: 'cuenta@example.com',
  contrasena: 'clave-demo',
  codigo: '1234',
  fechaVencimiento: new Date(2026, 8, 30),
  monto: 4.5,
};

describe('renderEditorTemplate', () => {
  it('fills every editor placeholder with the sale data', () => {
    const template = '{saludo}, {nombre_cliente} ({cliente}). {servicio} / {categoria} / {perfil_nombre} / {correo} / {contrasena} / {codigo} / {vencimiento} / {monto} / {items}';

    expect(renderEditorTemplate(template, context, 'Buenas tardes')).toBe(
      'Buenas tardes, María (María José Pérez). Netflix 01 / Netflix / María / cuenta@example.com / clave-demo / 1234 / 30 de septiembre de 2026 / $4.50 / *Netflix*'
    );
  });

  it('renders the items block once for the selected sale', () => {
    const template = 'Tus datos:\n{{#items}}\n> {categoria}\n🔑 {contrasena}\n{{/items}}\n\nGracias';

    expect(renderEditorTemplate(template, context, 'Hola')).toBe('Tus datos:\n> Netflix\n🔑 clave-demo\n\nGracias');
  });

  it('uses placeholders for missing values', () => {
    const empty = { ...context, perfilNombre: '', correo: '', contrasena: '', codigo: '', servicioNombre: '', fechaVencimiento: null };

    expect(renderEditorTemplate('{perfil_nombre} {correo} {contrasena} {codigo} {vencimiento} {servicio}', empty, 'Hola'))
      .toBe('— — — — — Netflix');
  });

  it('uses the Panama-time greeting by default, the same one the server sends', () => {
    vi.useFakeTimers();
    try {
      // [instante UTC, saludo esperado en Panamá (UTC-5)]
      const cases: [string, string][] = [
        ['2026-10-01T06:00:00Z', 'Buenas'], // 1:00 am
        ['2026-10-01T14:00:00Z', 'Buenos días'], // 9:00 am
        ['2026-10-01T22:39:00Z', 'Buenas tardes'], // 5:39 pm
        ['2026-10-02T01:00:00Z', 'Buenas noches'], // 8:00 pm
      ];
      for (const [instant, saludo] of cases) {
        vi.setSystemTime(new Date(instant));
        expect(renderEditorTemplate('{saludo}', context)).toBe(saludo);
        expect(getSaludo()).toBe(saludo);
        expect(greetingFor('María Pérez')).toBe(`${saludo}, María`);
      }
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('message helpers', () => {
  it('formats amounts, dates and greetings', () => {
    expect(formatMonto(10)).toBe('$10.00');
    expect(formatVencimiento(null)).toBe('—');
    expect(greetingFor('María Pérez', 'Buenos días')).toBe('Buenos días, María');
    expect(greetingFor('   ', 'Buenos días')).toBe('Buenos días');
  });
});
