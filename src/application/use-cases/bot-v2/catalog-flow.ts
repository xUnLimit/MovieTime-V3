import { z } from '@/platform/validation/zod';
import { renderTemplate } from '@/modules/bot-config';
import { defaultCatalogMessages } from '@/modules/bot-config/catalog-messages';
import type { CatalogItem } from '@/platform/supabase/catalog-contracts';
import type { OutboundPayload } from '@/modules/whatsapp/cloud-api-client';
import type { ActionContext, ActionResult } from './contracts';

const routeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('available'), value: z.coerce.number().int().min(0).max(10000) }),
  z.object({ kind: z.literal('soldout'), value: z.coerce.number().int().min(0).max(10000) }),
  z.object({ kind: z.literal('platform'), value: z.string().uuid() }),
  z.object({ kind: z.literal('page'), value: z.coerce.number().int().min(0).max(10000) }),
  z.object({ kind: z.literal('plan'), value: z.string().uuid() }),
  z.object({ kind: z.literal('notify'), value: z.string().uuid() }),
  z.object({ kind: z.literal('advisor'), value: z.string().uuid() }),
  z.object({ kind: z.literal('alternative'), value: z.string().uuid() }),
]);
export function catalogRoute(id: string) {
  const parts = id.split(':');
  if (parts.length !== 4 || parts[0] !== 'BOT' || parts[1] !== 'CAT') return null;
  const result = routeSchema.safeParse({ kind: parts[2], value: parts[3] });
  return result.success ? result.data : null;
}
const id = (kind: string, value: string | number) => `BOT:CAT:${kind}:${value}`;
const label = (item: CatalogItem) => `${item.categoria_nombre} · ${item.plan_nombre}`;
function pageMessage(body: string, rows: { id: string; title: string; description?: string }[], page: number,
  nextKind: string): OutboundPayload {
  const offset = page * 9;
  const shown = rows.slice(offset, offset + 9);
  if (offset + 9 < rows.length) shown.push({ id: id(nextKind, page + 1), title: 'Ver más' });
  return shown.length ? { kind: 'list', body: body.slice(0, 1024), buttonLabel: 'Ver opciones', rows: shown }
    : { kind: 'text', text: body.slice(0, 1024) };
}
function texts(ctx: ActionContext) { return ctx.run.deps.definition.catalogMessages ?? defaultCatalogMessages(); }
function vars(ctx: ActionContext, patch: Record<string, string | number | boolean | null>) {
  return { ...ctx.state, awaiting: null, variables: { ...ctx.state.variables, ...patch } };
}
export async function showCatalog(ctx: ActionContext): Promise<ActionResult> {
  const items = await ctx.run.deps.catalog.list();
  const summarize = (soldout: boolean) => items.filter(item => (item.estado === 'agotado') === soldout)
    .map(item => `${label(item)}${soldout ? '' : `: ${item.moneda} ${item.precio}`}`).join('\n').slice(0, 430) || '—';
  return {
    state: vars(ctx, { catalog_view: 'summary', catalog_category: null, catalog_plan: null }), event: 'catalog_shown',
    message: { kind: 'buttons', body: renderTemplate(texts(ctx).summary, {
      disponibles: summarize(false), agotados: summarize(true),
    }).slice(0, 1024), buttons: [
      { id: id('available', 0), title: 'Adquirir servicio' },
      // WhatsApp caps button titles at 20 characters; the full intent is in the summary.
      { id: id('soldout', 0), title: 'Me interesa agotado' },
    ] },
  };
}
export async function registerInterest(ctx: ActionContext): Promise<ActionResult | null> {
  const items = await ctx.run.deps.catalog.list();
  const item = items.find(row => row.categoria_id === ctx.params.categoria_id && row.estado === 'agotado' &&
    (!ctx.params.plan_id || row.plan_id === ctx.params.plan_id));
  if (!item) return null;
  const name = label(item).slice(0, 150);
  const buttons = [
    { id: id('notify', item.plan_id), title: 'Avísame cuando haya' },
    { id: id('advisor', item.plan_id), title: 'Hablar con un asesor' },
  ];
  if (item.alternativa_categoria_id && items.some(row => row.categoria_id === item.alternativa_categoria_id && row.estado !== 'agotado' &&
    (!item.alternativa_plan_id || row.plan_id === item.alternativa_plan_id))) {
    buttons.push({ id: id('alternative', item.plan_id), title: 'Ver alternativa' });
  }
  return {
    state: vars(ctx, { catalog_view: 'interest', catalog_category: item.categoria_id, catalog_plan: item.plan_id,
      interes: `interesado en ${name} (agotado)` }),
    message: { kind: 'buttons', body: renderTemplate(texts(ctx).interest, { servicio: name }).slice(0, 1024), buttons },
    execute: async () => { await ctx.run.deps.catalog.registerInterest(ctx.contact.waId, item.categoria_id, item.plan_id); },
    event: 'interest_registered',
  };
}
export async function handleCatalogRoute(ctx: ActionContext, route: NonNullable<ReturnType<typeof catalogRoute>>): Promise<ActionResult | null> {
  const items = await ctx.run.deps.catalog.list();
  const v = ctx.state.variables;
  const messageTexts = texts(ctx);
  if (route.kind === 'available' || route.kind === 'soldout') {
    if (!['summary', 'platforms'].includes(String(v.catalog_view)) || (v.catalog_view === 'platforms' && v.catalog_mode !== route.kind)) return null;
    const soldout = route.kind === 'soldout';
    const categories = [...new Map(items.filter(item => (item.estado === 'agotado') === soldout)
      .map(item => [item.categoria_id, item])).values()];
    return {
      state: vars(ctx, { catalog_view: 'platforms', catalog_mode: route.kind, catalog_category: null }),
      message: pageMessage(categories.length ? messageTexts.platforms : messageTexts.empty,
        categories.map(item => ({ id: id('platform', item.categoria_id), title: item.categoria_nombre.slice(0, 24) })), route.value, route.kind),
      event: 'catalog_shown',
    };
  }
  if (route.kind === 'platform' || route.kind === 'page') {
    if (route.kind === 'platform' ? !['platforms', 'plans'].includes(String(v.catalog_view)) : v.catalog_view !== 'plans') return null;
    const category = route.kind === 'platform' ? route.value : v.catalog_category;
    const plans = items.filter(item => item.categoria_id === category && (item.estado === 'agotado') === (v.catalog_mode === 'soldout'));
    if (!plans.length) return null;
    return {
      state: vars(ctx, { catalog_view: 'plans', catalog_category: String(category) }), event: 'catalog_shown',
      message: pageMessage(messageTexts.plans, plans.map(item => ({ id: id('plan', item.plan_id),
        title: item.plan_nombre.slice(0, 24), description: `${item.moneda} ${item.precio}`.slice(0, 72) })),
      route.kind === 'page' ? route.value : 0, 'page'),
    };
  }
  const item = items.find(row => row.plan_id === route.value && row.categoria_id === v.catalog_category);
  if (!item) return null;
  if (route.kind === 'plan') {
    if (!['plans', 'interest'].includes(String(v.catalog_view)) || (item.estado === 'agotado') !== (v.catalog_mode === 'soldout')) return null;
    if (item.estado === 'agotado') return registerInterest({ ...ctx, params: { categoria_id: item.categoria_id, plan_id: item.plan_id } });
    return { state: { ...vars(ctx, { interes: `solicita ${label(item).slice(0, 150)}` }), owner: 'humano' },
      message: { kind: 'text', text: ctx.run.deps.definition.messages.handoff_ack }, event: 'handoff' };
  }
  if (v.catalog_view !== 'interest' || v.catalog_plan !== item.plan_id) return null;
  if (route.kind === 'advisor') return {
    state: { ...ctx.state, owner: 'humano', awaiting: null },
    message: { kind: 'text', text: ctx.run.deps.definition.messages.handoff_ack }, event: 'handoff',
  };
  if (route.kind === 'notify') return {
    state: ctx.state, message: { kind: 'text', text: renderTemplate(messageTexts.registered, { servicio: label(item) }).slice(0, 1024) },
    execute: async () => { await ctx.run.deps.catalog.registerInterest(ctx.contact.waId, item.categoria_id, item.plan_id); },
    event: 'interest_registered',
  };
  const alternative = items.find(row => row.categoria_id === item.alternativa_categoria_id && row.estado !== 'agotado' &&
    (!item.alternativa_plan_id || row.plan_id === item.alternativa_plan_id));
  if (!alternative) return null;
  return {
    state: vars(ctx, { catalog_view: 'plans', catalog_category: alternative.categoria_id, catalog_mode: 'available' }),
    message: pageMessage(messageTexts.plans, [{ id: id('plan', alternative.plan_id), title: alternative.plan_nombre.slice(0, 24),
      description: `${alternative.moneda} ${alternative.precio}`.slice(0, 72) }], 0, 'page'), event: 'catalog_shown',
  };
}
