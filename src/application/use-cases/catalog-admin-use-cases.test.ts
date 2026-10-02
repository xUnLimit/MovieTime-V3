import { describe, it, expect, vi } from 'vitest';
import { createCatalogAdminUseCases } from './catalog-admin-use-cases';
import { catalogSnapshot, categoryId, planId } from '@/test/catalog-admin-fixtures';
function setup() {
  const repository = { load: vi.fn().mockResolvedValue(catalogSnapshot()), saveSettings: vi.fn(), saveConfig: vi.fn(), closeInterest: vi.fn() };
  return { repository, useCases: createCatalogAdminUseCases(repository) };
}
const config = { categoria_id: categoryId, plan_id: planId, visible_en_bot: true, orden: 0, umbral_stock_bajo: 2, alternativa_categoria_id: null, alternativa_plan_id: null };
describe('catalog admin', () => {
  it.each([undefined, 'vendedor'])('blocks all operations for %s', async role => {
    const { repository, useCases } = setup();
    await expect(useCases.load(role)).rejects.toThrow('administradores');
    await expect(useCases.saveSettings(role, {})).rejects.toThrow('administradores');
    await expect(useCases.saveConfig(role, {})).rejects.toThrow('administradores');
    await expect(useCases.closeInterest(role, categoryId, 'convertido')).rejects.toThrow('administradores');
    Object.values(repository).forEach(mock => expect(mock).not.toHaveBeenCalled());
  });
  it('loads validated data and permits closing both states', async () => {
    const { repository, useCases } = setup();
    expect(await useCases.load('admin')).toEqual(catalogSnapshot());
    for (const state of ['convertido', 'descartado'] as const) await useCases.closeInterest('admin', categoryId, state);
    expect(repository.closeInterest).toHaveBeenLastCalledWith(categoryId, 'descartado');
    await expect(useCases.closeInterest('admin', 'bad', 'convertido')).rejects.toThrow();
  });
  it('validates settings, plan associations and alternatives', async () => {
    const { repository, useCases } = setup();
    await useCases.saveSettings('admin', catalogSnapshot().settings);
    await useCases.saveConfig('admin', config);
    expect(repository.saveConfig).toHaveBeenCalledWith(config);
    await expect(useCases.saveSettings('admin', { ...catalogSnapshot().settings, reserva_ttl_minutos: 0 })).rejects.toThrow();
    await expect(useCases.saveConfig('admin', { ...config, categoria_id: planId })).rejects.toThrow('incompatible');
    await expect(useCases.saveConfig('admin', { ...config, alternativa_categoria_id: planId, alternativa_plan_id: planId })).rejects.toThrow('incompatible');
  });
  it('propagates load and mutation errors and rejects invalid responses', async () => {
    const { repository, useCases } = setup();
    repository.load.mockRejectedValueOnce(new Error('Unavailable'));
    await expect(useCases.load('admin')).rejects.toThrow('Unavailable');
    repository.load.mockResolvedValueOnce({});
    await expect(useCases.load('admin')).rejects.toThrow();
    repository.saveSettings.mockRejectedValueOnce(new Error('Write failed'));
    await expect(useCases.saveSettings('admin', catalogSnapshot().settings)).rejects.toThrow('Write failed');
  });
});
