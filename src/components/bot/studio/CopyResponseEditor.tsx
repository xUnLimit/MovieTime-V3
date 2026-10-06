'use client';

import { useState } from 'react';
import { COPY_CATALOG, COPY_VARIABLES, type CopyKey } from '@/modules/commerce-copy/catalog';
import { copyProblem, renderCopyText, sampleValues } from '@/modules/commerce-copy/render';
import { ResponseFrame } from './ResponseEditor';

type CopyResponseEditorProps = {
  copyKey: CopyKey;
  /** Texto guardado en el bloque del recorrido; sin valor rige `inherited` o, si tampoco hay, el original. */
  saved: string | undefined;
  /** Texto guardado fuera del recorrido (antigua pestaña Compras) que el bot usa mientras el bloque no tenga uno propio. */
  inherited?: string;
  /** `null` quita el texto del bloque y vuelve a regir `inherited` o el original. */
  onApply: (text: string | null) => void;
};

/**
 * Texto de un paso de la compra, editado igual que una respuesta del bot: lo válido se aplica al borrador al escribir. El bloque
 * no admite un texto inválido, así que mientras lo sea solo vive en el campo y se avisa el motivo junto a él.
 */
export function CopyResponseEditor({ copyKey, saved, inherited, onApply }: CopyResponseEditorProps) {
  const spec = COPY_CATALOG[copyKey];
  const original = spec.defaultText.trim();
  // Lo que rige cuando el bloque no trae texto propio.
  const base = (inherited ?? spec.defaultText).trim();
  const current = saved ?? inherited ?? spec.defaultText;
  const [text, setText] = useState(current);
  const [seen, setSeen] = useState(current);
  // Un cambio de fuera (deshacer, descartar, cargar una versión) reemplaza el campo; el eco de lo que se acaba de escribir no.
  if (current !== seen) {
    setSeen(current);
    if (current.trim() !== text.trim()) setText(current);
  }
  const problem = copyProblem(copyKey, text);
  const store = (value: string) => onApply(value === base ? null : value);
  const change = (value: string) => {
    setText(value);
    if (copyProblem(copyKey, value) === null) store(value.trim());
  };
  const restore = () => { setText(spec.defaultText); store(original); };
  return <ResponseFrame title={spec.label} hint={spec.when} edited={text.trim() !== original} onRestore={restore}
    note={saved === undefined && inherited !== undefined
      ? <p role="note" className="text-xs text-muted-foreground">El bot usa este texto, guardado en la antigua pestaña Compras. Si lo cambias aquí, el cambio queda en el recorrido.</p> : null}
    value={text} maxLength={spec.maxLength} multiline={spec.kind === 'message'} onChange={change}
    problems={problem ? [{ message: problem, severity: 'error' }] : []}
    variables={spec.variables.map((name) => ({ name, label: COPY_VARIABLES[name].label, example: COPY_VARIABLES[name].example, required: (spec.required as readonly string[]).includes(name) }))}
    previewText={renderCopyText(text, sampleValues(copyKey))} previewTestId="copy-preview" />;
}
