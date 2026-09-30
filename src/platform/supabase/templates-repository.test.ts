import { describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({ all: vi.fn(), create: vi.fn(), update: vi.fn() }));
vi.mock('./record-core', () => ({ getAll: core.all, create: core.create, update: core.update }));

import { createTemplate, getTemplates, updateTemplate } from './templates-repository';

describe('template repository', () => {
  it('delegates operations while stripping derived placeholders from writes', async () => {
    await getTemplates();
    await createTemplate({ nombre: 'X', placeholders: ['cliente'] });
    await updateTemplate('t1', { contenido: 'Hola', placeholders: ['servicio'] });
    expect(core.all).toHaveBeenCalledWith('templates');
    expect(core.create).toHaveBeenCalledWith('templates', { nombre: 'X' });
    expect(core.update).toHaveBeenCalledWith('templates', 't1', { contenido: 'Hola' });
  });
});
