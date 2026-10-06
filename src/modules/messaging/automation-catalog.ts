import type { EditableTipoKey } from './template-tipos';

/** Quien dispara un mensaje: la persona, el reloj, un hecho del sistema o el propio cliente. */
export type AutomationTrigger = 'manual' | 'cron' | 'evento' | 'respuesta';

export const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  manual: 'Manual (botón Notificar)',
  cron: 'Automático (a la hora diaria)',
  evento: 'Por un evento del sistema',
  respuesta: 'Cuando el cliente toca un botón',
};

export type AutomationInfo = { triggers: readonly AutomationTrigger[]; detail: string };

// Una entrada por cada tipo editable: la prueba del catalogo falla si se agrega un tipo y se olvida aqui.
export const AUTOMATION_CATALOG: Record<EditableTipoKey, AutomationInfo> = {
  dia_pago: {
    triggers: ['cron', 'manual'],
    detail: 'Sale solo el día de pago a la hora configurada, y también cuando lo envías con Notificar.',
  },
  cancelacion: {
    triggers: ['manual'],
    detail: 'Solo sale cuando eliges Cancelación al darle Notificar; cortar una venta no envía nada.',
  },
  datos_pago: {
    triggers: ['respuesta'],
    detail: 'Responde sola cuando el cliente toca un botón con la acción "Enviar datos de pago".',
  },
  datos_acceso: {
    triggers: ['respuesta'],
    detail: 'Responde cuando el cliente solicita sus datos de acceso en el bot o toca "Recibir mis datos". Tiene su propio texto, independiente de la bienvenida de suscripción.',
  },
  despedida: {
    triggers: ['respuesta'],
    detail: 'Responde sola cuando el cliente toca "No continuar" y deja la venta marcada.',
  },
  suscripcion: {
    triggers: ['evento'],
    detail: 'Se ofrece al crear una venta para darle la bienvenida al cliente.',
  },
  renovacion: {
    triggers: ['evento'],
    detail: 'Confirma la renovación al registrarla; con el envío automático encendido sale al instante por la API.',
  },
  actualizacion_credenciales: {
    triggers: ['evento'],
    detail: 'Se envía al cambiar el correo o la contraseña de la cuenta del cliente.',
  },
  transferencia_servicio: {
    triggers: ['evento'],
    detail: 'Se envía al mover al cliente a otra cuenta.',
  },
};
