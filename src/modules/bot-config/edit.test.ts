import { describe, expect, it } from 'vitest';
import type { BotDefinition } from '@/types/bot';
import { NODE_LIMITS, PARAM_CATALOG } from './catalog';
import { defaultDefinition } from './defaults';
import { diffDefinitions } from './diff';
import {
  addNode, addOption, moveOption, removeNode, removeOption, setKeywords, setMessage, setParam, slugify,
  uniqueId, updateNode,
} from './edit';
import { hasBlockingIssues, validateDefinition } from './validate';

const node = (def: BotDefinition, id: string) => def.nodes.find((n) => n.id === id);

describe('slugify / uniqueId', () => {
  it('genera slugs sin acentos ni simbolos', () => {
    expect(slugify('  Código de Netflix! ')).toBe('codigo_de_netflix');
    expect(slugify('***')).toBe('');
    expect(slugify('')).toBe('');
  });
  it('prefija si empieza con numero y respeta 32 caracteres', () => {
    expect(slugify('123 abc')).toBe('n_123_abc');
    expect(slugify('x'.repeat(100)).length).toBe(32);
    expect(slugify(`${'a'.repeat(31)} b`)).toBe('a'.repeat(31));
    expect(slugify(`9${'a'.repeat(40)}`).length).toBe(32);
  });
  it('devuelve la base si esta libre', () => {
    expect(uniqueId('Menu Nuevo', [])).toBe('menu_nuevo');
  });
  it('agrega sufijos incrementales', () => {
    expect(uniqueId('menu', ['menu'])).toBe('menu_2');
    expect(uniqueId('menu', ['menu', 'menu_2', 'menu_3'])).toBe('menu_4');
  });
  it('mantiene el largo maximo con sufijo', () => {
    const base = 'a'.repeat(32);
    const id = uniqueId(base, [base]);
    expect(id.length).toBe(32);
    expect(id.endsWith('_2')).toBe(true);
    expect(uniqueId(base, [base, id])).not.toBe(id);
  });
  it('usa un valor por defecto cuando la base es vacia o muy corta', () => {
    expect(uniqueId('', [])).toBe('nodo');
    expect(uniqueId('!!!', ['nodo'])).toBe('nodo_2');
    expect(uniqueId('a', [])).toBe('a_1');
  });
});

describe('addNode', () => {
  it('agrega nodos de cada tipo con ids unicos y es inmutable', () => {
    const def = defaultDefinition();
    const before = JSON.stringify(def);
    const withText = addNode(def, 'text', 'Menú principal');
    expect(JSON.stringify(def)).toBe(before);
    expect(withText.nodes.at(-1)).toMatchObject({ id: 'menu_principal', kind: 'text', options: [] });
    const again = addNode(withText, 'text', 'Menú principal');
    expect(again.nodes.at(-1)?.id).toBe('menu_principal_2');
    expect(addNode(def, 'action', 'Acción').nodes.at(-1)).toMatchObject({ kind: 'action', action: 'handoff', body: '' });
    expect(addNode(def, 'list', 'Lista').nodes.at(-1)).toMatchObject({ kind: 'list', listButtonLabel: 'Ver opciones' });
    expect(addNode(def, 'buttons', 'Botones').nodes.at(-1)?.options).toEqual([]);
  });
  it('usa un nombre por defecto si viene vacio o sin letras', () => {
    const def = defaultDefinition();
    expect(addNode(def, 'text', '  ').nodes.at(-1)?.name).toBe('Nuevo nodo de texto');
    expect(addNode(def, 'action', '***').nodes.at(-1)?.id).toBe('action');
  });
  it('no supera el maximo de nodos', () => {
    let def = defaultDefinition();
    for (let i = 0; i < 60; i += 1) def = addNode(def, 'text', `Nodo ${i}`);
    expect(def.nodes).toHaveLength(NODE_LIMITS.nodesMax);
    expect(addNode(def, 'text', 'otro')).toBe(def);
  });
});

describe('removeNode', () => {
  it('limpia opciones que apuntaban al nodo y deja entryNodeId valido', () => {
    const def = defaultDefinition();
    const next = removeNode(def, 'netflix');
    expect(node(next, 'netflix')).toBeUndefined();
    expect(node(next, 'menu')?.options.map((o) => o.id)).toEqual(['soporte']);
    expect(next.entryNodeId).toBe('menu');
    expect(def.nodes).toHaveLength(5);
  });
  it('conserva los nodos que no apuntan al borrado (misma referencia)', () => {
    const def = defaultDefinition();
    expect(removeNode(def, 'login').nodes.find((n) => n.id === 'login')).toBeUndefined();
    expect(node(removeNode(def, 'soporte'), 'netflix')).toBe(node(def, 'netflix'));
  });
  it('no borra el nodo de entrada ni uno inexistente', () => {
    const def = defaultDefinition();
    expect(removeNode(def, 'menu')).toBe(def);
    expect(removeNode(def, 'nada')).toBe(def);
  });
  it('tras borrar, la definicion no tiene destinos colgantes', () => {
    const def = removeNode(removeNode(defaultDefinition(), 'login'), 'viaje');
    expect(validateDefinition(def).filter((i) => i.message.includes('no existe'))).toEqual([]);
  });
});

describe('updateNode', () => {
  it('modifica campos y no permite cambiar el id', () => {
    const def = defaultDefinition();
    const next = updateNode(def, 'menu', { name: 'Inicio', id: 'otro' } as never);
    expect(node(next, 'menu')?.name).toBe('Inicio');
    expect(node(next, 'otro')).toBeUndefined();
    expect(updateNode(def, 'nada', { name: 'x' })).toBe(def);
  });
  it('al pasar a texto o accion limpia opciones y campos ajenos', () => {
    const def = defaultDefinition();
    const text = node(updateNode(def, 'menu', { kind: 'text' }), 'menu');
    expect(text?.options).toEqual([]);
    const action = node(updateNode(def, 'menu', { kind: 'action' }), 'menu');
    expect(action).toMatchObject({ kind: 'action', body: '', options: [], action: 'handoff' });
    const keep = node(updateNode(def, 'login', { kind: 'action' }), 'login');
    expect(keep?.action).toBe('netflix_login_code');
  });
  it('al pasar a lista agrega etiqueta; a botones recorta y quita descripciones', () => {
    const def = defaultDefinition();
    const list = node(updateNode(def, 'menu', { kind: 'list' }), 'menu');
    expect(list).toMatchObject({ kind: 'list', listButtonLabel: 'Ver opciones' });
    expect(list?.options).toHaveLength(2);
    const big = updateNode(def, 'menu', {
      kind: 'list', listButtonLabel: 'Ver',
      options: ['a', 'b', 'c', 'd'].map((id) => ({ id, title: id, description: 'd', next: 'netflix' })),
    });
    const kept = node(updateNode(big, 'menu', { kind: 'list' }), 'menu');
    expect(kept?.listButtonLabel).toBe('Ver');
    const buttons = node(updateNode(big, 'menu', { kind: 'buttons' }), 'menu');
    expect(buttons?.options).toHaveLength(3);
    expect(buttons?.options.every((o) => !('description' in o))).toBe(true);
    expect(buttons && 'listButtonLabel' in buttons).toBe(false);
  });
});

describe('opciones', () => {
  it('addOption agrega una opcion valida hasta el maximo', () => {
    let def = defaultDefinition();
    def = addOption(def, 'menu');
    const added = node(def, 'menu')?.options.at(-1);
    expect(added).toMatchObject({ id: 'opcion', title: 'Nueva opción', next: 'netflix' });
    expect(addOption(def, 'menu')).toBe(def);
    expect(addOption(def, 'login')).toBe(def);
    expect(addOption(def, 'nada')).toBe(def);
  });
  it('addOption en la entrada apunta a otro nodo; en una lista admite 10', () => {
    let def = updateNode(defaultDefinition(), 'netflix', { kind: 'list', listButtonLabel: 'Ver', options: [] });
    for (let i = 0; i < 12; i += 1) def = addOption(def, 'netflix');
    expect(node(def, 'netflix')?.options).toHaveLength(10);
    expect(new Set(node(def, 'netflix')?.options.map((o) => o.id)).size).toBe(10);
    expect(node(def, 'netflix')?.options[0].next).toBe('menu');
    const alone: BotDefinition = { ...defaultDefinition(), nodes: [{ ...defaultDefinition().nodes[0], options: [] }] };
    expect(addOption(alone, 'menu').nodes[0].options[0].next).toBe('menu');
    const noEntry = addOption({ ...defaultDefinition(), entryNodeId: 'zzz' }, 'menu');
    expect(node(noEntry, 'menu')?.options.at(-1)?.next).toBe('netflix');
  });
  it('removeOption quita por id', () => {
    const def = defaultDefinition();
    expect(node(removeOption(def, 'menu', 'codigo'), 'menu')?.options.map((o) => o.id)).toEqual(['soporte']);
    expect(node(removeOption(def, 'menu', 'nada'), 'menu')?.options).toHaveLength(2);
    expect(removeOption(def, 'nada', 'x')).toBe(def);
  });
  it('moveOption reordena y valida indices', () => {
    const def = defaultDefinition();
    expect(node(moveOption(def, 'menu', 0, 1), 'menu')?.options.map((o) => o.id)).toEqual(['soporte', 'codigo']);
    expect(node(moveOption(def, 'menu', 1, 0), 'menu')?.options.map((o) => o.id)).toEqual(['soporte', 'codigo']);
    for (const [from, to] of [[0, 0], [-1, 0], [0, 2], [2, 0], [0.5, 1], [0, Number.NaN]]) {
      expect(node(moveOption(def, 'menu', from, to), 'menu')).toBe(node(def, 'menu'));
    }
    expect(moveOption(def, 'nada', 0, 1)).toBe(def);
  });
});

describe('mensajes, parametros y palabras clave', () => {
  it('setMessage cambia solo ese mensaje', () => {
    const def = defaultDefinition();
    const next = setMessage(def, 'handoff_ack', 'Hola');
    expect(next.messages.handoff_ack).toBe('Hola');
    expect(next.messages.rate_limited).toBe(def.messages.rate_limited);
    expect(def.messages.handoff_ack).not.toBe('Hola');
  });
  it('setParam redondea, ajusta al rango e ignora no finitos', () => {
    const def = defaultDefinition();
    expect(setParam(def, 'maxTaps', 7.6).params.maxTaps).toBe(8);
    expect(setParam(def, 'maxTaps', 999).params.maxTaps).toBe(PARAM_CATALOG.maxTaps.max);
    expect(setParam(def, 'maxTaps', -5).params.maxTaps).toBe(PARAM_CATALOG.maxTaps.min);
    expect(setParam(def, 'operatorQuietMinutes', 0).params.operatorQuietMinutes).toBe(0);
    expect(setParam(def, 'maxTaps', Number.NaN)).toBe(def);
    expect(setParam(def, 'maxTaps', Infinity)).toBe(def);
  });
  it('setKeywords normaliza, quita vacias y repetidas y respeta el tope', () => {
    const def = defaultDefinition();
    expect(setKeywords(def, ['Hola', ' hola ', '', 'MENÚ']).keywords).toEqual(['hola', 'menu']);
    const many = Array.from({ length: 50 }, (_, i) => `p${i}`);
    expect(setKeywords(def, many).keywords).toHaveLength(NODE_LIMITS.keywordsMax);
  });
  it('las ediciones de la UI mantienen la definicion publicable', () => {
    let def = defaultDefinition();
    def = addNode(def, 'text', 'Horarios');
    def = updateNode(def, 'horarios', { body: 'Atendemos de 8 a 5.' });
    def = addOption(def, 'menu');
    def = updateNode(def, 'menu', {
      options: def.nodes[0].options.map((o) => (o.id === 'opcion' ? { ...o, next: 'horarios' } : o)),
    });
    expect(hasBlockingIssues(validateDefinition(def))).toBe(false);
  });
});

describe('diffDefinitions', () => {
  it('es vacio para definiciones iguales', () => {
    expect(diffDefinitions(defaultDefinition(), defaultDefinition())).toEqual([]);
  });
  it('describe cada tipo de cambio en espanol', () => {
    const a = defaultDefinition();
    let b = addNode(a, 'text', 'Horarios');
    b = removeNode(b, 'login');
    b = updateNode(b, 'menu', {
      name: 'Inicio', body: 'Otro texto', kind: 'list', listButtonLabel: 'Ver',
    });
    b = updateNode(b, 'viaje', { action: 'handoff' });
    b = { ...b, entryNodeId: 'netflix' };
    b = setMessage(b, 'handoff_ack', 'Nuevo');
    b = setParam(b, 'maxTaps', 9);
    b = setKeywords(b, ['hola', 'nueva']);
    const changes = diffDefinitions(a, b);
    for (const fragment of [
      'Nodo de entrada cambiado', 'Nodo «Horarios» agregado', 'Nodo «Código de inicio de sesión» eliminado',
      'nombre cambiado', 'tipo cambiado', 'texto modificado', 'botón de la lista modificado', 'acción cambiada',
      'Mensaje «Pase a una persona» modificado', 'de 6 a 9 pulsaciones', 'Palabras clave agregadas: nueva',
      'Palabras clave quitadas: buenas',
    ]) expect(changes.some((c) => c.includes(fragment))).toBe(true);
  });
  it('detecta cambios solo en opciones', () => {
    const a = defaultDefinition();
    const b = removeOption(a, 'menu', 'codigo');
    expect(diffDefinitions(a, b)).toEqual(['Nodo «Menú principal»: opciones modificadas']);
  });
});
