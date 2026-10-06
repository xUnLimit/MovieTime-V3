import type { BotDefinition, BotMessageKey, BotParams } from '@/types/bot';
import { MESSAGE_CATALOG, MESSAGE_KEYS, PARAM_CATALOG, PARAM_KEYS } from './catalog';

const DEFAULT_KEYWORDS = ['hola', 'buenas', 'buenos', 'menu', 'ayuda', 'opciones', 'codigo', 'netflix'];

export function defaultMessages(): Record<BotMessageKey, string> {
  return Object.fromEntries(MESSAGE_KEYS.map((key) => [key, MESSAGE_CATALOG[key].defaultText])) as Record<BotMessageKey, string>;
}

export function defaultParams(): BotParams {
  return Object.fromEntries(PARAM_KEYS.map((key) => [key, PARAM_CATALOG[key].defaultValue])) as BotParams;
}

/** Flujo por defecto: menu, Netflix (inicio de sesion o viaje) y soporte. Cada llamada devuelve un objeto nuevo. */
export function defaultDefinition(): BotDefinition {
  return {
    schemaVersion: 1,
    entryNodeId: 'menu',
    nodes: [
      {
        id: 'menu', name: 'Menú principal', kind: 'buttons',
        body: 'Hola, soy el asistente de MovieTime PTY. ¿Qué necesitas?',
        options: [
          { id: 'codigo', title: 'Código de Netflix', next: 'netflix' },
          { id: 'soporte', title: 'Hablar con soporte', next: 'soporte' },
        ],
      },
      {
        id: 'netflix', name: 'Tipo de código de Netflix', kind: 'buttons',
        body: '¿Qué código necesitas?\n\n'
          + '*Iniciar sesión*: Netflix te pidió un código para entrar a tu cuenta en un dispositivo.\n'
          + '*Estoy de viaje*: Netflix te pidió confirmar tu dispositivo o ubicación fuera de casa.\n\n'
          + 'Primero pide el código en Netflix y luego toca el botón.',
        options: [
          { id: 'login', title: 'Iniciar sesión', next: 'login' },
          { id: 'viaje', title: 'Estoy de viaje', next: 'viaje' },
        ],
      },
      { id: 'login', name: 'Código de inicio de sesión', kind: 'action', body: '', options: [], action: 'netflix_login_code' },
      { id: 'viaje', name: 'Código de viaje', kind: 'action', body: '', options: [], action: 'netflix_travel_code' },
      { id: 'soporte', name: 'Hablar con soporte', kind: 'action', body: '', options: [], action: 'handoff' },
    ],
    messages: defaultMessages(),
    params: defaultParams(),
    keywords: [...DEFAULT_KEYWORDS],
  };
}
