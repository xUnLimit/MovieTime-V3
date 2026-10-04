import { describe, expect, it } from 'vitest';
import { COPY_CATALOG } from './catalog';
import { COPY_BLOCK_TYPES, blockCopyProblem, blockOfCopyKey, copyKeysOfBlock } from './blocks';

describe('bloques de commerce-copy', () => {
  it('cada texto pertenece a un solo bloque y ninguno queda fuera', () => {
    const all = COPY_BLOCK_TYPES.flatMap(copyKeysOfBlock);
    expect(all).toHaveLength(Object.keys(COPY_CATALOG).length);
    expect(new Set(all).size).toBe(all.length);
  });

  it('agrupa los pasos de la conversación por bloque', () => {
    expect(blockOfCopyKey('greeting')).toBe('catalogo');
    expect(blockOfCopyKey('btnReview')).toBe('resumen');
    expect(blockOfCopyKey('reservation')).toBe('reserva');
    expect(blockOfCopyKey('help')).toBe('pago');
  });

  it('valida el texto con las reglas de su mensaje y rechaza claves de otro bloque', () => {
    expect(blockCopyProblem('reserva', 'reservation', 'Reservé {{servicio}} por {{monto}}.')).toBeNull();
    expect(blockCopyProblem('reserva', 'reservation', 'Sin datos')).toContain('Falta el dato');
    expect(blockCopyProblem('reserva', 'greeting', 'Hola')).toContain('no pertenece a este bloque');
    expect(blockCopyProblem('reserva', 'noExiste', 'Hola')).toContain('no pertenece a este bloque');
  });
});
