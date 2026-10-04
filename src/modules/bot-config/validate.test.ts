import { describe, expect, it } from 'vitest';
import type { BotDefinition, BotIssue, BotNode } from '@/types/bot';
import { MESSAGE_CATALOG, MESSAGE_KEYS, NODE_LIMITS, PARAM_CATALOG } from './catalog';
import { defaultDefinition } from './defaults';
import { hasBlockingIssues, validateDefinition } from './validate';

function errors(def: BotDefinition): BotIssue[] {
  return validateDefinition(def).filter((issue) => issue.severity === 'error');
}
function warnings(def: BotDefinition): BotIssue[] {
  return validateDefinition(def).filter((issue) => issue.severity === 'warning');
}
function withNode(def: BotDefinition, id: string, patch: Partial<BotNode>): BotDefinition {
  return { ...def, nodes: def.nodes.map((node) => (node.id === id ? { ...node, ...patch } : node)) };
}
function paths(issues: BotIssue[]): string[] { return issues.map((i) => i.path); }

describe('definicion por defecto', () => {
  it('es valida sin errores ni avisos', () => {
    expect(validateDefinition(defaultDefinition())).toEqual([]);
  });
  it('devuelve objetos independientes en cada llamada', () => {
    const a = defaultDefinition();
    a.nodes[0].options[0].title = 'Otro';
    a.keywords.push('x');
    expect(defaultDefinition().nodes[0].options[0].title).toBe('Código de Netflix');
    expect(defaultDefinition().keywords).not.toContain('x');
  });
  it('sus textos respetan los limites y los marcadores del catalogo', () => {
    const def = defaultDefinition();
    for (const key of MESSAGE_KEYS) expect(def.messages[key]).toBe(MESSAGE_CATALOG[key].defaultText);
  });
});

describe('hasBlockingIssues', () => {
  it('solo bloquean los errores', () => {
    expect(hasBlockingIssues([])).toBe(false);
    expect(hasBlockingIssues([{ path: 'a', message: 'm', severity: 'warning' }])).toBe(false);
    expect(hasBlockingIssues([{ path: 'a', message: 'm', severity: 'error' }])).toBe(true);
  });
});

describe('validateDefinition - nodos', () => {
  it('exige al menos un nodo y que exista la entrada', () => {
    const def = { ...defaultDefinition(), nodes: [] };
    expect(paths(errors(def))).toEqual(expect.arrayContaining(['nodes', 'entryNodeId']));
  });
  it('rechaza mas nodos que el maximo', () => {
    const base = defaultDefinition();
    const extra: BotNode[] = Array.from({ length: NODE_LIMITS.nodesMax }, (_, i) => (
      { id: `extra_${i}`, name: 'x', kind: 'text', body: 'hola', options: [] }));
    expect(paths(errors({ ...base, nodes: [...base.nodes, ...extra] }))).toContain('nodes');
  });
  it('detecta ids con formato invalido y repetidos', () => {
    const base = defaultDefinition();
    const bad = { ...base, nodes: [...base.nodes, { id: 'Mal Id', name: 'x', kind: 'text' as const, body: 'a', options: [] },
      { ...base.nodes[2] }] };
    const found = errors(bad).map((i) => i.message);
    expect(found.some((m) => m.includes('slug'))).toBe(true);
    expect(found.some((m) => m.includes('repetido'))).toBe(true);
  });
  it('valida nombre, tipo, cuerpo y marcadores en nodos', () => {
    const base = defaultDefinition();
    const def = withNode(base, 'menu', { name: ' ', body: 'Hola {{codigo}}', kind: 'weird' as unknown as 'text' });
    const found = errors(def);
    expect(paths(found)).toEqual(expect.arrayContaining(['nodes[menu].name', 'nodes[menu].body', 'nodes[menu].kind']));
    expect(errors(withNode(base, 'menu', { name: 'n'.repeat(61) })).length).toBe(1);
    expect(errors(withNode(base, 'menu', { body: '' })).some((i) => i.path === 'nodes[menu].body')).toBe(true);
  });
  it('acepta el cuerpo en el limite exacto y rechaza uno mas', () => {
    const base = defaultDefinition();
    expect(errors(withNode(base, 'menu', { body: 'a'.repeat(NODE_LIMITS.bodyMax) }))).toEqual([]);
    expect(errors(withNode(base, 'menu', { body: 'a'.repeat(NODE_LIMITS.bodyMax + 1) })).length).toBe(1);
  });
  it('limita titulos de botones (20) y exige destino existente', () => {
    const base = defaultDefinition();
    const options = [
      { id: 'a', title: 'x'.repeat(20), next: 'netflix' },
      { id: 'a', title: 'x'.repeat(21), next: 'nada' },
      { id: 'Bad', title: ' ', next: 'netflix' },
    ];
    const found = errors(withNode(base, 'menu', { options })).map((i) => i.path);
    expect(found).toEqual(expect.arrayContaining([
      'nodes[menu].options[1].id', 'nodes[menu].options[1].title', 'nodes[menu].options[1].next',
      'nodes[menu].options[2].id', 'nodes[menu].options[2].title',
    ]));
    expect(found).not.toContain('nodes[menu].options[0].title');
  });
  it('exige de 1 a 3 botones y de 1 a 10 filas', () => {
    const base = defaultDefinition();
    expect(errors(withNode(base, 'menu', { options: [] })).map((i) => i.path)).toContain('nodes[menu].options');
    const four = ['a', 'b', 'c', 'd'].map((id) => ({ id, title: id, next: 'netflix' }));
    expect(errors(withNode(base, 'menu', { options: four })).map((i) => i.path)).toContain('nodes[menu].options');
    const eleven = Array.from({ length: 11 }, (_, i) => ({ id: `o${i}`, title: `T${i}`, next: 'netflix' }));
    const list = withNode(base, 'menu', { kind: 'list', listButtonLabel: 'Ver', options: eleven });
    expect(errors(list).map((i) => i.path)).toContain('nodes[menu].options');
    expect(errors(withNode(base, 'menu', { kind: 'list', listButtonLabel: 'Ver', options: eleven.slice(0, 10) })).filter((i) => !i.message.includes('Ningún botón lleva'))).toEqual([]);
  });
  it('lista: titulo 24, descripcion 72 y etiqueta del boton', () => {
    const base = defaultDefinition();
    const okOption = { id: 'a', title: 'x'.repeat(24), description: 'd'.repeat(72), next: 'netflix' };
    const ok = withNode(base, 'menu', { kind: 'list', listButtonLabel: 'b'.repeat(20), options: [okOption] });
    expect(errors(ok).filter((i) => !i.message.includes('Ningún botón lleva'))).toEqual([]);
    const bad = withNode(base, 'menu', {
      kind: 'list', listButtonLabel: 'b'.repeat(21),
      options: [{ ...okOption, title: 'x'.repeat(25), description: 'd'.repeat(73) }],
    });
    expect(errors(bad).map((i) => i.path)).toEqual(expect.arrayContaining([
      'nodes[menu].listButtonLabel', 'nodes[menu].options[0].title', 'nodes[menu].options[0].description']));
    const empty = withNode(base, 'menu', { kind: 'list', options: [okOption] });
    expect(errors(empty).map((i) => i.path)).toContain('nodes[menu].listButtonLabel');
  });
  it('avisa si una descripcion se usa fuera de una lista', () => {
    const base = defaultDefinition();
    const def = withNode(base, 'menu', { options: [{ id: 'a', title: 'A', description: 'd', next: 'netflix' }] });
    expect(warnings(def).map((i) => i.path)).toContain('nodes[menu].options[0].description');
  });
  it('text y action no admiten opciones; action exige accion valida', () => {
    const base = defaultDefinition();
    const opt = [{ id: 'a', title: 'A', next: 'menu' }];
    expect(errors(withNode(base, 'login', { options: opt })).map((i) => i.path)).toContain('nodes[login].options');
    expect(errors(withNode(base, 'login', { action: undefined })).map((i) => i.path)).toContain('nodes[login].action');
    expect(errors(withNode(base, 'login', { action: 'otra' as unknown as 'handoff' })).length).toBe(1);
  });
  it('avisa por cuerpo en accion y accion en nodo no accion', () => {
    const base = defaultDefinition();
    expect(warnings(withNode(base, 'login', { body: 'texto' })).map((i) => i.path)).toContain('nodes[login].body');
    expect(warnings(withNode(base, 'menu', { action: 'handoff' })).map((i) => i.path)).toContain('nodes[menu].action');
  });
  it('el flujo por defecto es publicable', () => {
    expect(hasBlockingIssues(validateDefinition(defaultDefinition()))).toBe(false);
  });
  it('bloquea publicar con nodos y acciones inalcanzables', () => {
    const base = defaultDefinition();
    const orphan: BotNode = { id: 'huerfano', name: 'Huérfano', kind: 'text', body: 'hola', options: [] };
    const orphanAction: BotNode = { id: 'extra', name: 'Extra', kind: 'action', body: '', options: [], action: 'handoff' };
    expect(hasBlockingIssues(validateDefinition({ ...base, nodes: [...base.nodes, orphan] }))).toBe(true);
    const found = errors({ ...base, nodes: [...base.nodes, orphan, orphanAction] });
    expect(found.find((i) => i.path === 'nodes[huerfano]')?.message).toContain('Huérfano');
    expect(found.find((i) => i.path === 'nodes[extra]')?.message).toContain('Pasar a una persona');
  });
  it('bloquea ciclos sin salida y tolera ciclos con salida', () => {
    const base = defaultDefinition();
    const loop = withNode(base, 'netflix', { options: [{ id: 'a', title: 'A', next: 'menu' }] });
    const noExit = withNode(loop, 'menu', { options: [{ id: 'b', title: 'B', next: 'netflix' }] });
    expect(hasBlockingIssues(validateDefinition(noExit))).toBe(true);
    expect(errors(noExit).map((i) => i.path)).toEqual(expect.arrayContaining(['nodes[menu]', 'nodes[netflix]']));
    const withExit = withNode(base, 'netflix', {
      options: [{ id: 'a', title: 'A', next: 'menu' }, { id: 'b', title: 'B', next: 'login' }, { id: 'c', title: 'C', next: 'viaje' }] });
    expect(warnings(withExit)).toEqual([]);
  });
});

describe('validateDefinition - mensajes, parametros y palabras clave', () => {
  it('valida vacios, longitud y marcadores obligatorios y desconocidos', () => {
    const base = defaultDefinition();
    const messages = {
      ...base.messages, login_code_sent: 'sin codigo', travel_link_sent: ' ',
      already_sent: 'hola {{codigo}}', travel_not_found: 'perfil {{perfil}} {{ minutos }}',
      account_picker_button: 'x'.repeat(21),
    };
    const found = errors({ ...base, messages });
    const byPath = (p: string) => found.filter((i) => i.path === p).map((i) => i.message).join('|');
    expect(byPath('messages.login_code_sent')).toContain('{{codigo}}');
    expect(byPath('messages.travel_link_sent')).toContain('vacío');
    expect(byPath('messages.already_sent')).toContain('Disponibles: ninguno');
    expect(byPath('messages.travel_not_found')).toContain('{{ minutos }}');
    expect(byPath('messages.account_picker_button')).toContain('20');
  });
  it('lista los marcadores disponibles y respeta el limite exacto', () => {
    const base = defaultDefinition();
    const found = errors({ ...base, messages: { ...base.messages, rate_limited: '{{otro}}' } });
    expect(found[0].message).toContain('{{minutos}}');
    const exact = 'a'.repeat(NODE_LIMITS.bodyMax - '{{codigo}}'.length) + '{{codigo}}';
    expect(errors({ ...base, messages: { ...base.messages, login_code_sent: exact } })).toEqual([]);
    expect(errors({ ...base, messages: { ...base.messages, login_code_sent: `${exact}a` } }).length).toBe(1);
  });
  it('detecta un mensaje ausente sin lanzar', () => {
    const base = defaultDefinition();
    const broken = { ...base, messages: { ...base.messages, handoff_ack: undefined as unknown as string } };
    expect(errors(broken).map((i) => i.path)).toContain('messages.handoff_ack');
  });
  it('valida rangos enteros de parametros en los extremos', () => {
    const base = defaultDefinition();
    for (const [key, spec] of Object.entries(PARAM_CATALOG)) {
      const k = key as keyof typeof PARAM_CATALOG;
      expect(errors({ ...base, params: { ...base.params, [k]: spec.min } })).toEqual([]);
      expect(errors({ ...base, params: { ...base.params, [k]: spec.max } })).toEqual([]);
      expect(errors({ ...base, params: { ...base.params, [k]: spec.min - 1 } }).map((i) => i.path)).toEqual([`params.${k}`]);
      expect(errors({ ...base, params: { ...base.params, [k]: spec.max + 1 } }).length).toBe(1);
    }
    expect(errors({ ...base, params: { ...base.params, maxTaps: 2.5 } }).length).toBe(1);
    expect(errors({ ...base, params: { ...base.params, maxTaps: Number.NaN } }).length).toBe(1);
  });
  it('valida palabras clave: vacias, repetidas, largas, exceso y normalizacion', () => {
    const base = defaultDefinition();
    const found = validateDefinition({ ...base, keywords: ['hola', ' ', 'Hola', 'menú', 'x'.repeat(41)] });
    expect(found.filter((i) => i.severity === 'error').map((i) => i.path)).toEqual(['keywords[1]', 'keywords[2]', 'keywords[4]']);
    expect(found.filter((i) => i.severity === 'warning').map((i) => i.path)).toEqual(['keywords[2]', 'keywords[3]']);
    const dup = errors({ ...base, keywords: ['hola', 'hola'] });
    expect(dup[0].message).toContain('repetida');
    const many = Array.from({ length: NODE_LIMITS.keywordsMax + 1 }, (_, i) => `palabra${i}`);
    expect(errors({ ...base, keywords: many }).map((i) => i.path)).toEqual(['keywords']);
  });
});
