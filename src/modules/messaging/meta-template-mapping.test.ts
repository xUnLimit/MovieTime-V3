import { describe, expect, it } from 'vitest';

import {
  isUsableMetaTemplate,
  metaStatusLabel,
  paramsFromData,
  renderMetaBody,
  resizeParamMap,
  validateParamMap,
  type MetaTemplateInfo,
} from './meta-template-mapping';
import type { MessageData } from './message-data';

const info = (overrides: Partial<MetaTemplateInfo> = {}): MetaTemplateInfo => ({
  id: '1', name: 'aviso', language: 'es', status: 'APPROVED', category: 'UTILITY', body: 'Hola {{1}}',
  header: null, footer: null, buttons: [], paramCount: 2, retired: false, syncedAt: '2026-09-28T00:00:00Z', ...overrides,
});

describe('validateParamMap', () => {
  it('accepts a map that matches the template variables', () => {
    expect(validateParamMap(['saludo_nombre', 'servicios'], info())).toBeNull();
  });

  it('rejects a length mismatch', () => {
    expect(validateParamMap(['servicios'], info())).toBe('La plantilla usa 2 datos y el mapa tiene 1.');
  });

  it('rejects empty or unknown keys', () => {
    expect(validateParamMap(['servicios', ''], info())).toBe('Elige un dato para {{2}}.');
    expect(validateParamMap(['contrasena', 'servicios'], info())).toBe('Elige un dato para {{1}}.');
  });

  it('allows a tipo without a Meta template', () => {
    expect(validateParamMap([], null)).toBeNull();
  });
});

describe('meta template helpers', () => {
  it('resizes the map keeping earlier choices', () => {
    expect(resizeParamMap(['servicios'], 3)).toEqual(['servicios', '', '']);
    expect(resizeParamMap(['a', 'b', 'c'], 1)).toEqual(['a']);
  });

  it('labels statuses and filters usable templates', () => {
    expect(metaStatusLabel('APPROVED')).toBe('APROBADA');
    expect(metaStatusLabel('PENDING')).toBe('EN REVISIÓN');
    expect(metaStatusLabel('REJECTED')).toBe('RECHAZADA');
    expect(metaStatusLabel('PAUSED')).toBe('PAUSED');
    expect(isUsableMetaTemplate(info())).toBe(true);
    expect(isUsableMetaTemplate(info({ status: 'PENDING' }))).toBe(false);
    expect(isUsableMetaTemplate(info({ retired: true }))).toBe(false);
  });

  it('renders the body keeping unfilled variables visible', () => {
    expect(renderMetaBody('A {{1}} B {{2}}', ['x', ' '])).toBe('A x B {{2}}');
  });

  it('builds tolerant params from data', () => {
    const data = { saludo_nombre: 'Hola, Ana', servicios: 'Netflix\ny HBO', perfil: '' } as unknown as MessageData;
    expect(paramsFromData(['saludo_nombre', 'servicios', 'perfil', 'nada'], data)).toEqual(['Hola, Ana', 'Netflix y HBO', '', '']);
  });
});
