import { createHash } from 'node:crypto';
import { variablesSchema } from '@/platform/validation/conversation-state';
import { z } from '@/platform/validation/zod';
import { selectionSchema, type RenewalSelection, type RenewalItem } from './selection';

function snapshotFingerprint(items: RenewalItem[]): string {
  const snapshot = [...items].sort((a, b) => a.ventaId.localeCompare(b.ventaId))
    .map(i => [i.ventaId, i.periodId, i.ciclo, i.precio, i.moneda, i.reason]);
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

// Only IDs and non-sensitive control values travel through conversation_state.
// Rehydrate all display, eligibility and pricing fields from the database.
export function serializeRenewalSelection(input: RenewalSelection, nodeId: string) {
  const s = selectionSchema.parse(input);
  const refs = [...s.selected.map(id => `s${id.replaceAll('-', '').toLowerCase()}`),
    ...s.declined.map(id => `d${id.replaceAll('-', '').toLowerCase()}`)].join('');
  const variables: Record<string, string> = {
    renewal_notice: s.noticeId, renewal_expiry: s.expiresAt, renewal_confirmed: s.confirmed ? '1' : '0',
    renewal_revision: snapshotFingerprint(s.items),
  };
  for (let i = 0; i < refs.length; i += 495) variables[`renewal_refs_${i / 495}`] = refs.slice(i, i + 495);
  return { variables: variablesSchema.parse(variables),
    awaiting: { tipo: 'text' as const, ref: z.string().regex(/^[a-z][a-z0-9_]{1,31}$/).parse(nodeId), expiresAt: s.expiresAt } };
}

export function rebuildRenewalSelection(base: Omit<RenewalSelection, 'items' | 'selected' | 'declined' | 'confirmed'>,
  items: RenewalItem[], saved: unknown, now: Date): RenewalSelection {
  const variables = variablesSchema.safeParse(saved);
  const state: RenewalSelection = { ...base, items, selected: [], declined: [], confirmed: false };
  if (!variables.success || variables.data.renewal_notice !== base.noticeId
    || typeof variables.data.renewal_expiry !== 'string'
    || !(Date.parse(variables.data.renewal_expiry) > now.getTime())) return selectionSchema.parse(state);
  const refs = Array.from({ length: 7 }, (_, i) => variables.data[`renewal_refs_${i}`] ?? '').join('');
  if (refs.length > 3300 || refs.length % 33 !== 0) return selectionSchema.parse(state);
  for (let offset = 0; offset < refs.length; offset += 33) {
    if (!/^[sd][0-9a-f]{32}$/.test(refs.slice(offset, offset + 33))) return selectionSchema.parse(state);
  }
  for (let offset = 0; offset < refs.length; offset += 33) {
    const hex = refs.slice(offset + 1, offset + 33);
    const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    if (items.some(i => i.ventaId === id && !i.reason)) {
      (refs[offset] === 's' ? state.selected : state.declined).push(id);
    }
  }
  state.confirmed = variables.data.renewal_confirmed === '1' && state.selected.length > 0
    && variables.data.renewal_revision === snapshotFingerprint(items);
  return selectionSchema.parse(state);
}
