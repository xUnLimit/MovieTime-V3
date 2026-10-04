import { describe, expect, it } from 'vitest';
import type { BotDefinition } from '@/types/bot';
import { NODE_LIMITS } from './catalog';
import { defaultDefinition } from './defaults';
import {
  addNode, addOption, canAddNode, canAddOption, connectOption, moveNode, optionLimit, updateOption,
} from './edit';
import { hasBlockingIssues, validateDefinition } from './validate';

const node = (def: BotDefinition, id: string) => def.nodes.find((n) => n.id === id);

describe('limites por tipo', () => {
  it('conoce el maximo de cada tipo', () => {
    expect(optionLimit('buttons')).toBe(NODE_LIMITS.buttonsMax);
    expect(optionLimit('list')).toBe(NODE_LIMITS.listRowsMax);
    expect(optionLimit('text')).toBe(0);
    expect(optionLimit('action')).toBe(0);
  });
  it('indica si caben mas opciones', () => {
    let def = defaultDefinition();
    expect(canAddOption(node(def, 'menu')!)).toBe(true);
    def = addOption(def, 'menu');
    expect(canAddOption(node(def, 'menu')!)).toBe(false);
    expect(canAddOption(node(def, 'login')!)).toBe(false);
  });
  it('indica si caben mas nodos', () => {
    let def = defaultDefinition();
    expect(canAddNode(def)).toBe(true);
    while (def.nodes.length < NODE_LIMITS.nodesMax) def = addNode(def, 'text', `Texto ${def.nodes.length}`);
    expect(canAddNode(def)).toBe(false);
  });
});

describe('updateOption / connectOption', () => {
  it('renombra una opcion sin mutar el original', () => {
    const def = defaultDefinition();
    const next = updateOption(def, 'menu', 'codigo', { title: 'Mi codigo' });
    expect(node(next, 'menu')!.options[0].title).toBe('Mi codigo');
    expect(node(def, 'menu')!.options[0].title).toBe('Código de Netflix');
  });
  it('conecta una opcion con otro nodo', () => {
    const next = connectOption(defaultDefinition(), 'menu', 'codigo', 'soporte');
    expect(node(next, 'menu')!.options[0].next).toBe('soporte');
  });
  it('ignora destinos, nodos u opciones inexistentes', () => {
    const def = defaultDefinition();
    expect(connectOption(def, 'menu', 'codigo', 'no_existe')).toBe(def);
    expect(connectOption(def, 'fantasma', 'codigo', 'soporte')).toBe(def);
    expect(updateOption(def, 'menu', 'fantasma', { title: 'x' })).toBe(def);
  });
  it('una conexion valida mantiene el flujo publicable', () => {
    const extra = addOption(defaultDefinition(), 'netflix');
    const next = connectOption(extra, 'netflix', node(extra, 'netflix')!.options[2].id, 'soporte');
    expect(hasBlockingIssues(validateDefinition(next))).toBe(false);
  });
});

describe('moveNode', () => {
  it('reordena nodos', () => {
    const next = moveNode(defaultDefinition(), 0, 2);
    expect(next.nodes.map((n) => n.id).slice(0, 3)).toEqual(['netflix', 'login', 'menu']);
  });
  it('ignora indices invalidos o iguales', () => {
    const def = defaultDefinition();
    expect(moveNode(def, 0, 0)).toBe(def);
    expect(moveNode(def, -1, 2)).toBe(def);
    expect(moveNode(def, 0, 99)).toBe(def);
    expect(moveNode(def, 0.5, 1)).toBe(def);
  });
});
