import { describe, expect, it } from 'vitest';
import { defaultParams } from './defaults';
import { matchesKeyword, normalizeText, renderTemplate, shouldOfferMenu, templateVariables } from './render';

describe('templateVariables', () => {
  it('lista marcadores sin repetir y en orden', () => {
    expect(templateVariables('a {{x}} b {{y}} c {{x}}')).toEqual(['x', 'y']);
  });
  it('ignora llaves incompletas, vacias o con saltos de linea', () => {
    expect(templateVariables('{{}} {x} {{a\nb}} {{ok')).toEqual([]);
  });
  it('conserva espacios internos para que la validacion los senale', () => {
    expect(templateVariables('{{ x }}')).toEqual([' x ']);
  });
  it('es lineal con entradas hostiles de 4 KB', () => {
    const hostile = '{{'.repeat(2048);
    const started = Date.now();
    expect(templateVariables(hostile)).toEqual([]);
    expect(Date.now() - started).toBeLessThan(200);
  });
});

describe('renderTemplate', () => {
  it('reemplaza marcadores conocidos y deja intactos los desconocidos', () => {
    expect(renderTemplate('Hola {{perfil}} {{otro}}', { perfil: 'Ana' })).toBe('Hola Ana {{otro}}');
  });
  it('no reinterpreta el valor insertado', () => {
    expect(renderTemplate('{{a}} {{b}}', { a: '{{b}}', b: 'B' })).toBe('{{b}} B');
  });
  it('no usa propiedades heredadas como valores', () => {
    expect(renderTemplate('{{constructor}} {{__proto__}} {{toString}}', {})).toBe('{{constructor}} {{__proto__}} {{toString}}');
  });
  it('reemplaza varias apariciones y admite valores especiales de replace', () => {
    expect(renderTemplate('{{a}}-{{a}}', { a: '$&$1' })).toBe('$&$1-$&$1');
  });
  it('no cambia texto sin marcadores', () => {
    expect(renderTemplate('sin nada', { a: 'x' })).toBe('sin nada');
  });
});

describe('normalizeText', () => {
  it('quita acentos, pasa a minusculas y colapsa espacios', () => {
    expect(normalizeText('  ÁYUDA   Menú\n\tYa ')).toBe('ayuda menu ya');
  });
  it('recorta entradas enormes', () => {
    expect(normalizeText('a'.repeat(10000)).length).toBe(4096);
  });
});

describe('matchesKeyword', () => {
  const keywords = ['hola', 'buenos dias', 'código'];
  it('devuelve false sin texto o sin coincidencia', () => {
    expect(matchesKeyword(null, keywords)).toBe(false);
    expect(matchesKeyword('quiero pagar', keywords)).toBe(false);
    expect(matchesKeyword('hola', [])).toBe(false);
  });
  it('coincide por palabra completa, sin acentos ni mayusculas', () => {
    expect(matchesKeyword('¡HOLA!, buenas', keywords)).toBe(true);
    expect(matchesKeyword('mi codigo por favor', keywords)).toBe(true);
    expect(matchesKeyword('Buenos   días', keywords)).toBe(true);
  });
  it('no coincide con subcadenas', () => {
    expect(matchesKeyword('holanda', keywords)).toBe(false);
    expect(matchesKeyword('ayer buenos', keywords)).toBe(false);
  });
  it('ignora palabras clave vacias', () => {
    expect(matchesKeyword('hola', ['', '  ', '!!'])).toBe(false);
  });
});

describe('shouldOfferMenu', () => {
  const now = new Date('2026-10-02T12:00:00Z');
  const params = defaultParams();
  const base = {
    text: 'gracias', lastActivityAt: '2026-10-02T11:00:00Z', operatorRepliedRecently: false,
    now, params, keywords: ['hola'],
  };
  it('nunca ofrece el menu si una persona atendio hace poco', () => {
    expect(shouldOfferMenu({ ...base, text: 'hola', operatorRepliedRecently: true })).toBe(false);
  });
  it('lo ofrece con una palabra clave', () => {
    expect(shouldOfferMenu({ ...base, text: 'Hola!' })).toBe(true);
  });
  it('lo ofrece si no hay actividad previa o la fecha es invalida', () => {
    expect(shouldOfferMenu({ ...base, lastActivityAt: null })).toBe(true);
    expect(shouldOfferMenu({ ...base, lastActivityAt: 'no-fecha' })).toBe(true);
  });
  it('respeta menuIdleHours en el limite exacto', () => {
    const at = (hours: number) => new Date(now.getTime() - hours * 3600000).toISOString();
    expect(shouldOfferMenu({ ...base, lastActivityAt: at(12) })).toBe(true);
    expect(shouldOfferMenu({ ...base, lastActivityAt: at(11.99) })).toBe(false);
    expect(shouldOfferMenu({ ...base, lastActivityAt: at(2), params: { ...params, menuIdleHours: 2 } })).toBe(true);
  });
});
