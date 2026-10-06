import type { BotParams } from '@/types/bot';

export type ParamGroup = { id: 'atencion' | 'codigos' | 'limites'; title: string; description: string; params: readonly (keyof BotParams)[] };

/** Los ajustes numéricos agrupados por lo que cambian en la conversación, no por su nombre técnico. */
export const PARAM_GROUPS: readonly ParamGroup[] = [
  { id: 'atencion', title: 'Menú y atención', description: 'Cuándo vuelve a ofrecerse el menú y cuándo el bot deja hablar a una persona.', params: ['menuIdleHours', 'operatorQuietMinutes'] },
  { id: 'codigos', title: 'Códigos de Netflix', description: 'Qué tan recientes deben ser los correos para entregar un código.', params: ['loginWindowMinutes', 'travelWindowMinutes'] },
  { id: 'limites', title: 'Límites de uso', description: 'Evitan que un solo cliente sature el bot pulsando el menú sin parar.', params: ['maxTaps', 'tapWindowMinutes'] },
];
