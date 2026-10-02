// Extension point owned by code: publishing JSON cannot grant new capabilities.
const implemented = (key: string, label: string, description: string) => ({
  key, label, description, implemented: true, requiredParams: [] as readonly string[], allowedVariables: [] as readonly string[],
});
const declared = (key: string, requiredParams: readonly string[]) => ({
  key, label: key.replaceAll('_', ' '), description: 'Declarada; no disponible todavía.',
  implemented: false, requiredParams, allowedVariables: ['categoria_id', 'venta_id', 'pedido_id', 'interes'] as readonly string[],
});
export const ACTION_REGISTRY = {
  netflix_login_code: implemented('netflix_login_code', 'Enviar código de inicio de sesión', 'Busca el código de inicio en el buzón de solo lectura.'),
  netflix_travel_code: implemented('netflix_travel_code', 'Enviar código de viaje', 'Busca la solicitud de viaje del perfil del cliente.'),
  handoff: implemented('handoff', 'Pasar a una persona', 'Deja el chat para el equipo.'),
  show_catalog: declared('show_catalog', []),
  register_interest: declared('register_interest', ['categoria_id']),
  request_payment: declared('request_payment', ['pedido_id']),
  verify_payment: declared('verify_payment', ['pedido_id']),
  deliver_credentials: declared('deliver_credentials', ['venta_id']),
  send_code: declared('send_code', ['venta_id']),
  renew_services: declared('renew_services', ['venta_id']),
  send_template: declared('send_template', ['template_id']),
} as const;
export type RegisteredActionKey = keyof typeof ACTION_REGISTRY;
export function isActionKey(key: string): key is RegisteredActionKey {
  return Object.hasOwn(ACTION_REGISTRY, key);
}
