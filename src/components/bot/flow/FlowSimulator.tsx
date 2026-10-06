'use client';

import { useState } from 'react';
import { answerSimulation, defaultSample, nodeVariablesIn, parseOptionReplyId, startSimulation, stepSimulation, type SimulationSample } from '@/modules/bot-config';
import { PhoneMockup } from '@/components/editor-mensajes/PhoneMockup';
import { Panel } from '@/components/shared/Panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { BotDefinition } from '@/types/bot';
import { SampleDataEditor } from './SampleDataEditor';

type Simulation = ReturnType<typeof startSimulation>;

/** `onStep`: avisa en qué nodo va la simulación (o `null` al no haber), para resaltarlo en el lienzo. */
export function FlowSimulator({ def, onStep }: { def: BotDefinition; onStep?: (nodeId: string | null) => void }) {
  const [simulation, setSimulationState] = useState<Simulation | null>(null);
  const [written, setWritten] = useState('');
  const setSimulation = (next: Simulation) => { setSimulationState(next); setWritten(''); onStep?.(next.currentNodeId); };
  const [sample, setSample] = useState<SimulationSample>(defaultSample);
  const usesExtensions = def.nodes.some((node) => node.condition !== undefined || nodeVariablesIn(node.body).length > 0);
  function choose(optionReplyId: string) {
    const reply = parseOptionReplyId(optionReplyId);
    if (simulation && reply) setSimulation(stepSimulation(def, simulation, reply.optionId));
  }
  // Un texto que espera la respuesta del cliente: se escribe lo que respondería, como en WhatsApp.
  const waiting = simulation !== null && !simulation.finished && simulation.awaitingNodeId !== undefined;
  return <Panel title="Simulador" contentClassName="overflow-x-auto" actions={<Button variant="outline" onClick={() => setSimulation(startSimulation(def, sample))}>Iniciar simulación</Button>}>
    {usesExtensions ? <div className="mb-3"><SampleDataEditor sample={sample} onChange={setSample} /></div> : null}
    {simulation ? <PhoneMockup contactName="MovieTime PTY" contactStatus="Simulación" mode="bot">{simulation.turns.map((turn, index) => <div key={index} className={`max-w-[90%] rounded-md p-2 text-sm ${turn.from === 'customer' ? 'ml-auto bg-primary text-primary-foreground' : 'bg-card'}`}>
      <p className="whitespace-pre-wrap">{turn.text}</p>
      {turn.buttons?.map((button) => <Button key={button.id} className="mt-1 w-full" variant="outline" disabled={simulation.finished} onClick={() => choose(button.id)}>{button.title}</Button>)}
      {turn.list ? <div className="mt-1 space-y-1"><p className="text-xs font-medium">{turn.list.buttonLabel}</p>
        {turn.list.rows.map((row) => <Button key={row.id} variant="outline" className="h-auto w-full justify-start text-left whitespace-normal" disabled={simulation.finished} onClick={() => choose(row.id)}>{row.title}{row.description ? ` · ${row.description}` : ''}</Button>)}
      </div> : null}
    </div>)}</PhoneMockup> : <p className="text-sm text-muted-foreground">Inicia la simulación para probar el recorrido.</p>}
    {waiting && simulation ? <form className="mt-3 flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); if (written.trim() !== '') setSimulation(answerSimulation(def, simulation, written)); }}>
      <Input className="min-w-0 flex-1" aria-label="Respuesta del cliente" placeholder="Escribe lo que respondería el cliente…" value={written} onChange={(event) => setWritten(event.target.value)} />
      <Button type="submit" disabled={written.trim() === ''}>Enviar respuesta</Button>
    </form> : null}
  </Panel>;
}
