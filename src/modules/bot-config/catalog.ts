import type { BotActionKey, BotMessageKey, BotNodeKind, BotParams } from '@/types/bot';

// Limites de WhatsApp Cloud API y topes del editor.
export const NODE_LIMITS = {
  bodyMax: 1024,
  buttonsMax: 3,
  buttonTitleMax: 20,
  listRowsMax: 10,
  listTitleMax: 24,
  listDescriptionMax: 72,
  listButtonMax: 20,
  nodesMax: 40,
  keywordsMax: 30,
  /** Largo de las palabras que identifican una respuesta escrita (varias separadas por comas). */
  answerMax: 60,
} as const;

/** Cuánto espera el bot la respuesta escrita del cliente después de un texto (horas). */
export const WAIT_HOURS = { min: 1, max: 72, default: 12 } as const;
/** Textos que siguen solos uno tras otro (en un mismo mensaje) antes de cortar la cadena. */
export const MAX_CONTINUE_HOPS = 5;

export const NODE_ID_PATTERN = /^[a-z][a-z0-9_]{1,31}$/;
export const OPTION_ID_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
export const KEYWORD_MAX_LENGTH = 40;
export const NODE_NAME_MAX_LENGTH = 60;

export const NODE_KINDS: readonly BotNodeKind[] = ['buttons', 'list', 'text', 'action'];
export const ACTION_KEYS: readonly BotActionKey[] = ['netflix_login_code', 'netflix_travel_code', 'handoff', 'purchase', 'renewal', 'my_services', 'service_access'];

export const ACTION_CATALOG: Record<BotActionKey, { label: string; description: string }> = {
  purchase: { label: 'Adquirir servicios', description: 'Abre el catálogo y el carrito con reserva y pago verificado.' },
  renewal: { label: 'Renovar servicios', description: 'Permite elegir las ventas propias antes de confirmar importe y pago.' },
  my_services: { label: 'Consultar mis servicios', description: 'Muestra solamente los servicios vinculados al número que escribe.' },
  service_access: {
    label: 'Enviar mis datos de acceso',
    description: 'El cliente recibe de nuevo los datos de su servicio (correo, contraseña, perfil…) con la plantilla «Notificación de Suscripción», solo de sus propios servicios activos.',
  },
  netflix_login_code: {
    label: 'Enviar código de inicio de sesión',
    description: 'Busca en el buzón el código que Netflix envió para iniciar sesión y se lo entrega al cliente.',
  },
  netflix_travel_code: {
    label: 'Enviar código de viaje',
    description: 'Busca la solicitud de viaje del perfil del cliente y le entrega el código o el enlace de verificación.',
  },
  handoff: {
    label: 'Pasar a una persona',
    description: 'Avisa al cliente que una persona lo atenderá y deja el chat para el equipo.',
  },
};

export const VARIABLE_CATALOG: Record<string, { label: string; example: string }> = {
  codigo: { label: 'Código', example: '482915' },
  enlace: { label: 'Enlace', example: 'https://www.netflix.com/account/travel/verify?nftoken=ejemplo' },
  perfil: { label: 'Perfil', example: 'Sofía' },
  minutos: { label: 'Minutos', example: '15' },
};

export const PARAM_CATALOG: Record<keyof BotParams, {
  label: string; description: string; unit: string; min: number; max: number; defaultValue: number;
}> = {
  menuIdleHours: {
    label: 'Horas para volver a ofrecer el menú',
    description: 'Si el cliente no escribe durante este tiempo, el bot vuelve a mostrar el menú en su próximo mensaje.',
    unit: 'horas', min: 1, max: 72, defaultValue: 12,
  },
  operatorQuietMinutes: {
    label: 'Silencio tras responder una persona',
    description: 'Tras una respuesta de una persona del equipo, el bot no interviene durante este tiempo. Con 0 no se silencia.',
    unit: 'minutos', min: 0, max: 1440, defaultValue: 60,
  },
  loginWindowMinutes: {
    label: 'Vigencia del código de inicio de sesión',
    description: 'Solo se entregan códigos de inicio de sesión recibidos dentro de esta ventana.',
    unit: 'minutos', min: 1, max: 15, defaultValue: 5,
  },
  travelWindowMinutes: {
    label: 'Vigencia de la solicitud de viaje',
    description: 'Solo se atienden solicitudes de viaje recibidas dentro de esta ventana.',
    unit: 'minutos', min: 1, max: 15, defaultValue: 15,
  },
  maxTaps: {
    label: 'Pulsaciones permitidas',
    description: 'Cantidad máxima de pulsaciones de menú por cliente dentro de la ventana de conteo.',
    unit: 'pulsaciones', min: 1, max: 30, defaultValue: 6,
  },
  tapWindowMinutes: {
    label: 'Ventana de conteo de pulsaciones',
    description: 'Tiempo durante el cual se cuentan las pulsaciones para aplicar el límite.',
    unit: 'minutos', min: 1, max: 120, defaultValue: 10,
  },
};

export type MessageCatalogEntry = {
  label: string; description: string; group: 'netflix' | 'sistema';
  variables: readonly string[]; required: readonly string[]; maxLength: number; defaultText: string;
};

const MSG_MAX = 1024;
const NONE: readonly string[] = [];

export const MESSAGE_CATALOG: Record<BotMessageKey, MessageCatalogEntry> = {
  login_code_sent: {
    label: 'Código de inicio de sesión enviado',
    description: 'Se envía cuando se encuentra el código para iniciar sesión.',
    group: 'netflix', variables: ['codigo', 'minutos'], required: ['codigo'], maxLength: MSG_MAX,
    defaultText: 'Tu código de Netflix es *{{codigo}}*. Vence en {{minutos}} minutos; úsalo ya y no lo compartas.',
  },
  travel_code_sent: {
    label: 'Código de viaje enviado',
    description: 'Se envía cuando se encuentra el código de la solicitud de viaje del perfil del cliente.',
    group: 'netflix', variables: ['codigo', 'perfil', 'minutos'], required: ['codigo'], maxLength: MSG_MAX,
    defaultText: 'Tu código de Netflix para el perfil *{{perfil}}* es *{{codigo}}*. Vence en {{minutos}} minutos; úsalo ya y no lo compartas.',
  },
  travel_link_sent: {
    label: 'Enlace de viaje enviado',
    description: 'Se envía cuando la solicitud de viaje trae un enlace de verificación en lugar de un código.',
    group: 'netflix', variables: ['enlace', 'minutos'], required: ['enlace'], maxLength: MSG_MAX,
    defaultText: 'Abre este enlace para ver tu código de acceso temporal de Netflix. Vence en {{minutos}} minutos y no lo compartas:\n{{enlace}}',
  },
  login_not_found: {
    label: 'Código de inicio de sesión no encontrado',
    description: 'Se envía cuando no hay un código de inicio de sesión reciente en el buzón.',
    group: 'netflix', variables: ['minutos'], required: NONE, maxLength: MSG_MAX,
    defaultText: 'Todavía no me llega un código de inicio de sesión de los últimos {{minutos}} minutos. Pídelo en Netflix y vuelve a tocar el botón.',
  },
  travel_not_found: {
    label: 'Solicitud de viaje no encontrada',
    description: 'Se envía cuando no hay una solicitud de viaje reciente para el perfil del cliente.',
    group: 'netflix', variables: ['perfil', 'minutos'], required: NONE, maxLength: MSG_MAX,
    defaultText: 'No veo tu solicitud de viaje para el perfil *{{perfil}}* en los últimos {{minutos}} minutos. Pídela en Netflix desde ese perfil y vuelve a tocar el botón.',
  },
  already_sent: {
    label: 'Código ya enviado',
    description: 'Se envía cuando el cliente pide un código que ya se le entregó.',
    group: 'netflix', variables: NONE, required: NONE, maxLength: MSG_MAX,
    defaultText: 'Ya te envié ese código; búscalo arriba en este chat. Si no te sirvió, pide uno nuevo en Netflix y vuelve a tocar el botón.',
  },
  profile_missing: {
    label: 'Perfil sin registrar',
    description: 'Se envía cuando el cliente no tiene un perfil de Netflix registrado, por lo que no se puede validar la solicitud.',
    group: 'netflix', variables: NONE, required: NONE, maxLength: MSG_MAX,
    defaultText: 'Todavía no tengo registrado tu perfil de Netflix, así que no puedo darte el código por aquí. Una persona te ayuda en breve.',
  },
  no_netflix_account: {
    label: 'Sin cuenta de Netflix',
    description: 'Se envía cuando el cliente no tiene una cuenta de Netflix activa.',
    group: 'netflix', variables: NONE, required: NONE, maxLength: MSG_MAX,
    defaultText: 'No encuentro una cuenta de Netflix activa a tu nombre. Una persona te ayuda en breve.',
  },
  rate_limited: {
    label: 'Demasiadas solicitudes',
    description: 'Se envía cuando el cliente supera el límite de pulsaciones permitido.',
    group: 'sistema', variables: ['minutos'], required: NONE, maxLength: MSG_MAX,
    defaultText: 'Pediste muchos códigos seguidos. Espera {{minutos}} minutos e inténtalo de nuevo.',
  },
  mailbox_unavailable: {
    label: 'Buzón no disponible',
    description: 'Se envía cuando no se puede consultar el correo de Netflix.',
    group: 'netflix', variables: NONE, required: NONE, maxLength: MSG_MAX,
    defaultText: 'No pude consultar el correo de Netflix en este momento. Una persona te ayuda en breve.',
  },
  handoff_ack: {
    label: 'Pase a una persona',
    description: 'Se envía cuando el cliente pide hablar con una persona.',
    group: 'sistema', variables: NONE, required: NONE, maxLength: MSG_MAX,
    defaultText: 'Listo, una persona te atiende en breve.',
  },
  option_unavailable: {
    label: 'Opción no disponible',
    description: 'Se envía cuando el cliente toca un botón de un menú que ya cambió.',
    group: 'sistema', variables: NONE, required: NONE, maxLength: MSG_MAX,
    defaultText: 'Esa opción ya no está disponible. Te muestro el menú de nuevo.',
  },
  account_picker_body: {
    label: 'Elegir cuenta: texto',
    description: 'Texto de la lista que se muestra cuando el cliente tiene varias cuentas de Netflix.',
    group: 'netflix', variables: NONE, required: NONE, maxLength: MSG_MAX,
    defaultText: 'Tienes varias cuentas de Netflix. ¿Para cuál es el código?',
  },
  account_picker_button: {
    label: 'Elegir cuenta: botón',
    description: 'Texto del botón que abre la lista de cuentas (máximo 20 caracteres).',
    group: 'netflix', variables: NONE, required: NONE, maxLength: NODE_LIMITS.listButtonMax,
    defaultText: 'Elegir cuenta',
  },
  access_none: {
    label: 'Datos de acceso: sin servicios',
    description: 'Se envía cuando el cliente pide sus datos de acceso y no tiene un servicio activo con este número.',
    group: 'sistema', variables: NONE, required: NONE, maxLength: MSG_MAX,
    defaultText: 'No encuentro un servicio activo a tu nombre con este número. Si crees que es un error, una persona te ayuda en breve.',
  },
  access_picker_body: {
    label: 'Datos de acceso: elegir servicio, texto',
    description: 'Texto de la lista que se muestra cuando el cliente tiene varios servicios activos.',
    group: 'sistema', variables: NONE, required: NONE, maxLength: MSG_MAX,
    defaultText: 'Tienes varios servicios activos. ¿De cuál necesitas los datos de acceso?',
  },
  access_picker_button: {
    label: 'Datos de acceso: elegir servicio, botón',
    description: 'Texto del botón que abre la lista de servicios (máximo 20 caracteres).',
    group: 'sistema', variables: NONE, required: NONE, maxLength: NODE_LIMITS.listButtonMax,
    defaultText: 'Elegir servicio',
  },
  access_code_notice: {
    label: 'Datos de acceso: servicio con código',
    description: 'Se añade a los datos de un servicio que entra con código: ahí no se envía la contraseña.',
    group: 'sistema', variables: NONE, required: NONE, maxLength: MSG_MAX,
    defaultText: 'Este servicio entra con un código: pídelo desde el menú cuando vayas a iniciar sesión.',
  },
  access_unavailable: {
    label: 'Datos de acceso: no disponibles',
    description: 'Se envía cuando no se pueden preparar los datos del cliente en este momento.',
    group: 'sistema', variables: NONE, required: NONE, maxLength: MSG_MAX,
    defaultText: 'No pude preparar tus datos de acceso en este momento. Una persona te ayuda en breve.',
  },
};

export const MESSAGE_KEYS = Object.keys(MESSAGE_CATALOG) as BotMessageKey[];
export const PARAM_KEYS = Object.keys(PARAM_CATALOG) as (keyof BotParams)[];
