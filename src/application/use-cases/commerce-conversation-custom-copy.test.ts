import { describe, expect, it, vi } from 'vitest';
import { COPY_CATALOG, COPY_KEYS } from '@/modules/commerce-copy/catalog';
import { copyProblem, createCopy } from '@/modules/commerce-copy/render';
import { commerceSummary, reservationText, servicesListText } from './commerce-conversation-copy';
import { renderChoiceList, type CommerceChoice } from './commerce-conversation-lists';
import { commerceStateSchema, type CommerceItem } from './commerce-conversation-state';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const choice = (n: number, over: Partial<CommerceChoice> = {}): CommerceChoice => ({
  id: id(n), name: `Netflix Plan ${n}`, amount: 4 * n, currency: 'USD', cycle: 'Mensual', stock: 2, categoryId: id(900), categoryName: 'Netflix', planName: `Plan ${n}`, ...over,
});
const item = (n: number, name = `Servicio ${n}`): CommerceItem => ({ id: id(n), name, amount: 5, currency: 'USD', cycle: 'Mensual' });
const list = (payload: ReturnType<typeof renderChoiceList>) => { if (payload.kind !== 'list') throw new Error('se esperaba una lista'); return payload; };

describe('textos de compras con datos', () => {
  it('todo texto original cumple sus propias reglas', () => {
    for (const key of COPY_KEYS) expect(copyProblem(key, COPY_CATALOG[key].defaultText), key).toBeNull();
  });

  it('las descripciones de la lista de plataformas, planes y renovación salen de textos editables', () => {
    const t = createCopy({ rowPlatformPlans: '{{cantidad}} opciones desde {{precio}}', rowPlanDesc: '{{ciclo}} a {{precio}}' });
    const platforms = list(renderChoiceList(commerceStateSchema.parse({}), [choice(1), choice(2)], '', t));
    expect(platforms.rows[0].description).toBe('2 opciones desde $4.00');
    const plans = list(renderChoiceList(commerceStateSchema.parse({ categoryId: id(900) }), [choice(1)], '', t));
    expect(plans.rows[0].description).toBe('Mensual a $4.00');
    const one = list(renderChoiceList(commerceStateSchema.parse({}), [choice(1)], '', createCopy({ rowPlatformOnePlan: 'Solo un plan: {{precio}}' })));
    expect(one.rows[0].description).toBe('Solo un plan: $4.00');
    const renew = list(renderChoiceList(commerceStateSchema.parse({ kind: 'renew' }), [choice(1)], '', createCopy({ rowRenewDesc: 'Renueva por {{precio}}' })));
    expect(renew.rows[0].description).toBe('Renueva por $4.00');
  });

  it('las filas de agotados y del carrito también son editables', () => {
    const t = createCopy({ rowSoldOutPlanDesc: '{{precio}} · sin cupo', rowCartOne: 'Llevas uno', rowCartMany: 'Llevas {{cantidad}}' });
    const sold = list(renderChoiceList(commerceStateSchema.parse({ soldout: true }), [choice(1, { stock: 0 })], '', t));
    expect(sold.rows[0].description).toBe('$4.00 · sin cupo');
    const one = list(renderChoiceList(commerceStateSchema.parse({ items: [item(1)] }), [choice(1)], '', t));
    expect(one.rows.at(-1)?.description).toBe('Llevas uno');
    const many = list(renderChoiceList(commerceStateSchema.parse({ items: [item(1), item(2)] }), [choice(1)], '', t));
    expect(many.rows.at(-1)?.description).toBe('Llevas 2');
  });

  it('el resumen usa las líneas y el total editados y respeta el ciclo que ya trae el nombre', () => {
    const original = commerceSummary([item(1), item(2, 'Disney Mensual')], createCopy());
    expect(original).toBe('1. Servicio 1 (Mensual): $5.00\n2. Disney Mensual: $5.00\nTotal: $10.00');
    const custom = commerceSummary([item(1)], createCopy({ summaryLine: '{{numero}}) {{servicio}} → {{precio}}', summaryTotal: 'A pagar: {{total}}' }));
    expect(custom).toBe('1) Servicio 1 → $5.00\nA pagar: $5.00');
    expect(commerceSummary([], createCopy())).toContain('$0');
  });

  it('la lista de servicios y la reserva con varios servicios son editables', () => {
    expect(servicesListText([{ nombre: 'Netflix', fechaVencimiento: '2026-10-31' }], createCopy())).toBe('• Netflix: vence el 31 de octubre de 2026');
    expect(servicesListText([{ nombre: 'Netflix', fechaVencimiento: '2026-10-31' }], createCopy({ servicesLine: '{{servicio}} hasta {{fecha}}' }))).toBe('Netflix hasta 31 de octubre de 2026');
    const order = { id: '8faf2421-0000-4000-8000-000000000000', moneda: 'USD', total: 10, expiraAt: '2100-10-03T13:00:00Z' } as Parameters<typeof reservationText>[0];
    expect(reservationText(order, [item(1), item(2)], createCopy({ severalServices: '{{cantidad}} cuentas' }))).toContain('2 cuentas');
  });

  it('un texto editado sin el dato obligatorio vuelve al original', () => {
    const t = createCopy({ summaryTotal: 'Sin total', servicesLine: 'Sin datos' });
    expect(t('summaryTotal', { total: 'USD 1.00' })).toBe('Total: USD 1.00');
    expect(t('servicesLine', { servicio: 'A', fecha: 'B' })).toBe('• A: vence el B');
  });
});

const store = vi.hoisted(() => ({ overrides: vi.fn(), load: vi.fn() }));
vi.mock('@/modules/commerce-copy/store', () => ({ createCommerceCopyStore: () => ({ overrides: store.overrides }) }));
vi.mock('@/modules/messaging/bot-config-store', () => ({ createBotConfigStore: () => ({ load: store.load }) }));
vi.mock('@/platform/observability/logger', () => ({ createLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }) }));

describe('aviso de que volvió el cupo', () => {
  it('usa el texto del recorrido publicado, luego el guardado y, si no se puede leer nada, el original', async () => {
    const { interestAvailableText } = await import('./interest-copy');
    const { addPurchaseFlow, defaultDefinition, setBlockCopy } = await import('@/modules/bot-config');
    expect(COPY_CATALOG.interestAvailable.defaultText).toContain('{{servicio}}');
    store.overrides.mockResolvedValue({ interestAvailable: 'Guardado: {{servicio}} ya tiene cupo' });
    store.load.mockRejectedValue(new Error('x'));
    expect(await interestAvailableText('Netflix')).toBe('Guardado: Netflix ya tiene cupo');
    const published = setBlockCopy(addPurchaseFlow(defaultDefinition()), 'compra_catalogo', 'interestAvailable', '¡Volvió {{servicio}}!');
    store.load.mockResolvedValue({ ready: true, definition: published, version: 3 });
    expect(await interestAvailableText('Netflix')).toBe('¡Volvió Netflix!');
    store.overrides.mockRejectedValue(new Error('x'));
    store.load.mockResolvedValue({ ready: false, reason: 'disabled' });
    expect(await interestAvailableText('Netflix')).toContain('Ya tenemos disponibilidad de Netflix');
  });
});
