import { renderTemplate, templateVariables } from '@/platform/text/template';

// Textos del flujo de pago. Se guardan en pedido_pago_ajustes.mensajes_pago (editables desde el panel);
// cada clave que falte o use variables no permitidas cae al texto por defecto.
const VARIABLES = {
  instrucciones: ['monto', 'moneda', 'destino', 'expira'],
  pedido_no_disponible: [],
  pago_confirmado: [],
  pago_confirmado_sobrepago: [],
  esperando_correo: [],
  revision_monto_menor: ['faltante', 'moneda'],
  revision_fuera_de_ventana: [],
  revision_entrega_pendiente: [],
  rechazo_sin_codigo: [],
  rechazo_codigo_usado: [],
  rechazo_pedido_invalido: [],
  rechazo_intentos_excedidos: [],
  recordatorio_pedido: ['monto', 'moneda', 'expira'],
} as const satisfies Record<string, readonly string[]>;

export type PaymentMessageKey = keyof typeof VARIABLES;
export type PaymentMessages = Record<PaymentMessageKey, string>;
export const PAYMENT_MESSAGE_KEYS = Object.keys(VARIABLES) as PaymentMessageKey[];

export function defaultPaymentMessages(): PaymentMessages {
  return {
    instrucciones: 'Para pagar tu pedido envía *{{moneda}} {{monto}}* por Yappy a {{destino}} antes del {{expira}}. '
      + 'Luego mándanos el comprobante (foto o el código de confirmación).',
    pedido_no_disponible: 'Ese pedido ya no admite pago. Escríbenos y te ayudamos.',
    pago_confirmado: '¡Pago confirmado! Tu pedido ya está en proceso de entrega.',
    pago_confirmado_sobrepago: '¡Pago confirmado! Recibimos un monto mayor al del pedido; un asesor te contactará.',
    esperando_correo: 'Recibimos tu comprobante. Estamos esperando la confirmación de Yappy y te avisaremos en cuanto llegue.',
    revision_monto_menor: 'Recibimos tu pago, pero aún faltan {{moneda}} {{faltante}} para completar el pedido. '
      + 'Envía la diferencia por Yappy y mándanos el nuevo comprobante.',
    revision_fuera_de_ventana: 'Tu pago llegó fuera del tiempo permitido. Un asesor lo revisará y te escribirá.',
    revision_entrega_pendiente: 'Tu pago está confirmado. Un asesor terminará de entregar tu pedido enseguida.',
    rechazo_sin_codigo: 'No pudimos leer el código de confirmación. Escríbelo tal como aparece en tu comprobante de Yappy.',
    rechazo_codigo_usado: 'Ese comprobante ya fue usado. Si crees que es un error, escríbenos.',
    rechazo_pedido_invalido: 'No pudimos aplicar ese pago a tu pedido. Escríbenos y lo revisamos.',
    rechazo_intentos_excedidos: 'Alcanzaste el máximo de intentos. Un asesor revisará tu caso.',
    recordatorio_pedido: 'Tu pedido por {{moneda}} {{monto}} sigue pendiente y vence el {{expira}}. '
      + '¿Quieres que te ayudemos a completarlo?',
  };
}

function isValid(key: PaymentMessageKey, value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (text.length < 1 || text.length > 1024) return false;
  const allowed: readonly string[] = VARIABLES[key];
  return templateVariables(text).every((name) => allowed.includes(name));
}

/** Combina lo guardado con los textos por defecto; una clave invalida no rompe las demas. */
export function resolvePaymentMessages(raw: unknown): PaymentMessages {
  const messages = defaultPaymentMessages();
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return messages;
  const stored = raw as Record<string, unknown>;
  for (const key of PAYMENT_MESSAGE_KEYS) {
    const value = Object.hasOwn(stored, key) ? stored[key] : undefined;
    if (isValid(key, value)) messages[key] = value.trim();
  }
  return messages;
}

export function renderPaymentMessage(
  messages: PaymentMessages, key: PaymentMessageKey, values: Record<string, string> = {},
): string {
  return renderTemplate(messages[key], values).slice(0, 1024);
}
