import { describe, expect, it, vi } from 'vitest';
import { defaultAutomationSettings } from '@/modules/automation-control/contracts';
import { readReceiptCandidateUseCase } from './receipt-candidate-use-case';

function dependencies() {
  return { settings: vi.fn().mockResolvedValue({ ...defaultAutomationSettings, aiMode: 'queries', model: 'configured' }),
    claimBudget: vi.fn().mockResolvedValue(true), download: vi.fn().mockResolvedValue({ bytes: new ArrayBuffer(8), mimeType: 'image/png' }),
    interpret: vi.fn().mockResolvedValue({ reference: 'YAP-1234', confidence: 0.95 }) };
}
describe('receipt candidates', () => {
  it('extracts only a bounded candidate after reserving budget', async () => {
    const deps = dependencies();
    expect(await readReceiptCandidateUseCase('1234', deps)).toBe('YAP-1234');
    expect(deps.claimBudget).toHaveBeenCalledWith(4096);
    expect(deps.download).toHaveBeenCalledWith('1234');
    expect(deps.interpret).toHaveBeenCalledWith({ bytes: new ArrayBuffer(8), mimeType: 'image/png' }, 'configured');
  });
  it.each(['', 'https://evil.example', '1'.repeat(33)])('rejects untrusted media identifiers before storage', async id => {
    const deps = dependencies(); expect(await readReceiptCandidateUseCase(id, deps)).toBeNull();
    expect(deps.settings).not.toHaveBeenCalled();
  });
  it.each(['off', 'suggestions'])('keeps media local unless automatic queries are enabled: %s', async aiMode => {
    const deps = dependencies(); deps.settings.mockResolvedValue({ ...defaultAutomationSettings, aiMode });
    expect(await readReceiptCandidateUseCase('1234', deps)).toBeNull(); expect(deps.download).not.toHaveBeenCalled();
  });
  it('falls back when the daily budget is exhausted', async () => {
    const deps = dependencies(); deps.claimBudget.mockResolvedValue(false);
    expect(await readReceiptCandidateUseCase('1234', deps)).toBeNull(); expect(deps.download).not.toHaveBeenCalled();
  });
  it.each([{ bytes: new ArrayBuffer(0), mimeType: 'image/png' },
    { bytes: new ArrayBuffer(1024 * 1024 + 1), mimeType: 'image/png' },
    { bytes: new ArrayBuffer(8), mimeType: 'application/pdf' }])('refuses unsupported images before the provider', async image => {
    const deps = dependencies(); deps.download.mockResolvedValue(image);
    expect(await readReceiptCandidateUseCase('1234', deps)).toBeNull(); expect(deps.interpret).not.toHaveBeenCalled();
  });
  it.each([null, { reference: null, confidence: 1 }, { reference: 'YAP-1234', confidence: 0.89 },
    { reference: '<script>', confidence: 1 }, { reference: 'YAP-1234', confidence: 1, paid: true }])('discards uncertain or unauthorized claims', async output => {
    const deps = dependencies(); deps.interpret.mockResolvedValue(output);
    expect(await readReceiptCandidateUseCase('1234', deps)).toBeNull();
  });
  it('recovers from lookup and provider errors without leaking their contents', async () => {
    const deps = dependencies(); deps.download.mockRejectedValue(new Error('private details'));
    expect(await readReceiptCandidateUseCase('1234', deps)).toBeNull();
    const other = dependencies(); other.interpret.mockRejectedValue(new Error('private details'));
    expect(await readReceiptCandidateUseCase('1234', other)).toBeNull();
  });
});
