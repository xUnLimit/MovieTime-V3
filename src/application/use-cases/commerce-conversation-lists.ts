import type { OutboundPayload } from '@/modules/whatsapp/cloud-api-client';
import type { Copy } from './commerce-conversation-copy';
import type { CommerceItem, CommerceState } from './commerce-conversation-state';

/** Opcion elegible: un plan de una plataforma (compra) o una venta propia (renovacion). */
export type CommerceChoice = CommerceItem & { stock: number; categoryId: string; categoryName: string; planName: string };

type Row = { id: string; title: string; description?: string; section?: string };
const PAGE_SIZE = 7;
const money = (choice: CommerceItem) => `${choice.currency} ${choice.amount.toFixed(2)}`;
const row = (id: string, title: string, description?: string): Row => ({ id, title: title.slice(0, 24), ...(description ? { description: description.slice(0, 72) } : {}) });
const inSection = (section: string, rows: Row[]): Row[] => rows.map(item => ({ ...item, section: section.slice(0, 24) }));

function platformRows(available: CommerceChoice[]): Row[] {
  const groups = new Map<string, CommerceChoice[]>();
  for (const choice of available) groups.set(choice.categoryId, [...(groups.get(choice.categoryId) ?? []), choice]);
  return [...groups.entries()]
    .sort(([, a], [, b]) => a[0].categoryName.localeCompare(b[0].categoryName, 'es'))
    .map(([id, plans]) => {
      const cheapest = plans.reduce((best, plan) => (plan.amount < best.amount ? plan : best));
      return row(`SHOP:cat:${id}`, plans[0].categoryName, `${plans.length} ${plans.length === 1 ? 'plan' : 'planes'} · desde ${money(cheapest)}`);
    });
}

/**
 * Lista que ve el cliente. Compra: primero las plataformas con cupo; al elegir una, solo sus planes disponibles;
 * lo agotado queda aparte para dejar interes. Renovacion: sus propios servicios.
 */
export function renderChoiceList(state: CommerceState, choices: CommerceChoice[], notice: string, t: Copy): OutboundPayload {
  let entries: Row[];
  let section: string;
  let body: string;
  let buttonLabel: string;
  const extras: Row[] = [];
  const soldOut = choices.filter(choice => choice.stock === 0);
  if (state.kind === 'renew') {
    entries = choices.map(choice => row(`SHOP:add:${choice.id}`, choice.name, `${money(choice)} · ${choice.cycle}`)); section = t('sectionServices');
    body = t('renewPrompt'); buttonLabel = t('listButtonServices');
  } else if (state.soldout) {
    entries = soldOut.map(choice => row(`SHOP:add:${choice.id}`, choice.name, `${money(choice)} · ${choice.cycle} · Agotado`));
    body = t('soldOutPrompt'); buttonLabel = t('listButtonSoldOut'); section = t('sectionSoldOut');
    extras.push(row('SHOP:platforms', t('rowBackSoldOut'), t('rowBackDesc')));
  } else if (state.categoryId) {
    const plans = choices.filter(choice => choice.stock > 0 && choice.categoryId === state.categoryId);
    entries = plans.map(choice => row(`SHOP:add:${choice.id}`, choice.planName, `${money(choice)} · ${choice.cycle}`));
    body = t('plansPrompt', { plataforma: plans[0]?.categoryName ?? 'esta plataforma' }); buttonLabel = t('listButtonPlans'); section = t('sectionPlans');
    extras.push(row('SHOP:platforms', t('rowBackPlatforms'), t('rowBackDesc')));
  } else {
    entries = platformRows(choices.filter(choice => choice.stock > 0));
    body = t(entries.length ? 'platformsPrompt' : 'noPlatforms');
    buttonLabel = t('listButtonPlatforms'); section = t('sectionPlatforms');
    if (soldOut.length) extras.push(row('SHOP:soldout', t('rowSoldOut'), t('rowSoldOutDesc')));
  }
  const more = [...(entries.length > (state.page + 1) * PAGE_SIZE ? [row(`SHOP:page:${state.page + 1}`, t('rowMore'), t('rowMoreDesc'))] : []), ...extras];
  const cart = state.items.length
    ? [row('SHOP:summary', t('btnReview'), `${state.items.length} ${state.items.length === 1 ? 'servicio seleccionado' : 'servicios seleccionados'}`)] : [];
  const rows = [
    ...inSection(section, entries.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE)),
    ...inSection(t('sectionMore'), more), ...inSection(t('sectionCart'), cart),
  ];
  if (rows.length === 0) return { kind: 'text', text: t('noOptions') };
  return { kind: 'list', body: (notice + body).slice(0, 1024), buttonLabel, rows: rows.slice(0, 10) };
}
