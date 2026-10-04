import type { OutboundPayload } from '@/modules/whatsapp/cloud-api-client';
import type { CommerceItem, CommerceState } from './commerce-conversation-state';

/** Opcion elegible: un plan de una plataforma (compra) o una venta propia (renovacion). */
export type CommerceChoice = CommerceItem & { stock: number; categoryId: string; categoryName: string; planName: string };

type Row = { id: string; title: string; description?: string };
const PAGE_SIZE = 7;
const money = (choice: CommerceItem) => `${choice.currency} ${choice.amount.toFixed(2)}`;
const row = (id: string, title: string, description?: string): Row => ({ id, title: title.slice(0, 24), ...(description ? { description: description.slice(0, 72) } : {}) });

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
export function renderChoiceList(state: CommerceState, choices: CommerceChoice[], notice: string): OutboundPayload {
  const pickLine = 'Cuando termines, toca Revisar carrito.';
  let entries: Row[];
  let body: string;
  let buttonLabel: string;
  const extras: Row[] = [];
  const soldOut = choices.filter(choice => choice.stock === 0);
  if (state.kind === 'renew') {
    entries = choices.map(choice => row(`SHOP:add:${choice.id}`, choice.name, `${money(choice)} · ${choice.cycle}`));
    body = `Elige los servicios que quieres renovar. ${pickLine}`; buttonLabel = 'Elegir servicios';
  } else if (state.soldout) {
    entries = soldOut.map(choice => row(`SHOP:add:${choice.id}`, choice.name, `${money(choice)} · ${choice.cycle} · Agotado`));
    body = 'Estas opciones están agotadas. Elige una y te avisamos cuando vuelva.'; buttonLabel = 'Elegir opción';
    extras.push(row('SHOP:platforms', 'Ver plataformas', 'Volver a lo disponible'));
  } else if (state.categoryId) {
    const plans = choices.filter(choice => choice.stock > 0 && choice.categoryId === state.categoryId);
    entries = plans.map(choice => row(`SHOP:add:${choice.id}`, choice.planName, `${money(choice)} · ${choice.cycle}`));
    body = `${plans[0]?.categoryName ?? 'Plataforma'}: elige el plan que quieres.`; buttonLabel = 'Elegir plan';
    extras.push(row('SHOP:platforms', 'Otras plataformas', 'Volver a lo disponible'));
  } else {
    entries = platformRows(choices.filter(choice => choice.stock > 0));
    body = entries.length ? `Elige la plataforma que quieres. ${pickLine}` : 'Por ahora no hay plataformas disponibles. Puedes dejar tu interés y te avisamos cuando haya cupo.';
    buttonLabel = 'Elegir plataforma';
    if (soldOut.length) extras.push(row('SHOP:soldout', 'Agotados', 'Dejar mi interés'));
  }
  const rows = entries.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE);
  if ((state.page + 1) * PAGE_SIZE < entries.length) rows.push(row(`SHOP:page:${state.page + 1}`, 'Más opciones', 'Ver siguiente página'));
  rows.push(...extras);
  if (state.items.length) rows.push(row('SHOP:summary', 'Revisar carrito', `${state.items.length} ${state.items.length === 1 ? 'servicio seleccionado' : 'servicios seleccionados'}`));
  if (rows.length === 0) return { kind: 'text', text: 'No encuentro opciones para este número por ahora. Escribe ayuda para hablar con una persona.' };
  return { kind: 'list', body: (notice + body).slice(0, 1024), buttonLabel, rows: rows.slice(0, 10) };
}
