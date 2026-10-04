import { describe, expect, it, vi } from 'vitest';
import { COPY_CATALOG, COPY_KEYS, COPY_VARIABLES, isCopyKey, type CopyKey } from './catalog';
import { copyCommandSchema } from './contracts';
import { FLOW_STEPS, copyKeysOfStep, stepTitle } from './flow';
import { copyMarkers, copyProblem, createCopy, renderCopyText, sampleValues } from './render';
import { createCommerceCopyStore } from './store';

describe('catalogo de textos', () => {
  it('cada texto original cumple sus propias reglas y pertenece a un paso del mapa', () => {
    const steps = new Set(FLOW_STEPS.map(step => step.id));
    for (const key of COPY_KEYS) {
      expect(copyProblem(key, COPY_CATALOG[key].defaultText), key).toBeNull();
      expect(steps.has(COPY_CATALOG[key].step), key).toBe(true);
      for (const name of COPY_CATALOG[key].required) expect(COPY_CATALOG[key].variables, key).toContain(name);
      for (const name of COPY_CATALOG[key].variables) expect(COPY_VARIABLES[name]).toBeTruthy();
    }
  });

  it('los textos originales no usan jerga técnica', () => {
    for (const key of COPY_KEYS) expect(COPY_CATALOG[key].defaultText, key).not.toMatch(/servidor|canal de recepci|revalida|operador|CÓDIGO/);
  });

  it('botones y filas respetan los límites de WhatsApp', () => {
    for (const key of COPY_KEYS) {
      const spec = COPY_CATALOG[key];
      if (spec.kind !== 'message') expect(spec.defaultText.length, key).toBeLessThanOrEqual(spec.maxLength);
      if (spec.kind === 'button') expect(spec.maxLength).toBe(20);
    }
  });

  it('reconoce claves y todo paso del mapa tiene mensajes', () => {
    expect(isCopyKey('greeting')).toBe(true);
    expect(isCopyKey('toString')).toBe(false);
    expect(isCopyKey(3)).toBe(false);
    for (const step of FLOW_STEPS) expect(copyKeysOfStep(step.id).length, step.id).toBeGreaterThan(0);
    expect(stepTitle('pago')).toBe('Pago y estado');
    expect(stepTitle('otro' as never)).toBe('otro');
  });
});

describe('validación y render', () => {
  it('rechaza vacío, exceso, símbolos, datos desconocidos y datos obligatorios ausentes', () => {
    expect(copyProblem('greeting', '   ')).toMatch(/vacío/);
    expect(copyProblem('greeting', 'a'.repeat(901))).toMatch(/900/);
    expect(copyProblem('greeting', '<b>Hola</b>')).toMatch(/símbolos/);
    expect(copyProblem('greeting', 'Hola {{monto}}')).toMatch(/\{\{monto\}\}/);
    expect(copyProblem('reservation', 'Reservado')).toMatch(/\{\{servicio\}\}/);
    expect(copyProblem('btnBuy', 'Comprar\nahora')).toMatch(/una sola línea/);
    expect(copyProblem('btnBuy', 'Un botón demasiado largo')).toMatch(/20/);
    expect(copyProblem('reservation', 'Reservé {{servicio}} por {{monto}}.')).toBeNull();
  });

  it('inserta datos sin reinterpretar marcadores dentro de ellos', () => {
    expect(copyMarkers('{{a}} y {{b}} y {{a}}')).toEqual(['a', 'b']);
    expect(renderCopyText('Hola {{servicio}}', { servicio: '{{monto}}' })).toBe('Hola {{monto}}');
    expect(renderCopyText('Hola {{falta}}.')).toBe('Hola .');
  });

  it('usa el texto editado solo si es válido y cae al original si no', () => {
    const t = createCopy({ greeting: '  ¡Buenas! ¿En qué te ayudo?  ', btnBuy: 'Un botón demasiado largo', help: '<x>' });
    expect(t('greeting')).toBe('¡Buenas! ¿En qué te ayudo?');
    expect(t('btnBuy')).toBe('Adquirir servicio');
    expect(t('help')).toBe(COPY_CATALOG.help.defaultText);
    expect(createCopy(undefined)('cancelled')).toBe(COPY_CATALOG.cancelled.defaultText);
  });

  it('la vista previa tiene un ejemplo para cada dato del mensaje', () => {
    const key: CopyKey = 'reservation';
    expect(Object.keys(sampleValues(key)).sort()).toEqual([...COPY_CATALOG[key].variables].sort());
    expect(renderCopyText(COPY_CATALOG[key].defaultText, sampleValues(key))).not.toContain('{{');
  });
});

describe('orden para guardar', () => {
  it('acepta un texto válido y la restauración (null)', () => {
    expect(copyCommandSchema.safeParse({ key: 'greeting', text: 'Hola' }).success).toBe(true);
    expect(copyCommandSchema.safeParse({ key: 'greeting', text: null }).success).toBe(true);
  });

  it('rechaza claves desconocidas, campos extra y textos que no cumplen el mensaje', () => {
    expect(copyCommandSchema.safeParse({ key: 'nope', text: 'Hola' }).success).toBe(false);
    expect(copyCommandSchema.safeParse({ key: 'greeting', text: 'Hola', extra: 1 }).success).toBe(false);
    const bad = copyCommandSchema.safeParse({ key: 'reservation', text: 'Sin datos' });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.message).toMatch(/servicio/);
  });
});

describe('lectura de textos editados', () => {
  const client = (rows: unknown[] | null, error: unknown = null) => ({
    from: vi.fn(() => ({ select: vi.fn(() => ({ limit: vi.fn().mockResolvedValue({ data: rows, error }) })) })),
  }) as never;

  it('ignora filas con claves desconocidas o que ya no cumplen las reglas', async () => {
    const store = createCommerceCopyStore(client([
      { key: 'greeting', text: 'Hola' }, { key: 'viejo', text: 'x' }, { key: 'btnBuy', text: 'Un botón demasiado largo' },
    ]));
    expect(await store.overrides()).toEqual({ greeting: 'Hola' });
    expect(await createCommerceCopyStore(client(null)).overrides()).toEqual({});
  });

  it('informa cuándo se editó cada texto y falla con un error controlado', async () => {
    expect(await createCommerceCopyStore(client([{ key: 'greeting', updated_at: '2026-10-08T10:00:00Z' }])).updatedAt())
      .toEqual({ greeting: '2026-10-08T10:00:00Z' });
    await expect(createCommerceCopyStore(client(null, { message: 'boom' })).overrides()).rejects.toThrow('No se pudieron leer los textos de compras.');
    await expect(createCommerceCopyStore(client(null, { message: 'boom' })).updatedAt()).rejects.toThrow('No se pudieron leer');
  });
});
