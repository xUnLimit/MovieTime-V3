import { z } from '@/platform/validation/zod';

/** Variables a template may use; anything else is rejected so a typo never reaches a customer. */
const VARIABLES = {
  cart: ['servicios', 'total', 'moneda'],
  cart_empty: [],
  cart_full: ['max'],
  sold_out: ['servicio'],
  currency_mismatch: [],
  order_ready: ['servicios', 'total', 'moneda', 'vence'],
  cancelled: [],
  unavailable: [],
  unsupported_number: [],
  credentials: ['servicio', 'correo', 'contrasena', 'perfil', 'pin'],
  credentials_code: ['servicio', 'correo', 'perfil'],
  credentials_unavailable: ['servicio'],
} as const satisfies Record<string, readonly string[]>;
type TextKey = keyof typeof VARIABLES;
const BUTTON_KEYS = ['button_checkout', 'button_more', 'button_cancel', 'button_request_code'] as const;

const text = (variables: readonly string[]) => z.string().trim().min(1).max(1024)
  .refine(value => [...value.matchAll(/\{\{([^{}]+)\}\}/g)].every(match => variables.includes(match[1])));
// WhatsApp caps reply button titles at 20 characters.
const button = z.string().trim().min(1).max(20);
const shape: Record<string, z.ZodType<string>> = {};
for (const key of Object.keys(VARIABLES) as TextKey[]) shape[key] = text(VARIABLES[key]);
for (const key of BUTTON_KEYS) shape[key] = button;
export type PurchaseMessages = Record<TextKey | (typeof BUTTON_KEYS)[number], string>;

export function defaultPurchaseMessages(): PurchaseMessages {
  return {
    cart: '*Tu carrito*\n{{servicios}}\n\nTotal: {{total}} {{moneda}}',
    cart_empty: 'Tu carrito está vacío. Elige un servicio del catálogo.',
    cart_full: 'Tu carrito admite hasta {{max}} servicios.',
    sold_out: '{{servicio}} se agotó mientras elegías. Quitamos ese servicio de tu carrito.',
    currency_mismatch: 'Por ahora solo puedes combinar servicios que se cobran en la misma moneda.',
    order_ready: '*Pedido listo*\n{{servicios}}\n\nTotal: {{total}} {{moneda}}\nReservado hasta las {{vence}}.',
    cancelled: 'Cancelamos tu pedido y liberamos los servicios reservados.',
    unavailable: 'No pudimos procesar tu compra en este momento. Un asesor te ayudará.',
    unsupported_number: 'No podemos procesar compras desde este número. Un asesor te ayudará.',
    credentials: '*{{servicio}}*\nCorreo: {{correo}}\nContraseña: {{contrasena}}\nPerfil: {{perfil}}\nPIN: {{pin}}',
    credentials_code: '*{{servicio}}*\nCorreo: {{correo}}\nPerfil: {{perfil}}\n\nEste servicio entra con código. Pulsa el botón cuando lo necesites.',
    credentials_unavailable: 'Tus datos de {{servicio}} no se pueden enviar por aquí. Un asesor te los enviará.',
    button_checkout: 'Confirmar pedido', button_more: 'Agregar otro', button_cancel: 'Cancelar',
    button_request_code: 'Solicitar código',
  };
}
/** Stored overrides win; an invalid override falls back to the default for that key only. */
const isKey = (key: string): key is keyof PurchaseMessages => Object.hasOwn(shape, key);
export function mergePurchaseMessages(stored: unknown): PurchaseMessages {
  const defaults = defaultPurchaseMessages();
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return defaults;
  const merged = { ...defaults };
  for (const [key, value] of Object.entries(stored)) {
    if (!isKey(key) || typeof value !== 'string' || !shape[key].safeParse(value).success) continue;
    merged[key] = value.trim();
  }
  return merged;
}
