import { describe, expect, it } from 'vitest';
import {
  MAX_CATALOG_ENTRIES, catalogMessageIssues, catalogMessageProblem, countCatalogMessages, getCatalogMessage, resolveCatalogMessage, setCatalogMessage,
} from './catalog-messages';
import { defaultDefinition } from './defaults';
import { diffDefinitions } from './diff';
import { parseDefinition } from './schema';
import { hasBlockingIssues, validateDefinition } from './validate';

describe('mensajes por servicio', () => {
  it('guarda, cambia y quita un mensaje, y limpia lo que queda vacío', () => {
    const base = defaultDefinition();
    const one = setCatalogMessage(base, 'plan', 'plan-1', 'added', 'Incluye 1 pantalla');
    expect(getCatalogMessage(one, 'plan', 'plan-1', 'added')).toBe('Incluye 1 pantalla');
    const two = setCatalogMessage(one, 'category', 'cat-1', 'chosen', 'Bienvenido a {{plataforma}}');
    expect(countCatalogMessages(two, 'cat-1', ['plan-1'])).toBe(2);
    const without = setCatalogMessage(setCatalogMessage(two, 'plan', 'plan-1', 'added', '  '), 'category', 'cat-1', 'chosen', null);
    expect(without.catalogMessages).toBeUndefined();
    expect(base.catalogMessages).toBeUndefined();
  });
  it('ignora ids o campos que no existen y respeta el tope', () => {
    const base = defaultDefinition();
    expect(setCatalogMessage(base, 'plan', 'id con espacios', 'added', 'x')).toBe(base);
    expect(setCatalogMessage(base, 'category', 'cat-1', 'added', 'x')).toBe(base);
    let full = base;
    for (let index = 0; index < MAX_CATALOG_ENTRIES; index++) full = setCatalogMessage(full, 'plan', `p${index}`, 'added', 'x');
    expect(setCatalogMessage(full, 'plan', 'otro', 'added', 'x')).toBe(full);
    expect(getCatalogMessage(setCatalogMessage(full, 'plan', 'p1', 'added', 'y'), 'plan', 'p1', 'added')).toBe('y');
  });
  it('valida largo, una sola línea y marcadores (acepta < y >) de cada campo', () => {
    expect(catalogMessageProblem('plan', 'added', '')).toMatch(/vacío/);
    expect(catalogMessageProblem('plan', 'rowDescription', 'a'.repeat(73))).toMatch(/72/);
    expect(catalogMessageProblem('plan', 'rowDescription', 'a\nb')).toMatch(/una sola línea/);
    expect(catalogMessageProblem('plan', 'added', 'Incluye ≥ 4 pantallas <3 y a > b')).toBeNull();
    expect(catalogMessageProblem('plan', 'added', 'Hola {{pedido}}')).toMatch(/pedido/);
    expect(catalogMessageProblem('category', 'added', 'x')).toMatch(/no existe/);
    expect(catalogMessageProblem('plan', 'added', 'Listo: {{servicio}} a {{precio}}\nGracias')).toBeNull();
  });
  it('resuelve el texto con sus datos o devuelve null para usar el general', () => {
    const def = setCatalogMessage(setCatalogMessage(defaultDefinition(), 'plan', 'p1', 'added', 'Agregué {{servicio}} ({{ciclo}})'), 'plan', 'p2', 'added', 'Roto {{pedido}}');
    const values = { servicio: 'Netflix Básico', ciclo: 'Mensual' };
    expect(resolveCatalogMessage(def.catalogMessages, 'plan', 'p1', 'added', values)).toBe('Agregué Netflix Básico (Mensual)');
    expect(resolveCatalogMessage(def.catalogMessages, 'plan', 'p2', 'added', values)).toBeNull();
    expect(resolveCatalogMessage(def.catalogMessages, 'plan', 'p3', 'added', values)).toBeNull();
    expect(resolveCatalogMessage(undefined, 'plan', 'p1', 'added', values)).toBeNull();
    expect(resolveCatalogMessage(setCatalogMessage(defaultDefinition(), 'plan', 'p1', 'added', '{{precio}}').catalogMessages, 'plan', 'p1', 'added', {})).toBeNull();
  });
  it('un texto inválido bloquea la publicación y el esquema conserva el campo', () => {
    const bad = setCatalogMessage(defaultDefinition(), 'plan', 'p1', 'rowDescription', 'a'.repeat(90));
    const issues = validateDefinition(bad);
    expect(hasBlockingIssues(issues)).toBe(true);
    expect(issues.some((issue) => issue.path === 'catalogMessages.plans[p1].rowDescription')).toBe(true);
    expect(catalogMessageIssues(defaultDefinition())).toEqual([]);
    const good = setCatalogMessage(defaultDefinition(), 'category', 'c1', 'chosen', 'Hola {{plataforma}}');
    const parsed = parseDefinition(JSON.parse(JSON.stringify(good)));
    expect(parsed.success && parsed.definition.catalogMessages?.categories.c1?.chosen).toBe('Hola {{plataforma}}');
    expect(parseDefinition({ ...good, catalogMessages: { categories: { c1: { chosen: 5 } }, plans: {} } }).success).toBe(false);
    expect(validateDefinition(good).filter((issue) => issue.path.startsWith('catalogMessages'))).toEqual([]);
  });
  it('el diff nombra los mensajes por servicio agregados, cambiados y quitados', () => {
    const a = setCatalogMessage(defaultDefinition(), 'plan', 'p1-largo-id', 'added', 'Uno');
    const b = setCatalogMessage(setCatalogMessage(a, 'plan', 'p1-largo-id', 'added', 'Dos'), 'category', 'c1', 'chosen', 'Hola');
    expect(diffDefinitions(a, b).join('|')).toContain('Al elegir el plan» de el plan p1-largo modificado');
    expect(diffDefinitions(a, b).join('|')).toContain('Al elegir la plataforma» de la plataforma c1 agregado');
    expect(diffDefinitions(b, defaultDefinition()).join('|')).toContain('quitado');
    expect(diffDefinitions(a, a)).toEqual([]);
  });
});
