import { requestNetflixCode } from '../netflix-code-flow';
import { showCatalog, registerInterest } from './catalog-flow';
import { createBotPaymentHandlers } from '../payment-wiring';
import { createDeliverCredentials } from './credentials-flow';
import { handlePurchaseRoute, createStartPurchase, type PurchaseRoute } from './purchase-flow';
import { createRenewalFlow } from './renew-flow';
import type { RenewRoute } from './renew-routes';
import type { ActionBindings, ActionContext, ActionHandler, ActionResult } from './contracts';

const netflix = (type: 'login' | 'travel'): ActionHandler => async ctx => {
  if (ctx.contact.estado !== 'cliente' || !ctx.contact.terceroId) return null;
  const customer = await ctx.run.deps.store.customerServices(ctx.contact.waId);
  if (!customer.known || customer.clienteId !== ctx.contact.terceroId) return null;
  return { state: ctx.state, execute: async () => {
    const result = await requestNetflixCode(ctx.run, customer.services, { type, serviceId: null });
    if (result === 'send_failed') throw new Error('Bot code delivery failed');
  } };
};
const sendCode: ActionHandler = async ctx => {
  if (ctx.contact.estado !== 'cliente' || !ctx.contact.terceroId) return null;
  const service = await ctx.run.deps.identity.codeSale(ctx.contact.waId, ctx.params.venta_id);
  if (!service) return null;
  return { state: ctx.state,
    execute: async () => {
      const run = { ...ctx.run, deps: { ...ctx.run.deps, store: { ...ctx.run.deps.store,
        menuTapsSince: ctx.run.deps.identity.requestsSince } } };
      const result = await requestNetflixCode(run, [service], { type: 'travel', serviceId: service.serviceId });
      if (result === 'send_failed') throw new Error('Bot code delivery failed');
      if (result === 'code' || result === 'link' || result === 'already_sent') return {
        ...ctx.state, awaiting: null, variables: { ...ctx.state.variables, solicitud_venta: null },
      };
    } };
};

let payments: ReturnType<typeof createBotPaymentHandlers> | undefined;
// Created on first use so a missing environment setting cannot break unrelated bot turns.
const payment = (key: 'request_payment' | 'verify_payment'): ActionHandler => ctx => (payments ??= createBotPaymentHandlers())[key](ctx);
const renewal = (ctx: ActionContext) => ctx.run.deps.renew ? createRenewalFlow(ctx.run.deps.renew, async ctx2 => (await ACTION_HANDLERS.request_payment?.(ctx2)) ?? null) : null;
export const handleRenewRoute = async (ctx: ActionContext, route: RenewRoute): Promise<ActionResult | null> =>
  (await renewal(ctx)?.handleRoute(ctx, route)) ?? null;
export const handleBuyRoute = (ctx: ActionContext, route: PurchaseRoute): Promise<ActionResult | null> =>
  handlePurchaseRoute(ctx, route, { chain: ACTION_HANDLERS.request_payment, catalog: showCatalog });

/** Missing bindings are deliberately unavailable, regardless of published JSON. */
export const ACTION_HANDLERS: ActionBindings = {
  request_payment: payment('request_payment'), verify_payment: payment('verify_payment'),
  deliver_credentials: createDeliverCredentials(), start_purchase: createStartPurchase(showCatalog),
  renew_services: async ctx => (await renewal(ctx)?.handler(ctx)) ?? null,
  show_catalog: showCatalog, register_interest: registerInterest, send_code: sendCode,
  netflix_login_code: netflix('login'), netflix_travel_code: netflix('travel'),
  handoff: async ctx => ({
    state: { ...ctx.state, owner: 'humano', awaiting: null },
    message: { kind: 'text', text: ctx.run.deps.definition.messages.handoff_ack }, event: 'handoff',
  }),
};
