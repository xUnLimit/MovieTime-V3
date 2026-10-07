import { expect, it } from 'vitest';
import { defaultDefinition, parseDefinition, validateDefinition, startSimulation, answerSimulation } from './index';
import type { BotDefinition } from '@/types/bot';

function definition(minutes = 1): BotDefinition {
  const def = defaultDefinition();
  return { ...def, entryNodeId: 'problem', nodes: [
    { id: 'problem', name: 'Problema', kind: 'text', body: 'Cuéntanos.', after: { mode: 'wait', hours: 12, collectMinutes: minutes }, options: [{ id: 'any', title: '', any: true, next: 'report' }] },
    { id: 'report', name: 'Reporte', kind: 'action', body: '', options: [], action: 'create_report' },
  ] };
}
it('parses reports and collection without changing old definitions', () => {
  const result = parseDefinition(definition()); expect(result.success).toBe(true);
  if (result.success) expect(result.definition.nodes.find(n => n.id === 'problem')?.after).toMatchObject({ collectMinutes: 1 });
  expect(parseDefinition(defaultDefinition()).success).toBe(true);
  const legacy = defaultDefinition();
  const { report_ack: omitted, ...messages } = legacy.messages; void omitted;
  const parsedLegacy = parseDefinition({ ...legacy, messages });
  expect(parsedLegacy.success).toBe(true);
  if (parsedLegacy.success) expect(parsedLegacy.definition.messages.report_ack).toContain('Recibimos tu reporte');
  for (const minutes of [-1, 0.5, 61]) {
    expect(parseDefinition(definition(minutes)).success).toBe(false);
    expect(validateDefinition(definition(minutes)).some(issue => issue.path.endsWith('collectMinutes'))).toBe(true);
  }
  expect(validateDefinition(definition(0)).filter(issue => issue.severity === 'error')).toEqual([]);
});
it('simulates several messages and advances once when collection time ends', () => {
  const def = definition(); def.messages.report_ack = 'Recibimos tu reporte personalizado.'; let state = startSimulation(def);
  state = answerSimulation(def, state, 'No abre.'); state = answerSimulation(def, state, 'Desde ayer.');
  expect(state.currentNodeId).toBe('problem'); expect(state.finished).toBe(false); expect(state.collectedText).toEqual(['No abre.', 'Desde ayer.']);
  state = answerSimulation(def, state, '', true);
  expect(state.currentNodeId).toBe('report'); expect(state.finished).toBe(true);
  expect(state.turns.filter(turn => turn.from === 'customer')).toHaveLength(2);
  expect(state.turns.at(-1)?.text).toBe(def.messages.report_ack);
});
