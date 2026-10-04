'use client';

import { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Panel } from '@/components/shared/Panel';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ShellPreview } from '../shell/ShellPreview';

const journeys = [
  { title: 'Resolver un pago desde Chats', entry: 'Chats → Ficha del cliente', detail: 'Pedido de Ana · Netflix y Disney+ · Total $12.00. Recibido $8.00; faltan $4.00. El pago pertenece a su pedido aunque otra persona pagó.', action: 'Tomar atención', next: 'Atención humana activa. La conversación conserva el comprobante y el pedido; puedes solicitar el faltante antes de entregar.' },
  { title: 'Cambiar el mensaje de renovación', entry: 'Automatizaciones → Renovación', detail: 'Selecciona el mensaje de confirmación. La vista previa utiliza datos de ejemplo y la publicación conserva la versión de los procesos abiertos.', action: 'Probar resultado', next: 'Simulación: Ana, recibimos tu pago. Tu servicio se renovó. Revisa la vista previa y guarda el cambio.' },
  { title: 'Activar acceso por código', entry: 'Servicios → Cuenta', detail: 'Cuenta Netflix · 4 clientes vigentes. El modo se aplica a clientes actuales y futuros. Antes de activarlo, rota la contraseña y comunica el cambio.', action: 'Revisar efecto sobre clientes', next: '4 clientes usarán Solicitar código. La contraseña no se incluirá en los envíos automáticos. Confirma la rotación desde el detalle de la cuenta.' },
  { title: 'Revisar un pedido de varios servicios', entry: 'Ventas → Pedidos', detail: 'Pedido de Ana · Netflix $6.00 y Disney+ $6.00. Cobro confirmado: $12.00. Asignación completa. Acceso pendiente de envío.', action: 'Ver entrega pendiente', next: 'El cobro ya está registrado. Reintenta el envío del acceso sin volver a cobrar ni crear ventas adicionales.' },
  { title: 'Avisar a interesados', entry: 'Terceros → Interesados', detail: 'Disney+ disponible · 3 interesados; 2 dieron consentimiento para recibir un aviso. El interés sin consentimiento conserva su consulta sin autorizar el envío.', action: 'Revisar destinatarios', next: '2 destinatarios elegibles. El aviso crea una invitación temporal. El stock se reserva después de confirmar la selección; pausar o cancelar detiene futuros avisos.' },
] as const;

function Journeys() {
  const [selected, setSelected] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);
  const [message, setMessage] = useState('Hola {{cliente}}, recibimos tu pago. Tu servicio se renovó.');
  const journey = selected === null ? null : journeys[selected];
  return <div className="min-w-0 space-y-4">
    <PageHeader title="Recorridos de operación" description="Prototipo interactivo con datos de ejemplo. No cambia datos del negocio." />
    {journey ? <>
      <Button variant="ghost" onClick={() => { setSelected(null); setCompleted(false); }}><ArrowLeft />Volver a recorridos</Button>
      <Panel title={journey.title} description={journey.entry}>
        <div className="space-y-4">
          <p className="max-w-prose text-sm">{journey.detail}</p>
          {selected === 1 ? <div className="space-y-2"><Label htmlFor="journey-message">Mensaje de renovación</Label><Textarea id="journey-message" value={message} onChange={event => { setMessage(event.target.value); setCompleted(false); }} /><p className="whitespace-pre-wrap text-sm">Vista previa: {message.replace('{{cliente}}', 'Ana')}</p></div> : null}
          {completed ? <div role="status" className="space-y-2"><StatusBadge tone="success">Revisión completada</StatusBadge><p className="max-w-prose text-sm">{journey.next}</p></div> : null}
          <Button onClick={() => setCompleted(true)} disabled={completed || (selected === 1 && !message.trim())}>{completed ? <Check /> : null}{completed ? 'Resultado revisado' : journey.action}</Button>
        </div>
      </Panel>
    </> : <Panel title="Elige una tarea" description="Cada recorrido reúne el contexto, una decisión y el siguiente paso."><ul className="divide-y">{journeys.map((item, index) => <li key={item.title} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="text-sm font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.entry}</p></div><Button variant="outline" onClick={() => setSelected(index)}>Revisar recorrido</Button></li>)}</ul></Panel>}
  </div>;
}

export function AutomationJourneysPreview() { return <ShellPreview><Journeys /></ShellPreview>; }
