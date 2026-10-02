import { z } from '@/platform/validation/zod';
import { renewalTotal, selectedByCurrency, selectionSchema, type RenewalSelection } from './selection';

export const defaultRenewalTemplate = 'Renovar todo / Elegir\n{{servicios}}\nTotal: {{total}} {{moneda}}';
export const renewalTemplateSchema = z.string().min(1).max(1000).refine(t =>
  ['{{servicios}}', '{{total}}', '{{moneda}}'].every(marker => t.includes(marker)));

export function renderRenewalSummary(input: RenewalSelection, page = 0, template = defaultRenewalTemplate) {
  const state = selectionSchema.parse(input);
  const pages = Math.max(1, Math.ceil(state.items.length / 10));
  z.number().int().min(0).max(pages - 1).parse(page);
  const rows = state.items.slice(page * 10, page * 10 + 10).map(i => {
    const mark = i.reason || state.declined.includes(i.ventaId) ? '−' : state.selected.includes(i.ventaId) ? '✓' : '□';
    return `${mark} ${i.servicio.replace(/\s+/g, ' ')} · ${i.perfil.replace(/\s+/g, ' ')} · ${i.vencimiento} · ${i.ciclo} · ${i.precio.toFixed(2)} ${i.moneda}${i.reason ? ` (${i.reason})` : ''}`;
  }).join('\n');
  const groups = [...selectedByCurrency(state)].sort(([a], [b]) => a.localeCompare(b));
  const values: Record<string, string> = {
    servicios: `${rows}\nPágina ${page + 1}/${pages}`,
    total: groups.length > 1 ? groups.map(([currency, items]) => `${renewalTotal(items).toFixed(2)} ${currency}`).join(' + ')
      : renewalTotal(groups[0]?.[1] ?? []).toFixed(2),
    moneda: groups.length > 1 ? '' : groups[0]?.[0] ?? '',
  };
  const text = renewalTemplateSchema.parse(template).replace(/{{(servicios|total|moneda)}}/g, (_, marker: string) => values[marker]);
  if (text.length > 4096) throw new Error('El resumen es demasiado largo.');
  return { text, page, pages };
}
