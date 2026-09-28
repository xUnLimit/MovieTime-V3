import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
vi.mock('@/platform/supabase/templates-repository', () => ({
  createTemplate: repo.create,
  updateTemplate: repo.update,
  getTemplates: vi.fn(),
  removeTemplate: vi.fn(),
}));

import { createTemplateUseCase, normalizeMetaLink, updateTemplateUseCase } from './templates-use-cases';

describe('template Meta link', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clears the map when no Meta template is linked', () => {
    expect(normalizeMetaLink({ metaTemplateName: '  ', metaParamMap: ['servicios'] }))
      .toEqual({ metaTemplateName: null, metaParamMap: [] });
    expect(normalizeMetaLink({ metaTemplateName: 'aviso', metaParamMap: ['servicios'] }))
      .toEqual({ metaTemplateName: 'aviso', metaParamMap: ['servicios'] });
  });

  it('leaves writes untouched when the link is not part of them', () => {
    const updates = { contenido: 'Hola' };
    expect(normalizeMetaLink(updates)).toBe(updates);
  });

  it('persists link fields on update and create', async () => {
    await updateTemplateUseCase('t1', { contenido: 'x', metaTemplateName: 'aviso', metaParamMap: ['a'] });
    expect(repo.update).toHaveBeenCalledWith('t1', { contenido: 'x', metaTemplateName: 'aviso', metaParamMap: ['a'] });

    repo.create.mockResolvedValue('new');
    await createTemplateUseCase({ nombre: 'N', tipo: 'despedida', contenido: 'Adiós', placeholders: [], activo: true, metaTemplateName: null });
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'despedida', metaTemplateName: null, metaParamMap: [] }));
  });
});
