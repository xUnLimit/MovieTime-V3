import { useState } from 'react';
import { PARAM_CATALOG } from '@/modules/bot-config';
import type { BotParams } from '@/types/bot';

/**
 * Campo numérico de un ajuste: se escribe libremente y se aplica al salir del campo (o con Enter) solo si es un entero en
 * rango; mientras tanto el error se dice junto al campo en vez de corregir el número a mitad de la escritura.
 */
export function useParamInput(paramKey: keyof BotParams, value: number, onChange: (value: number) => void) {
  const spec = PARAM_CATALOG[paramKey];
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? String(value);
  const parsed = Number(shown);
  const valid = shown.trim() !== '' && Number.isInteger(parsed) && parsed >= spec.min && parsed <= spec.max;
  const problem = text !== null && !valid ? `Escribe un número entero entre ${spec.min} y ${spec.max}.` : null;
  const commit = () => {
    if (text !== null && valid && parsed !== value) onChange(parsed);
    setText(null);
  };
  const reset = () => { setText(null); onChange(spec.defaultValue); };
  return { spec, shown, problem, setText, commit, reset, cancel: () => setText(null) };
}
