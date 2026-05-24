import { describe, expect, it } from 'vitest';
import type { MetodoPago } from '@/types';
import {
  capitalizeFirstChar,
  formatCardNumber,
  formatExpirationDate,
  getMetodoPagoDefaultValues,
  hasMetodoPagoFormChanges,
  isAllowedCardNumberKey,
} from './helpers';
import type { MetodoPagoFormData } from './schema';

const baseMetodoPago: MetodoPago = {
  id: 'metodo-1',
  nombre: 'Banco Test',
  tipo: 'banco',
  pais: 'Panamá',
  moneda: 'USD',
  titular: 'Titular Test',
  identificador: '123456',
  alias: 'Principal',
  notas: 'Notas guardadas',
  activo: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

function valuesFromDefaults(defaults: ReturnType<typeof getMetodoPagoDefaultValues>): MetodoPagoFormData {
  return {
    nombre: defaults.nombre ?? '',
    asociadoA: defaults.asociadoA as MetodoPagoFormData['asociadoA'],
    pais: defaults.pais ?? '',
    moneda: defaults.moneda ?? '',
    alias: defaults.alias ?? '',
    titular: defaults.titular ?? '',
    notas: defaults.notas ?? '',
    tipoCuenta: defaults.tipoCuenta,
    identificador: defaults.identificador ?? '',
    email: defaults.email ?? '',
    contrasena: defaults.contrasena ?? '',
    numeroTarjeta: defaults.numeroTarjeta ?? '',
    fechaExpiracion: defaults.fechaExpiracion ?? '',
  };
}

describe('metodo pago form helpers', () => {
  it('hydrates saved notes and detects no changes for user payment methods', () => {
    const metodoPago: MetodoPago = {
      ...baseMetodoPago,
      asociadoA: 'tercero',
      tipoCuenta: 'ahorro',
    };

    const defaults = getMetodoPagoDefaultValues('edit', metodoPago);

    expect(defaults.notas).toBe('Notas guardadas');
    expect(defaults.alias).toBe('Principal');
    expect(defaults.moneda).toBe('USD');
    expect(hasMetodoPagoFormChanges('edit', metodoPago, valuesFromDefaults(defaults))).toBe(false);
  });

  it('hydrates saved notes and detects no changes for service payment methods', () => {
    const metodoPago: MetodoPago = {
      ...baseMetodoPago,
      asociadoA: 'servicio',
      tipoCuenta: undefined,
      email: 'servicio@example.com',
      contrasena: 'secret123',
      numeroTarjeta: '4111 1111 1111 1111',
      fechaExpiracion: '12/30',
    };

    const defaults = getMetodoPagoDefaultValues('edit', metodoPago);

    expect(defaults.notas).toBe('Notas guardadas');
    expect(defaults.alias).toBe('Principal');
    expect(defaults.moneda).toBe('USD');
    expect(hasMetodoPagoFormChanges('edit', metodoPago, valuesFromDefaults(defaults))).toBe(false);
  });

  it('detects changes for create mode, base fields and associated-specific fields', () => {
    const terceroMetodoPago: MetodoPago = {
      ...baseMetodoPago,
      asociadoA: 'tercero',
      tipoCuenta: 'ahorro',
    };
    const terceroValues = valuesFromDefaults(getMetodoPagoDefaultValues('edit', terceroMetodoPago));

    expect(hasMetodoPagoFormChanges('create', undefined, terceroValues)).toBe(true);
    expect(hasMetodoPagoFormChanges('edit', terceroMetodoPago, {
      ...terceroValues,
      alias: 'Otro alias',
    })).toBe(true);
    expect(hasMetodoPagoFormChanges('edit', terceroMetodoPago, {
      ...terceroValues,
      tipoCuenta: 'corriente',
    })).toBe(true);

    const servicioMetodoPago: MetodoPago = {
      ...baseMetodoPago,
      asociadoA: 'servicio',
      email: 'servicio@example.com',
      contrasena: 'secret123',
    };
    const servicioValues = valuesFromDefaults(getMetodoPagoDefaultValues('edit', servicioMetodoPago));

    expect(hasMetodoPagoFormChanges('edit', servicioMetodoPago, {
      ...servicioValues,
      contrasena: 'otra-clave',
    })).toBe(true);
  });

  it('formats card and expiration inputs', () => {
    expect(formatCardNumber('4111-1111-1111-1111-999')).toBe('4111 1111 1111 1111 999');
    expect(formatExpirationDate('1230', '')).toBe('12/30');
    expect(formatExpirationDate('12', '1')).toBe('12/');
    expect(formatExpirationDate('1', '12/')).toBe('1');
    expect(formatExpirationDate('', '1')).toBe('');
  });

  it('checks card key input and capitalizes text', () => {
    expect(isAllowedCardNumberKey('1')).toBe(true);
    expect(isAllowedCardNumberKey('Backspace')).toBe(true);
    expect(isAllowedCardNumberKey('x')).toBe(false);
    expect(capitalizeFirstChar('panama')).toBe('Panama');
    expect(capitalizeFirstChar('')).toBe('');
  });
});
