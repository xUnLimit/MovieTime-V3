import { requestNetflixCode } from '../netflix-code-flow';
import { showCatalog, registerInterest } from './catalog-flow';
import type { ActionBindings, ActionHandler } from './contracts';

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

/** Missing bindings are deliberately unavailable, regardless of published JSON. */
export const ACTION_HANDLERS: ActionBindings = {
  show_catalog: showCatalog, register_interest: registerInterest, send_code: sendCode,
  netflix_login_code: netflix('login'), netflix_travel_code: netflix('travel'),
  handoff: async ctx => ({
    state: { ...ctx.state, owner: 'humano', awaiting: null },
    message: { kind: 'text', text: ctx.run.deps.definition.messages.handoff_ack }, event: 'handoff',
  }),
};
