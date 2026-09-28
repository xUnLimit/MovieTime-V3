import { describe, expect, it } from 'vitest';

import type { SavedMessage } from '@/modules/whatsapp/saved-messages';
import type { TemplateMensaje } from '@/types';

import { buildSlashItems } from './chat-slash';

const tipo = (over: Partial<TemplateMensaje>): TemplateMensaje => ({
  id: 't', nombre: 'n', tipo: 'dia_pago', contenido: 'Hola {nombre_cliente}', placeholders: [], activo: true,
  createdAt: new Date(), updatedAt: new Date(), ...over,
});
const saved: SavedMessage = { id: 's1', title: 'Día libre', kind: 'text', body: 'b', buttonLabel: '', options: [], createdBy: 'u', createdAt: '2026-01-01', updatedAt: '2026-01-01' };

describe('buildSlashItems', () => {
  const base = { term: '', savedMessages: [saved], context: null, fallbackName: 'Ana Ruiz', now: new Date(2026, 8, 28, 10) };

  it('puts saved messages first and only active system types with content', () => {
    const items = buildSlashItems({ ...base, tipos: [tipo({ id: 'a' }), tipo({ id: 'b', activo: false }), tipo({ id: 'c', contenido: '  ' })] });
    expect(items.map((i) => i.kind)).toEqual(['saved', 'system']);
    expect(items[1]).toMatchObject({ body: 'Hola Ana' });
  });

  it('filters ignoring accents and case on both groups', () => {
    const items = buildSlashItems({ ...base, term: 'DIA', tipos: [tipo({}), tipo({ id: 'x', tipo: 'despedida' })] });
    expect(items.map((i) => i.title)).toEqual(['Día libre', 'Notificación Día de Pago']);
  });
});
