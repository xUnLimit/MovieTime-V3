import { describe, expect, it } from 'vitest';
import { COPY_CATALOG } from './catalog';
import { COPY_BLOCK_TYPES, blockCopyProblem, blockOfCopyKey, copyKeysOfBlock, editableCopyKeysOfBlock } from './blocks';

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

  it('oculta los textos del antiguo menú de compras sin dejar de aceptarlos', () => {
    const retired = ['greeting', 'btnBuy', 'btnRenew', 'btnServices'];
    expect(editableCopyKeysOfBlock('catalogo')).toEqual(copyKeysOfBlock('catalogo').filter(key => !retired.includes(key)));
    expect(editableCopyKeysOfBlock('catalogo')).toContain('btnHelp');
    for (const type of ['resumen', 'reserva', 'pago'] as const) expect(editableCopyKeysOfBlock(type)).toEqual(copyKeysOfBlock(type));
    for (const key of retired) expect(blockCopyProblem('catalogo', key, 'Hola')).toBeNull();
  });

  it('valida el texto con las reglas de su mensaje y rechaza claves de otro bloque', () => {
    expect(blockCopyProblem('reserva', 'reservation', 'Reservé {{servicio}} por {{monto}}.')).toBeNull();
    expect(blockCopyProblem('reserva', 'reservation', 'Sin datos')).toContain('Falta el dato');
    expect(blockCopyProblem('reserva', 'greeting', 'Hola')).toContain('no pertenece a este bloque');
    expect(blockCopyProblem('reserva', 'noExiste', 'Hola')).toContain('no pertenece a este bloque');
  });
});
