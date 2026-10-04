import type { Json } from '@/platform/supabase/database.types';
import type { Pedido } from '@/modules/orders/contracts';
import type { InboundMessage } from '@/modules/whatsapp/webhook-payload';
import type { OutboundPayload } from '@/modules/whatsapp/cloud-api-client';
import type { BotDefinition } from '@/types/bot';
import { readBotAction } from '@/modules/whatsapp/bot-menu';
import { botReplyKey } from './bot-reply';
import { commerceButtons, commerceCommand, commerceStateSchema, commerceSummary, type CommerceItem } from './commerce-conversation-state';

type PublicPlan = { planId: string; planNombre: string; categoriaId: string; categoriaNombre: string; precio: number; moneda: string; cicloPago: string; perfilesLibres: number };
type OwnService = { ventaId: string; nombre: string; precio: number; moneda: string; cicloPago: string; fechaVencimiento: string };
export type CommerceConversationDeps = {
  purchasesEnabled?: () => Promise<boolean>;
  catalogue: () => Promise<PublicPlan[]>; services: (waId: string) => Promise<OwnService[]>;
  buy: (waId: string, ids: string[], key: string, expectedTotal: number) => Promise<string>;
  renew: (waId: string, ids: string[], key: string, expectedTotal: number) => Promise<string>;
  order: (waId: string, id: string) => Promise<Pedido>;
  reconcile: (waId: string, id: string, code: string, key: string) => Promise<Pedido>;
  interest: (waId: string, categoryId: string, planId: string, consent: boolean) => Promise<void>;
  cancelOrder: (waId: string, id: string, key: string) => Promise<void>;
  paymentInstructions: string | null;
};
export type CommerceConversationResult = { context: Json; payload: OutboundPayload; process: string; orderId: string | null; handoff: boolean };

function paymentText(order: Pedido): string {
  const paid = order.paymentState === 'cubierto' || order.paymentState === 'exceso';
  const refunded = ['reembolsado', 'parcialmente_reembolsado'].includes(order.paymentState);
  const delivery = order.deliveryState === 'enviado' ? 'Acceso enviado.' : order.deliveryState === 'parcial'
    ? 'Parte de los servicios está asignada; una persona revisará los pendientes.' : order.deliveryState === 'pendiente'
      ? 'Asignación pendiente; no vuelvas a pagar.' : 'Servicios asignados; acceso pendiente de envío.';
  return `Pedido ${order.id.slice(0, 8)} · ${order.moneda} ${order.total.toFixed(2)}\n`
    + `Recibido: ${order.receivedAmount.toFixed(2)}. Faltante: ${order.missingAmount.toFixed(2)}.\n`
    + (refunded ? `Reembolso registrado. ${delivery} Una persona revisará tu caso; no vuelvas a pagar.`
      : paid ? `Pago recibido. ${delivery}` : 'Pago pendiente de confirmar por el canal de recepción.')
    + (order.excessAmount > 0 ? `\nExceso ${order.excessAmount.toFixed(2)} pendiente de resolución.` : '');
}
const pick = (id: string, name: string, amount: number, currency: string, cycle: string): CommerceItem => ({ id, name, amount, currency, cycle });

export async function handleCommerceConversation(message: InboundMessage, context: Json, deps: CommerceConversationDeps,
  definition?: BotDefinition | null, intentCommand?: string | null): Promise<CommerceConversationResult | null> {
  if (!/^507\d{8}$/.test(message.fromWaId)) return null;
  const state = commerceStateSchema.parse(context);
  const command = commerceCommand(message, definition) ?? intentCommand;
  // Access remains available while a commercial selection is in progress.
  if (!command && (readBotAction(message) || /^(?:codigo|netflix)$/i.test(message.textBody?.trim() ?? ''))) return null;
  let payload: OutboundPayload;
  let handoff = false;
  if (state.lastMessageId === message.waMessageId && state.lastReply) {
    return { context: state, payload: state.lastPayload ?? { kind: 'text', text: state.lastReply }, process: state.stage, orderId: state.orderId, handoff: state.pendingHandoff };
  }
  if (!state.orderId && (command === 'buy' || (command === 'confirm' && state.kind === 'buy'))
    && deps.purchasesEnabled && !await deps.purchasesEnabled()) {
    return { context: state, payload: { kind: 'text', text: 'Las nuevas compras están pausadas. Tus pedidos pagados siguen en atención; escribe estado, renovar o ayuda para continuar.' },
      process: state.stage, orderId: null, handoff: false };
  }
  if (!command && state.stage === 'idle') return null;
  if (command === 'help') {
    payload = { kind: 'text', text: 'Una persona revisará tu caso y continuará contigo.' }; handoff = true;
  } else if (command === 'cancel') {
    if (state.orderId) await deps.cancelOrder(message.fromWaId, state.orderId, botReplyKey(message.waMessageId));
    state.stage = 'idle'; state.items = []; state.orderId = null;
    payload = { kind: 'text', text: 'Selección cancelada. Puedes escribir catálogo, renovar o ayuda.' };
  } else if (command === 'menu') {
    payload = commerceButtons('Elige qué necesitas. También puedes escribir mis servicios o ayuda.', [
      { id: 'buy', title: 'Adquirir servicio' }, { id: 'renew', title: 'Renovar' }, { id: 'services', title: 'Mis servicios' },
    ]);
  } else if (command === 'services') {
    const services = await deps.services(message.fromWaId);
    payload = { kind: 'text', text: services.length ? services.map(s => `${s.nombre} · vence ${s.fechaVencimiento}`).join('\n').slice(0, 3500)
      + '\nEscribe renovar para elegir servicios o pulsa Solicitar código en tu mensaje de acceso.' : 'No hay servicios vinculados a este número. Escribe catálogo para adquirir o ayuda para revisar tu cuenta.' };
  } else if (command === 'buy' || command === 'renew' || command?.startsWith('page:') || command?.startsWith('add:')) {
    if (state.orderId) return { context: state, payload: { kind: 'text', text: 'Tienes un pedido abierto. Escribe estado o cancelar antes de crear otro.' }, process: state.stage, orderId: state.orderId, handoff: false };
    if (command === 'buy' || command === 'renew') { state.kind = command; state.stage = command; state.items = []; state.page = 0; }
    if (command?.startsWith('page:')) { const page = Number(command.slice(5)); if (Number.isInteger(page) && page >= 0 && page < 10000) state.page = page; }
    const plans = state.kind === 'buy' ? await deps.catalogue() : [];
    const owned = state.kind === 'renew' ? await deps.services(message.fromWaId) : [];
    const choices = state.kind === 'buy' ? plans.map(p => ({ ...pick(p.planId, p.planNombre, p.precio, p.moneda, p.cicloPago), stock: p.perfilesLibres }))
      : owned.map(s => ({ ...pick(s.ventaId, s.nombre, s.precio, s.moneda, s.cicloPago), stock: 1 }));
    let currencyNotice = '';
    if (command?.startsWith('add:')) {
      const chosen = choices.find(c => c.id === command.slice(4));
      if (chosen && state.items.length && state.items[0].currency !== chosen.currency) {
        currencyNotice = 'Las monedas diferentes requieren pedidos separados. Confirma tu selección actual antes de comprar este servicio en otro pedido.\n';
      }
      if (chosen?.stock === 0 && state.kind === 'buy') {
        state.stage = 'interest'; state.interestPlanId = chosen.id;
        payload = commerceButtons(`${chosen.name} está agotado. ¿Quieres un aviso cuando vuelva? Tu interés se registra aunque prefieras no recibir avisos.`, [
          { id: 'interest:yes', title: 'Sí, avisarme' }, { id: 'interest:no', title: 'Solo mi interés' }, { id: 'cancel', title: 'Cancelar' },
        ]);
        return { context: state, payload, process: 'interest', orderId: null, handoff: false };
      }
      if (chosen && chosen.stock > 0 && state.items.length < 10 && !state.items.some(i => i.id === chosen.id)
        && (!state.items.length || state.items[0].currency === chosen.currency)) state.items.push(pick(chosen.id, chosen.name, chosen.amount, chosen.currency, chosen.cycle));
    }
    const pageChoices = choices.slice(state.page * 8, state.page * 8 + 8);
    const rows = pageChoices.map(c => ({ id: `SHOP:add:${c.id}`, title: c.name.slice(0, 24),
      description: `${c.currency} ${c.amount.toFixed(2)} · ${c.cycle} · ${c.stock ? 'Disponible' : 'Agotado'}`.slice(0, 72) }));
    if ((state.page + 1) * 8 < choices.length) rows.push({ id: `SHOP:page:${state.page + 1}`, title: 'Más servicios', description: 'Ver siguiente página' });
    if (state.items.length) rows.push({ id: 'SHOP:summary', title: 'Revisar carrito', description: `${state.items.length} servicios seleccionados` });
    payload = rows.length ? { kind: 'list', body: currencyNotice + 'Elige un servicio. Puedes agregar hasta 10 del mismo tipo de moneda. Escribe carrito para revisar o cancelar para empezar otra vez.', buttonLabel: 'Elegir servicios', rows }
      : { kind: 'text', text: 'No hay opciones para este número. Escribe catálogo o ayuda.' };
  } else if (command?.startsWith('interest:') && state.stage === 'interest' && state.interestPlanId) {
    const plan = (await deps.catalogue()).find(p => p.planId === state.interestPlanId);
    if (!plan || !['interest:yes', 'interest:no'].includes(command)) return null;
    await deps.interest(message.fromWaId, plan.categoriaId, plan.planId, command === 'interest:yes');
    state.stage = 'idle'; state.interestPlanId = null;
    payload = { kind: 'text', text: command === 'interest:yes' ? 'Interés registrado con permiso para avisarte. Escribe catálogo para ver alternativas.' : 'Interés registrado sin permiso de avisos. Escribe catálogo para ver alternativas.' };
  } else if (command === 'summary' || command === 'confirm') {
    if (state.orderId) payload = { kind: 'text', text: paymentText(await deps.order(message.fromWaId, state.orderId)) + '\nEscribe estado, pago CÓDIGO o ayuda para continuar.' };
    else if (!state.items.length) payload = { kind: 'text', text: 'Primero elige servicios escribiendo catálogo o renovar.' };
    else if (command === 'confirm' && state.stage === 'summary' && state.items[0].currency !== 'USD') {
      payload = { kind: 'text', text: `Este servicio se cobra en ${state.items[0].currency}; Yappy usa USD. Un operador te ayuda a confirmar el pago.` };
      handoff = true;
    } else if (command === 'confirm' && state.stage === 'summary') {
      const key = botReplyKey(message.waMessageId);
      const total = state.items.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100;
      const orderId = state.kind === 'buy' ? await deps.buy(message.fromWaId, state.items.map(i => i.id), key, total) : await deps.renew(message.fromWaId, state.items.map(i => i.id), key, total);
      const order = await deps.order(message.fromWaId, orderId);
      state.orderId = orderId; state.stage = 'payment';
      payload = commerceButtons(`${paymentText(order)}\nReserva hasta ${order.expiraAt}. Revisa el importe final antes de pagar.`, [{ id: 'pay', title: 'Instrucciones pago' }, { id: 'cancel', title: 'Cancelar' }]);
    } else {
      state.stage = 'summary';
      payload = commerceButtons(`${commerceSummary(state.items)}\nConfirma para reservar. El servidor revalida disponibilidad y precio.`, [{ id: 'confirm', title: 'Confirmar selección' }, { id: 'cancel', title: 'Cancelar' }]);
    }
  } else if (state.orderId && state.stage === 'payment') {
    const text = message.messageType === 'text' ? message.textBody?.trim() ?? '' : '';
    const reference = /^pago\s+([A-Za-z0-9-]{4,64})$/i.exec(text)?.[1];
    const order = reference ? await deps.reconcile(message.fromWaId, state.orderId, reference, botReplyKey(message.waMessageId)) : await deps.order(message.fromWaId, state.orderId);
    const paid = ['cubierto', 'exceso', 'reembolsado', 'parcialmente_reembolsado'].includes(order.paymentState);
    const instructions = command === 'pay' ? deps.paymentInstructions : null;
    payload = { kind: 'text', text: paymentText(order) + (paid ? '' : instructions
      ? `\n${instructions}\nEnvía pago CÓDIGO con la referencia. Puede pagar otra persona; la referencia se verifica antes de entregar.`
      : '\nEnvía pago CÓDIGO si ya pagaste. Para recibir instrucciones de pago, escribe ayuda.') };
    if (command === 'pay' && !instructions && !paid) handoff = true;
    if (order.estado === 'revision' || order.excessAmount > 0 || order.deliveryState === 'parcial'
      || ['reembolsado', 'parcialmente_reembolsado'].includes(order.paymentState)) handoff = true;
    if (order.deliveryState === 'enviado' && !handoff) {
      state.stage = 'idle'; state.orderId = null; state.items = [];
    }
  } else payload = commerceButtons('Conservo tu selección. Usa el menú para continuar o pedir ayuda.', [
    { id: 'summary', title: 'Revisar carrito' }, { id: 'cancel', title: 'Cancelar' }, { id: 'help', title: 'Hablar con alguien' },
  ]);
  state.lastMessageId = message.waMessageId;
  state.pendingHandoff = handoff;
  state.lastPayload = payload.kind === 'text' || payload.kind === 'buttons' || payload.kind === 'list' ? payload : null;
  state.lastReply = payload.kind === 'text' ? payload.text : payload.kind === 'buttons' || payload.kind === 'list' ? payload.body : null;
  return { context: state, payload, process: state.stage, orderId: state.orderId, handoff };
}
