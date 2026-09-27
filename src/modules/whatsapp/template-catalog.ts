// Plantillas aprobadas en Meta (cuenta MovieTime PTY). El numero de parametros
// debe coincidir con los {{n}} del cuerpo registrado; Meta rechaza el envio si no.
export const WHATSAPP_TEMPLATE_LANGUAGE = 'es';

export const WHATSAPP_TEMPLATES = {
  recordatorio_vencimiento: { paramCount: 4 },
  vence_hoy: { paramCount: 3 },
  servicio_suspendido: { paramCount: 4 },
} as const;

export type WhatsAppTemplateName = keyof typeof WHATSAPP_TEMPLATES;

export const WHATSAPP_TEMPLATE_NAMES = Object.keys(WHATSAPP_TEMPLATES) as [
  WhatsAppTemplateName,
  ...WhatsAppTemplateName[],
];

export function hasValidTemplateParams(name: WhatsAppTemplateName, params: readonly string[]): boolean {
  return params.length === WHATSAPP_TEMPLATES[name].paramCount;
}
