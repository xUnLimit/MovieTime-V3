import { describe, expect, it } from 'vitest';
import { parseYappyMail } from './parse-mail';

const example = `Te enviaron por Yappy
$2.00
Enviado por
Emmanuel S.
****-0268
Fecha 27 sept 2026 01:07 p. m.
Mensaje
Confirmación GZCSS-20613095`;

describe('parseYappyMail', () => {
  it('extracts the real notice in Panama local time', () => {
    expect(parseYappyMail(example)).toEqual({ ok: true, payment: {
      amount: 2, confirmationCode: 'GZCSS-20613095', payerNameShort: 'Emmanuel S.',
      payerPhoneLast4: '0268', paidAt: '2026-09-27T18:07:00.000Z',
    } });
  });
  it.each(['sept', 'set', 'sep'])('supports Spanish month %s', (month) => {
    expect(parseYappyMail(example.replace('sept', month)).ok).toBe(true);
  });
  it('parses midnight and a large amount with an optional message', () => {
    const result = parseYappyMail(example.replace('$2.00', '$1,250.00').replace('01:07 p. m.', '12:07 a. m.')
      .replace('Mensaje\n', 'Mensaje\nGracias por el servicio\n'));
    expect(result).toMatchObject({ ok: true, payment: { amount: 1250, paidAt: '2026-09-27T05:07:00.000Z' } });
  });
  it('accepts tabs and nonbreaking spaces', () => {
    expect(parseYappyMail(example.replace('Enviado por\n', 'Enviado\tpor\n').replace('27 sept', '27\u00a0sept')).ok).toBe(true);
  });
  it.each([
    ['monto', '$2.00', ''], ['monto', '$2.00', '$3.00\n$2.00'],
    ['confirmacion', 'Confirmación GZCSS-20613095', ''],
    ['confirmacion', 'Confirmación GZCSS-20613095', 'Confirmación A-1\nConfirmación GZCSS-20613095'],
    ['telefono', '****-0268', ''], ['fecha', '27 sept 2026', '31 feb 2026'],
  ])('rejects invalid %s', (reason, original, replacement) => {
    expect(parseYappyMail(example.replace(original, replacement))).toEqual({ ok: false, reason });
  });
});
