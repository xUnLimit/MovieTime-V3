'use client';

import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { NODE_LIMITS, WAIT_HOURS, canAddOption } from '@/modules/bot-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { BotNode } from '@/types/bot';
import type { FlowActions, FlowTarget } from './flow-actions';
import { SELECT_CLASS } from './OptionRow';

type Mode = 'end' | 'continue' | 'wait';
const MODES: readonly { value: Mode; label: string }[] = [
  { value: 'end', label: 'Terminar aquí' },
  { value: 'continue', label: 'Continuar con otro paso' },
  { value: 'wait', label: 'Esperar la respuesta del cliente' },
];
const HOURS_CHOICES = [1, 2, 6, 12, 24, 48, 72];

type TextAfterEditorProps = { node: BotNode; targets: readonly FlowTarget[]; actions: FlowActions };

function Destination({ node, optionId, label, next, targets, actions }: {
  node: BotNode; optionId: string; label: string; next: string; targets: readonly FlowTarget[]; actions: FlowActions;
}) {
  const known = targets.some((target) => target.id === next);
  return <select className={SELECT_CLASS} aria-label={label} value={next} onChange={(event) => actions.connect(node.id, optionId, event.target.value)}>
    {known ? null : <option value={next}>Destino inexistente</option>}
    {targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
  </select>;
}

/** Las respuestas escritas que espera un texto: palabras que identifican cada una, a dónde lleva y «cualquier otra respuesta». */
function WaitRules({ node, targets, actions }: TextAfterEditorProps) {
  const unit = node.after?.mode === 'wait' ? node.after.unit ?? 'hours' : 'hours';
  const hours = node.after?.mode === 'wait' ? node.after.hours : WAIT_HOURS.default;
  const rawValue = unit === 'minutes' ? hours * 60 : hours;
  const value = Math.abs(rawValue - Math.round(rawValue)) < 1e-9 ? Math.round(rawValue) : rawValue;
  const max = WAIT_HOURS.max * (unit === 'minutes' ? 60 : 1);
  const presets = unit === 'minutes' ? [1, 5, 10, 15, 30, 60] : HOURS_CHOICES;
  const choices = presets.includes(value) ? presets : [...presets, value].sort((a, b) => a - b);
  const update = (value: number, selectedUnit = unit) => actions.updateNode(node.id, {
    after: { mode: 'wait', hours: selectedUnit === 'minutes' ? value / 60 : value, unit: selectedUnit },
  });
  const rules = node.options.flatMap((option, index) => (option.any ? [] : [{ option, index }]));
  const catchAll = node.options.find((option) => option.any);
  return <div className="space-y-3">
    <label className="block text-sm font-medium">Unidad de espera
      <select className={SELECT_CLASS} value={unit} onChange={event => update(value, event.target.value === 'minutes' ? 'minutes' : 'hours')}>
        <option value="hours">Horas</option><option value="minutes">Minutos</option>
      </select>
    </label>
    <label className="block text-sm font-medium">Esperar hasta
      <select className={SELECT_CLASS} value={value} onChange={event => update(Number(event.target.value))}>
        {choices.map(choice => <option key={choice} value={choice}>{choice} {unit === 'minutes' ? choice === 1 ? 'minuto' : 'minutos' : choice === 1 ? 'hora' : 'horas'}</option>)}
      </select>
    </label>
    <label className="block text-sm font-medium">{unit === 'minutes' ? 'Minutos de espera' : 'Horas de espera'}
      <Input type="number" min={1} max={max} step={1} value={value === 0 ? '' : value}
        aria-invalid={!Number.isInteger(value) || value < 1 || value > max}
        onChange={event => update(Number(event.target.value))} />
    </label>
    <p className="text-xs text-muted-foreground">Puedes escribir un valor personalizado de 1 a {max} {unit === 'minutes' ? 'minutos' : 'horas'}.</p>
    <p className="text-xs text-muted-foreground">
      El cliente responde escribiendo. Gana la primera respuesta que incluya alguna de sus palabras, en este orden. Sepáralas con comas: «sí, claro, ok».
    </p>
    <ul aria-label={`Respuestas de ${node.name}`} className="space-y-2">
      {rules.map(({ option, index }, position) => {
        const label = `respuesta ${position + 1} de ${node.name}`;
        const before = rules[position - 1]?.index;
        const after = rules[position + 1]?.index;
        return <li key={option.id} className="space-y-1.5 rounded-md border p-2">
          <div className="flex items-center gap-1">
            <Input className="min-w-0 flex-1" aria-label={`Palabras de la ${label}`} placeholder="sí, claro, ok" maxLength={NODE_LIMITS.answerMax} value={option.title}
              onChange={(event) => actions.updateOption(node.id, option.id, { title: event.target.value })} />
            <Button type="button" size="icon-sm" variant="ghost" aria-label={`Subir ${label}`} disabled={before === undefined} onClick={() => before !== undefined && actions.moveOption(node.id, index, before)}><ChevronUp /></Button>
            <Button type="button" size="icon-sm" variant="ghost" aria-label={`Bajar ${label}`} disabled={after === undefined} onClick={() => after !== undefined && actions.moveOption(node.id, index, after)}><ChevronDown /></Button>
            <Button type="button" size="icon-sm" variant="ghost" aria-label={`Quitar ${label}`} onClick={() => actions.removeOption(node.id, option.id)}><Trash2 /></Button>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="shrink-0">Lleva a</span>
            <Destination node={node} optionId={option.id} label={`Destino de la ${label}`} next={option.next} targets={targets} actions={actions} />
          </div>
        </li>;
      })}
    </ul>
    {catchAll ? <div className="space-y-1.5 rounded-md border border-dashed p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Cualquier otra respuesta</p>
        <Button type="button" size="icon-sm" variant="ghost" aria-label={`Quitar cualquier otra respuesta de ${node.name}`} onClick={() => actions.removeOption(node.id, catchAll.id)}><Trash2 /></Button>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="shrink-0">Lleva a</span>
        <Destination node={node} optionId={catchAll.id} label={`Destino de cualquier otra respuesta de ${node.name}`} next={catchAll.next} targets={targets} actions={actions} />
      </div>
    </div> : <p className="text-xs text-muted-foreground">Sin «cualquier otra respuesta»: si lo que escribe el cliente no coincide, el bot no contesta y el chat queda para una persona.</p>}
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" disabled={!canAddOption(node)} onClick={() => actions.addOption(node.id)}><Plus />Agregar respuesta</Button>
      <Button type="button" variant="outline" disabled={catchAll !== undefined || !canAddOption(node)} onClick={() => actions.addCatchAll(node.id)}><Plus />Agregar «cualquier otra respuesta»</Button>
    </div>
  </div>;
}

/**
 * Qué pasa después de un texto: terminar ahí, continuar con mensajes juntos o separados, o esperar lo que escriba el
 * cliente y seguir por la respuesta que coincida.
 */
export function TextAfterEditor({ node, targets, actions }: TextAfterEditorProps) {
  const mode: Mode = node.after?.mode ?? 'end';
  const next = node.options[0];
  return <section aria-label="Después de este mensaje" className="space-y-3 rounded-md border p-3">
    <div>
      <h3 className="text-sm font-semibold">Después de este mensaje</h3>
      <p className="text-xs text-muted-foreground">Elige si aquí termina, si sigue solo con otro paso o si espera una respuesta escrita del cliente.</p>
    </div>
    <div role="group" aria-label="Qué pasa después" className="flex flex-wrap gap-2">
      {MODES.map((item) => <Button key={item.value} type="button" size="sm" variant={mode === item.value ? 'secondary' : 'outline'} aria-pressed={mode === item.value}
        onClick={() => actions.setTextAfter(node.id, item.value)}>{item.label}</Button>)}
    </div>
    {mode === 'end' ? <p className="text-xs text-muted-foreground">Es un mensaje final: la conversación queda ahí hasta que el cliente escriba algo que active el menú.</p> : null}
    {mode === 'continue' && next ? <div className="space-y-1.5">
      <label className="block text-sm font-medium">Continúa en
        <Destination node={node} optionId={next.id} label={`Continúa en, desde ${node.name}`} next={next.next} targets={targets} actions={actions} />
      </label>
      <label className="block text-sm font-medium">Enviar mensajes
        <select className={SELECT_CLASS} value={node.after?.mode === 'continue' ? node.after.delivery ?? 'joined' : 'joined'}
          onChange={event => actions.updateNode(node.id, { after: { mode: 'continue', delivery: event.target.value === 'separate' ? 'separate' : 'joined' } })}>
          <option value="joined">Juntos, en un mensaje</option>
          <option value="separate">Separados, uno después del otro</option>
        </select>
      </label>
      <p className="text-xs text-muted-foreground">{node.after?.mode === 'continue' && node.after.delivery === 'separate'
        ? 'Primero se envía este texto y después el paso siguiente, sin esperar una respuesta del cliente.'
        : `Este texto se envía junto con el paso siguiente en un solo mensaje; entre los dos caben hasta ${NODE_LIMITS.bodyMax} caracteres.`}</p>
    </div> : null}
    {mode === 'wait' ? <WaitRules node={node} targets={targets} actions={actions} /> : null}
  </section>;
}
