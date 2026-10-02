import { describe, expect, it } from 'vitest';

import { buildAutomationGroups } from './automation-cards';
import type { MetaTemplateInfo } from './meta-template-mapping';
import { TEMPLATE_GROUPS } from './template-tipos';

function meta(overrides: Partial<MetaTemplateInfo> = {}): MetaTemplateInfo {
  return {
    id: 'm1', name: 'aviso', language: 'es', status: 'APPROVED', category: 'UTILITY', body: 'Hola {{1}}', header: null, footer: null,
    buttons: [{ type: 'QUICK_REPLY', text: 'Renovar' }, { type: 'QUICK_REPLY', text: 'No continuar' }, { type: 'QUICK_REPLY', text: 'Otro' }],
    paramCount: 1, retired: false, syncedAt: 't', ...overrides,
  };
}

const find = (groups: ReturnType<typeof buildAutomationGroups>, tipo: string) =>
  groups.flatMap((group) => group.cards).find((card) => card.tipo === tipo);

describe('buildAutomationGroups', () => {
  it('keeps the editor groups and shows free text when nothing is linked', () => {
    const groups = buildAutomationGroups([], [], {});
    expect(groups.map((group) => group.id)).toEqual(TEMPLATE_GROUPS.map((group) => group.id));
    expect(groups.flatMap((group) => group.cards)).toHaveLength(8);
    const card = find(groups, 'dia_pago');
    expect(card).toMatchObject({
      label: 'Aviso de vencimiento', channel: { kind: 'text' }, buttons: [], contenido: '',
      activity: { sent: 0, failed: 0, skipped: 0, lastSentAt: null },
    });
    expect(card?.triggers).toContain('Automático (a la hora diaria)');
  });

  it('shows the linked template state and the action of every button', () => {
    const groups = buildAutomationGroups(
      [{ tipo: 'dia_pago', contenido: 'Hola', metaTemplateName: 'aviso', metaButtonActions: ['RENOVAR', 'NO_CONTINUAR', 'raro'] }],
      [meta()],
      { dia_pago: { sent: 2, failed: 1, skipped: 0, lastSentAt: 'x' } },
    );
    const card = find(groups, 'dia_pago');
    expect(card?.channel).toEqual({ kind: 'template', name: 'aviso', statusLabel: 'Aprobada', level: 'success' });
    expect(card?.buttons).toEqual([
      { text: 'Renovar', actionLabel: 'Enviar datos de pago' },
      { text: 'No continuar', actionLabel: 'Marcar que no desea continuar' },
      { text: 'Otro', actionLabel: 'Nada (lo atiendes en el chat)' },
    ]);
    expect(card?.contenido).toBe('Hola');
    expect(card?.activity.sent).toBe(2);
  });

  it('maps pending, rejected, paused, retired and missing templates', () => {
    const link = (name: string) => [{ tipo: 'dia_pago' as const, contenido: '', metaTemplateName: name, metaButtonActions: undefined }];
    const channelFor = (name: string, metas: MetaTemplateInfo[]) => find(buildAutomationGroups(link(name), metas, {}), 'dia_pago')?.channel;
    expect(channelFor('aviso', [meta({ status: 'PENDING' })])).toMatchObject({ statusLabel: 'En revisión', level: 'warning' });
    expect(channelFor('aviso', [meta({ status: 'REJECTED' })])).toMatchObject({ statusLabel: 'Rechazada', level: 'danger' });
    expect(channelFor('aviso', [meta({ status: 'PAUSED' })])).toMatchObject({ level: 'warning' });
    expect(channelFor('aviso', [meta({ retired: true })])).toEqual({ kind: 'template', name: 'aviso', statusLabel: 'No encontrada en Meta', level: 'danger' });
    expect(channelFor('otra', [meta()])).toMatchObject({ level: 'danger' });
    expect(find(buildAutomationGroups(link('aviso'), [meta()], {}), 'dia_pago')?.buttons).toHaveLength(3);
    expect(find(buildAutomationGroups(link('otra'), [meta()], {}), 'dia_pago')?.buttons).toEqual([]);
  });

  it('treats a blank link as no template', () => {
    const groups = buildAutomationGroups([{ tipo: 'despedida', contenido: 'Adiós', metaTemplateName: '  ', metaButtonActions: [] }], [], {});
    expect(find(groups, 'despedida')?.channel).toEqual({ kind: 'text' });
  });
});
