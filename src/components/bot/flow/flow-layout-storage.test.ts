import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearFlowLayout, loadFlowLayout, saveFlowLayout } from './flow-layout-storage';

const KEY = 'movietime:bot-flow-layout:v1';
// El setup global deja localStorage como un mock vacío: aquí se usa uno que sí guarda.
function useMemoryStorage() {
  const data = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); }, clear: () => data.clear(),
  } });
}

beforeEach(() => { useMemoryStorage(); vi.restoreAllMocks(); });

describe('orden guardado del lienzo', () => {
  it('recuerda por separado el orden de los nodos compactos del estudio', () => {
    saveFlowLayout({ menu: { x: 1, y: 2 } });
    saveFlowLayout({ menu: { x: 9, y: 9 } }, 'compact');
    expect(loadFlowLayout()).toEqual({ menu: { x: 1, y: 2 } });
    expect(loadFlowLayout('compact')).toEqual({ menu: { x: 9, y: 9 } });
    clearFlowLayout(['menu'], 'compact');
    expect(loadFlowLayout('compact')).toEqual({});
    expect(loadFlowLayout()).toEqual({ menu: { x: 1, y: 2 } });
  });
  it('guarda y recupera posiciones, conservando las de otros nodos', () => {
    expect(loadFlowLayout()).toEqual({});
    saveFlowLayout({ menu: { x: 1, y: 2 } });
    saveFlowLayout({ soporte: { x: 3, y: 4 } });
    expect(loadFlowLayout()).toEqual({ menu: { x: 1, y: 2 }, soporte: { x: 3, y: 4 } });
    clearFlowLayout(['menu']);
    expect(loadFlowLayout()).toEqual({ soporte: { x: 3, y: 4 } });
  });
  it('ignora datos dañados o con coordenadas fuera de rango', () => {
    window.localStorage.setItem(KEY, '{no es json');
    expect(loadFlowLayout()).toEqual({});
    window.localStorage.setItem(KEY, JSON.stringify({ menu: { x: 'a', y: 1 } }));
    expect(loadFlowLayout()).toEqual({});
    window.localStorage.setItem(KEY, JSON.stringify({ menu: { x: 1e9, y: 1 } }));
    expect(loadFlowLayout()).toEqual({});
  });
  it('limita cuántos nodos recuerda', () => {
    saveFlowLayout(Object.fromEntries(Array.from({ length: 350 }, (_, index) => [`n${index}`, { x: index, y: 0 }])));
    const saved = loadFlowLayout();
    expect(Object.keys(saved)).toHaveLength(300);
    expect(saved.n349).toEqual({ x: 349, y: 0 });
    expect(saved.n0).toBeUndefined();
  });
  it('sigue funcionando si el almacenamiento no está disponible', () => {
    const blocked = () => { throw new Error('bloqueado'); };
    Object.defineProperty(window, 'localStorage', { configurable: true, value: { getItem: blocked, setItem: blocked, removeItem: blocked, clear: blocked } });
    expect(loadFlowLayout()).toEqual({});
    expect(() => saveFlowLayout({ menu: { x: 1, y: 2 } })).not.toThrow();
    expect(() => clearFlowLayout(['menu'])).not.toThrow();
  });
});
