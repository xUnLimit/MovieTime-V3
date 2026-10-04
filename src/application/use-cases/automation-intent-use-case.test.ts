import { beforeEach, describe, expect, it, vi } from 'vitest';
const logger = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock('@/platform/observability/logger', () => ({ createLogger: () => ({ ...logger, info: vi.fn(), error: vi.fn(), debug: vi.fn() }) }));

import { suggestAutomationIntent } from './automation-intent-use-case';
import { defaultAutomationSettings } from '@/modules/automation-control/contracts';

const candidate = { intent: 'catalogue', selection: ['Netflix'], reference: null, confidence: 0.95 };
function dependencies() {
  return { settings: vi.fn().mockResolvedValue({ ...defaultAutomationSettings, model: 'configured', aiMode: 'suggestions' }),
    claimBudget: vi.fn().mockResolvedValue(true), interpret: vi.fn().mockResolvedValue(candidate) };
}
beforeEach(() => vi.clearAllMocks());
describe('bounded intent extraction', () => {
  it('allows suggestions and reserves a conservative budget before contacting the model', async () => {
    const deps = dependencies();
    expect(await suggestAutomationIntent('quiero netflix', deps)).toEqual(candidate);
    expect(deps.claimBudget).toHaveBeenCalledWith(4096);
    expect(deps.interpret).toHaveBeenCalledWith('quiero netflix', 'configured');
  });
  it('requires queries mode before automatic use', async () => {
    const deps = dependencies();
    expect(await suggestAutomationIntent('catálogo', deps, true)).toBeNull();
    expect(deps.claimBudget).not.toHaveBeenCalled();
    deps.settings.mockResolvedValue({ ...defaultAutomationSettings, model: 'configured', aiMode: 'queries' });
    expect(await suggestAutomationIntent('catálogo', deps, true)).toEqual(candidate);
  });
  it('does not call the provider when disabled or over budget', async () => {
    const deps = dependencies();
    deps.settings.mockResolvedValue({ ...defaultAutomationSettings });
    expect(await suggestAutomationIntent('catálogo', deps)).toBeNull();
    deps.settings.mockResolvedValue({ ...defaultAutomationSettings, model: 'configured', aiMode: 'queries' });
    deps.claimBudget.mockResolvedValue(false);
    expect(await suggestAutomationIntent('catálogo', deps)).toBeNull();
    expect(deps.interpret).not.toHaveBeenCalled();
  });
  it.each(['', 'x'.repeat(2001), 'password: secret', 'contraseña=demo', 'PIN:1234', 'clave: value'])('keeps sensitive/oversized input local', async text => {
    const deps = dependencies();
    expect(await suggestAutomationIntent(text, deps)).toBeNull();
    expect(deps.settings).not.toHaveBeenCalled();
  });
  it.each([null, { ...candidate, confidence: 0.3 }, { ...candidate, intent: 'charge' }, { ...candidate, contact: 'other' }])('falls back on uncertain or invalid output', async output => {
    const deps = dependencies(); deps.interpret.mockResolvedValue(output);
    expect(await suggestAutomationIntent('texto', deps)).toBeNull();
  });
  it('recovers from provider and storage errors without exposing prompts', async () => {
    const deps = dependencies(); deps.interpret.mockRejectedValue(new Error('sensitive provider detail'));
    expect(await suggestAutomationIntent('texto', deps)).toBeNull();
    deps.settings.mockRejectedValue(new Error('database'));
    expect(await suggestAutomationIntent('texto', deps)).toBeNull();
  });
  it('registra el motivo del fallo para poder diagnosticarlo', async () => {
    const failure = Object.assign(new Error('La interpretación de IA no está disponible.'), { code: 'openai_http_404:model_not_found' });
    const deps = dependencies(); deps.interpret.mockRejectedValue(failure);
    expect(await suggestAutomationIntent('texto', deps)).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('No se pudo interpretar'), { error: failure });
  });
});
