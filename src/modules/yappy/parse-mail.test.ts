import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseYappyMime } from '@/platform/server/yappy-imap';
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

describe('parseYappyMail with the phone-icon line Gmail produces from Yappy HTML', () => {
  const icon = '[https://publicimage.yappy.cloud/common/notifications/buttons/ico-cellphone.png]';
  const withIcon = (phone: string) => example.replace('****-0268', icon + phone);

  it('reads the real HTML notice of a saved contact with the full phone number', async () => {
    const mail = await parseYappyMime(readFileSync(join(process.cwd(), 'src/modules/yappy/__fixtures__/yappy-full-phone.eml')));
    expect(mail?.dmarcPass).toBe(true);
    expect(parseYappyMail(mail?.text ?? '')).toEqual({ ok: true, payment: {
      amount: 0.02, confirmationCode: 'TESTX-10000001', payerNameShort: 'Cliente Prueba',
      payerPhoneLast4: '1234', paidAt: '2026-09-27T21:03:00.000Z',
    } });
  });
  it.each([
    ['****-0268', '0268'], ['60001234', '1234'], ['6000-1234', '1234'], ['+507 6000-1234', '1234'], ['50760001234', '1234'],
  ])('takes the last four digits from %s', (phone, last4) => {
    expect(parseYappyMail(withIcon(phone))).toMatchObject({ ok: true, payment: { payerPhoneLast4: last4 } });
  });
  it.each(['', 'sin número', '1234', '600012345', '****'])('rejects an unreadable phone line %j', (phone) => {
    expect(parseYappyMail(withIcon(phone))).toEqual({ ok: false, reason: 'telefono' });
  });
  it('never mistakes the eight-digit confirmation code for the phone', () => {
    expect(parseYappyMail(example.replace('****-0268\n', '').replace('GZCSS-20613095', 'AACLN-13665153')))
      .toEqual({ ok: false, reason: 'telefono' });
  });
  it('rejects a notice with two phone-icon lines', () => {
    expect(parseYappyMail(`${withIcon('60001234')}\n${icon}60005678`)).toEqual({ ok: false, reason: 'telefono' });
  });
});
