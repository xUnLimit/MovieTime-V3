import { describe, expect, it } from 'vitest';
import type { BotDefinition, BotNode } from '@/types/bot';
import {
  addNode, addOption, addPurchaseFlow, blockCopyOverrides, connectOption, defaultDefinition, hasPurchaseBlocks, moveOption,
  parseDefinition, PURCHASE_BLOCKS, removeNode, removeOption, removePurchaseFlow, setBlockCopy, updateNode, updateOption,
  validateDefinition, withPurchaseBlocks,
} from './index';

const errors = (def: BotDefinition) => validateDefinition(def).filter((issue) => issue.severity === 'error');

/** Recorrido con los cuatro bloques y un boton del menu que lleva al catalogo. */
function connected(overrides: Record<string, string> = {}): BotDefinition {
  const def = addOption(addPurchaseFlow(defaultDefinition(), overrides), 'menu');
  const added = def.nodes.find((node) => node.id === 'menu')!.options.at(-1)!;
  return updateOption(def, 'menu', added.id, { title: 'Comprar', next: 'compra_catalogo' });
}
const node = (def: BotDefinition, id: string): BotNode => def.nodes.find((candidate) => candidate.id === id)!;
const replace = (def: BotDefinition, id: string, change: (value: BotNode) => BotNode): BotDefinition =>
  ({ ...def, nodes: def.nodes.map((candidate) => (candidate.id === id ? change(candidate) : candidate)) });
const paths = (def: BotDefinition) => errors(def).map((issue) => issue.path);

describe('agregar y quitar el flujo de compras', () => {
  it('agrega los cuatro bloques con identidad fija, botones fijos y salida al menú', () => {
    const def = addPurchaseFlow(defaultDefinition());
    expect(def.nodes.filter((item) => item.block).map((item) => [item.id, item.block?.type])).toEqual([
      ['compra_catalogo', 'catalogo'], ['compra_resumen', 'resumen'], ['compra_reserva', 'reserva'], ['compra_pago', 'pago'],
    ]);
    expect(node(def, 'compra_catalogo').options).toEqual([{ id: 'resumen', title: 'Revisar carrito', next: 'compra_resumen' }]);
    expect(node(def, 'compra_resumen').options.map((option) => [option.id, option.title, option.next])).toEqual([
      ['confirm', 'Confirmar selección', 'compra_reserva'], ['cancel', 'Cancelar', 'menu']]);
    expect(node(def, 'compra_pago').options.map((option) => option.next)).toEqual(['menu']);
    expect(hasPurchaseBlocks(def)).toBe(true);
    expect(parseDefinition(def).success).toBe(true);
  });

  it('se siembra con los textos editados válidos y descarta los inválidos y los que el bot ya no usa', () => {
    const def = addPurchaseFlow(defaultDefinition(), {
      greeting: 'Buenas', btnRenew: 'Renovar ya', btnHelp: 'Una persona', btnPay: 'Pagar ya', btnBuy: 'Un botón demasiado largo', reservation: 'sin datos',
    });
    expect(node(def, 'compra_catalogo').block?.copy).toEqual({ btnHelp: 'Una persona' });
    expect(node(def, 'compra_reserva').block?.copy).toEqual({ btnPay: 'Pagar ya' });
    expect(node(def, 'compra_reserva').options[0].title).toBe('Pagar ya');
  });

  it('no se agrega dos veces, ni sobre ids ocupados, ni sin espacio', () => {
    const once = addPurchaseFlow(defaultDefinition());
    expect(addPurchaseFlow(once)).toBe(once);
    const taken = addNode(defaultDefinition(), 'text', 'compra pago');
    expect(addPurchaseFlow(taken)).toBe(taken);
    let full = defaultDefinition();
    while (full.nodes.length < 38) full = addNode(full, 'text', `relleno ${full.nodes.length}`);
    expect(addPurchaseFlow(full)).toBe(full);
    expect(addPurchaseFlow({ ...defaultDefinition(), nodes: [], entryNodeId: 'x' }).nodes).toEqual([]);
  });

  it('quitar el flujo borra los bloques y los botones que llevaban al catálogo', () => {
    const def = removePurchaseFlow(connected());
    expect(hasPurchaseBlocks(def)).toBe(false);
    expect(node(def, 'menu').options.map((option) => option.id)).toEqual(['codigo', 'soporte']);
    expect(errors(def)).toEqual([]);
    expect(removePurchaseFlow(def)).toBe(def);
    expect(removePurchaseFlow({ ...connected(), entryNodeId: 'compra_catalogo' }).nodes.some((item) => item.block)).toBe(true);
  });
});

describe('validación de los bloques de compra', () => {
  it('un flujo conectado y completo es válido sin ninguna bandera del servidor', () => {
    expect(errors(connected())).toEqual([]);
    expect(validateDefinition(connected(), { flowExtensionsEnabled: false }).some((issue) => issue.message.includes('no están activados'))).toBe(false);
  });

  it('acepta en un bloque los textos del antiguo menú de compras que traen las versiones publicadas', () => {
    const legacy = replace(connected(), 'compra_catalogo', (item) => ({ ...item, block: { type: 'catalogo', copy: { greeting: 'Buenas', btnBuy: 'Comprar' } } }));
    expect(errors(legacy)).toEqual([]);
  });

  it('un bloque sin conectar desde el recorrido no bloquea la publicación: solo guarda textos', () => {
    expect(errors(addPurchaseFlow(defaultDefinition()))).toEqual([]);
  });

  it('withPurchaseBlocks agrega los bloques una sola vez y respeta el límite de nodos', () => {
    const base = defaultDefinition();
    const withBlocks = withPurchaseBlocks(base);
    expect(hasPurchaseBlocks(withBlocks)).toBe(true);
    expect(withPurchaseBlocks(withBlocks)).toBe(withBlocks);
    const extra = Array.from({ length: 40 - base.nodes.length }, (_, index) => ({ id: `extra_${index}`, name: `Extra ${index}`, kind: 'text' as const, body: 'x', options: [] }));
    const full = { ...base, nodes: [...base.nodes, ...extra] };
    expect(hasPurchaseBlocks(withPurchaseBlocks(full))).toBe(false);
  });

  it('exige el flujo completo y sin repetidos', () => {
    const def = connected();
    const missing = { ...def, nodes: def.nodes.filter((item) => item.id !== 'compra_pago') };
    expect(errors(missing).some((issue) => issue.path === 'nodes' && issue.message.includes('Falta el bloque'))).toBe(true);
    const duplicate = { ...def, nodes: [...def.nodes, { ...node(def, 'compra_pago'), id: 'compra_pago_2' }] };
    expect(errors(duplicate).some((issue) => issue.message.includes('repetido'))).toBe(true);
  });

  it('no se llega a la reserva sin confirmar el resumen', () => {
    let shortcut = addOption(connected(), 'netflix');
    const added = node(shortcut, 'netflix').options.at(-1)!;
    shortcut = { ...shortcut, nodes: shortcut.nodes.map((item) => (item.id === 'netflix'
      ? { ...item, options: item.options.map((option) => (option.id === added.id ? { ...option, next: 'compra_reserva' } : option)) } : item)) };
    const issue = errors(shortcut).find((item) => item.path.startsWith('nodes[netflix].options'));
    expect(issue?.message).toContain('No se puede reservar sin confirmar el resumen');
  });

  it('no se llega al pago ni a la entrega sin reservar', () => {
    const direct = replace(connected(), 'compra_resumen', (item) => ({
      ...item, options: item.options.map((option) => (option.id === 'confirm' ? { ...option, next: 'compra_pago' } : option)) }));
    expect(errors(direct).map((issue) => issue.message)).toEqual(expect.arrayContaining([
      expect.stringContaining('No se puede llegar al pago ni a la entrega sin reservar'), expect.stringContaining('Esta conexión es fija')]));
    const fromMenu = replace(connected(), 'menu', (item) => ({ ...item, options: [...item.options.slice(0, 2), { id: 'pagar', title: 'Pagar', next: 'compra_pago' }] }));
    expect(errors(fromMenu).some((issue) => issue.message.includes('solo se alcanza desde la reserva'))).toBe(true);
    const summary = replace(connected(), 'menu', (item) => ({ ...item, options: [...item.options.slice(0, 2), { id: 'ver', title: 'Ver', next: 'compra_resumen' }] }));
    expect(errors(summary).some((issue) => issue.message.includes('El resumen solo se alcanza desde el catálogo'))).toBe(true);
  });

  it('cancelar vuelve al recorrido, nunca a otro bloque', () => {
    const def = connectOption(connected(), 'compra_resumen', 'cancel', 'compra_catalogo');
    expect(errors(def).some((issue) => issue.message.includes('volver al recorrido'))).toBe(true);
    expect(errors(connectOption(connected(), 'compra_resumen', 'cancel', 'soporte'))).toEqual([]);
  });

  it('la identidad, el tipo de nodo y los botones del bloque son fijos', () => {
    const renamed = replace(connected(), 'compra_pago', (item) => ({ ...item, id: 'otro_pago' }));
    expect(paths(renamed)).toContain('nodes[otro_pago].id');
    const kind = replace(connected(), 'compra_pago', (item) => ({ ...item, kind: 'list', listButtonLabel: 'Ver' }));
    expect(paths(kind)).toContain('nodes[compra_pago].kind');
    const buttons = replace(connected(), 'compra_resumen', (item) => ({ ...item, options: item.options.slice(0, 1) }));
    expect(paths(buttons)).toContain('nodes[compra_resumen].options');
    const taken = { ...connected(), nodes: [...connected().nodes.filter((item) => item.id !== 'compra_pago'), { id: 'compra_pago', name: 'Libre', kind: 'text' as const, body: 'Hola', options: [] }] };
    expect(errors(taken).some((issue) => issue.message.includes('reservado'))).toBe(true);
    expect(errors({ ...connected(), entryNodeId: 'compra_catalogo' }).some((issue) => issue.path === 'entryNodeId')).toBe(true);
  });

  it('valida cada texto del bloque con las reglas de su mensaje y rechaza claves ajenas', () => {
    const bad = replace(connected(), 'compra_reserva', (item) => ({ ...item, block: { type: 'reserva', copy: { reservation: 'Sin datos', greeting: 'Hola' } } }));
    expect(paths(bad)).toEqual(expect.arrayContaining(['nodes[compra_reserva].block.copy.reservation', 'nodes[compra_reserva].block.copy.greeting']));
    const good = replace(connected(), 'compra_reserva', (item) => ({ ...item, block: { type: 'reserva', copy: { reservation: 'Listo: {{servicio}} por {{monto}}.' } } }));
    expect(errors(good)).toEqual([]);
  });
});

describe('edición protegida de los bloques', () => {
  it('un bloque no se borra, no cambia de tipo ni de botones; solo su nombre', () => {
    const def = connected();
    expect(removeNode(def, 'compra_pago')).toBe(def);
    expect(updateNode(def, 'compra_pago', { kind: 'text', body: 'x' })).toBe(def);
    expect(node(updateNode(def, 'compra_pago', { name: 'Cobro' }), 'compra_pago')).toMatchObject({ name: 'Cobro', kind: 'buttons' });
    expect(addOption(def, 'compra_pago')).toBe(def);
    expect(removeOption(def, 'compra_resumen', 'cancel')).toBe(def);
    expect(moveOption(def, 'compra_resumen', 0, 1)).toBe(def);
  });

  it('solo se puede cambiar a dónde vuelve «cancelar»', () => {
    const def = connected();
    expect(updateOption(def, 'compra_resumen', 'cancel', { title: 'Salir' })).toBe(def);
    expect(updateOption(def, 'compra_resumen', 'confirm', { next: 'menu' })).toBe(def);
    expect(updateOption(def, 'compra_resumen', 'nada', { next: 'menu' })).toBe(def);
    const moved = updateOption(def, 'compra_resumen', 'cancel', { title: 'Salir', next: 'soporte' });
    expect(node(moved, 'compra_resumen').options.find((option) => option.id === 'cancel')).toMatchObject({ title: 'Cancelar', next: 'soporte' });
  });
});

describe('textos de los bloques', () => {
  it('guarda, restaura y sincroniza el título de los botones entre bloques', () => {
    const def = setBlockCopy(connected(), 'compra_resumen', 'btnCancel', 'Salir');
    expect(node(def, 'compra_resumen').block?.copy).toEqual({ btnCancel: 'Salir' });
    expect(node(def, 'compra_reserva').options.find((option) => option.id === 'cancel')?.title).toBe('Salir');
    expect(node(def, 'compra_pago').options[0].title).toBe('Salir');
    const restored = setBlockCopy(def, 'compra_resumen', 'btnCancel', null);
    expect(node(restored, 'compra_resumen').block?.copy).toEqual({});
    expect(node(restored, 'compra_pago').options[0].title).toBe('Cancelar');
  });

  it('rechaza claves ajenas, textos inválidos y nodos sin bloque', () => {
    const def = connected();
    expect(setBlockCopy(def, 'compra_resumen', 'greeting', 'Hola')).toBe(def);
    expect(setBlockCopy(def, 'compra_reserva', 'reservation', 'sin datos')).toBe(def);
    expect(setBlockCopy(def, 'menu', 'btnCancel', 'Salir')).toBe(def);
    expect(setBlockCopy(def, 'nada', 'btnCancel', 'Salir')).toBe(def);
  });

  it('expone solo los textos válidos de todos los bloques', () => {
    const def = setBlockCopy(setBlockCopy(connected(), 'compra_catalogo', 'greeting', 'Buenas'), 'compra_pago', 'payHint', 'Avísame.');
    expect(blockCopyOverrides(def)).toEqual({ greeting: 'Buenas', payHint: 'Avísame.' });
    const tampered = replace(def, 'compra_catalogo', (item) => ({ ...item, block: { type: 'catalogo', copy: { greeting: '<b>x</b>', btnBuy: 'Comprar' } } }));
    expect(blockCopyOverrides(tampered)).toEqual({ btnBuy: 'Comprar', payHint: 'Avísame.' });
    expect(blockCopyOverrides(defaultDefinition())).toEqual({});
  });

  it('el catálogo de bloques cubre cada texto del flujo de compras exactamente una vez', async () => {
    const { COPY_CATALOG, copyKeysOfBlock } = await import('@/modules/commerce-copy');
    const types = Object.keys(PURCHASE_BLOCKS) as (keyof typeof PURCHASE_BLOCKS)[];
    const all = types.flatMap((type) => copyKeysOfBlock(type));
    expect(all.length).toBe(Object.keys(COPY_CATALOG).length);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('esquema', () => {
  it('conserva el bloque y rechaza tipos desconocidos', () => {
    const def = connected();
    expect(parseDefinition(def)).toMatchObject({ success: true });
    const parsed = parseDefinition(def);
    expect(parsed.success && parsed.definition.nodes.find((item) => item.id === 'compra_pago')?.block?.type).toBe('pago');
    const unknown = replace(def, 'compra_pago', (item) => ({ ...item, block: { type: 'entrega' as never, copy: {} } }));
    expect(parseDefinition(unknown).success).toBe(false);
  });
});
