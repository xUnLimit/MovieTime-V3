'use client';

import { useState } from 'react';
import { ACTION_CATALOG, NODE_LIMITS, addNode, addOption, buildFlowGraph, moveOption, parseOptionReplyId, removeNode, removeOption, startSimulation, stepSimulation, updateNode } from '@/modules/bot-config';
import { PhoneMockup } from '@/components/editor-mensajes/PhoneMockup';
import { Panel } from '@/components/shared/Panel';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { BotActionKey, BotAdminApi, BotNodeKind } from '@/types/bot';
import { BotState } from './BotState';

const kinds: { value: BotNodeKind; label: string }[] = [
  { value: 'buttons', label: 'Botones' }, { value: 'list', label: 'Lista' },
  { value: 'text', label: 'Texto' }, { value: 'action', label: 'Acción' },
];

export function FlowTab({ api }: { api: BotAdminApi }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newKind, setNewKind] = useState<BotNodeKind>('buttons');
  const [newName, setNewName] = useState('');
  const [simulation, setSimulation] = useState<ReturnType<typeof startSimulation> | null>(null);
  const def = api.draft;
  const node = def?.nodes.find(item => item.id === selectedId) ?? def?.nodes[0];
  const graph = def ? buildFlowGraph(def) : null;
  const maxOptions = node?.kind === 'buttons' ? NODE_LIMITS.buttonsMax : NODE_LIMITS.listRowsMax;
  function reorderNode(from: number, to: number) {
    api.updateDraft(current => {
      const nodes = [...current.nodes];
      [nodes[from], nodes[to]] = [nodes[to], nodes[from]];
      return { ...current, nodes };
    });
  }

  return <BotState api={api} empty={!def}><div className="space-y-4">
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(12rem,1fr)_minmax(0,2fr)]">
      <Panel title="Nodos" description="Selecciona un nodo para editarlo.">
        <div className="space-y-2">{def?.nodes.map((item, index) => {
          const reachable = graph?.nodes.find(vertex => vertex.id === item.id)?.reachable;
          return <div key={item.id} className="flex min-w-0 gap-1"><button type="button" onClick={() => setSelectedId(item.id)} aria-current={node?.id === item.id ? 'true' : undefined} className="flex min-h-10 min-w-0 flex-1 items-center justify-between gap-2 rounded-md border px-3 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
            <span className="truncate">{item.name}</span>{reachable === false ? <StatusBadge tone="warning">Inalcanzable</StatusBadge> : null}
          </button><Button size="sm" variant="outline" aria-label={`Subir ${item.name}`} disabled={index === 0} onClick={() => reorderNode(index, index - 1)}>↑</Button><Button size="sm" variant="outline" aria-label={`Bajar ${item.name}`} disabled={index === (def?.nodes.length ?? 0) - 1} onClick={() => reorderNode(index, index + 1)}>↓</Button></div>;
        })}</div>
        <div className="mt-4 space-y-2 border-t pt-4"><label className="block text-sm font-medium">Nombre del nodo nuevo<Input value={newName} onChange={event => setNewName(event.target.value)} /></label>
          <label className="block text-sm font-medium">Tipo de nodo<select className="h-8 w-full rounded-md border bg-card px-2" value={newKind} onChange={event => setNewKind(event.target.value as BotNodeKind)}>{kinds.map(kind => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select></label>
          <Button disabled={!newName.trim() || (def?.nodes.length ?? 0) >= NODE_LIMITS.nodesMax} onClick={() => { api.updateDraft(current => addNode(current, newKind, newName.trim())); setNewName(''); }}>Agregar nodo</Button>
        </div>
      </Panel>
      {node ? <Panel title={`Editar: ${node.name}`} actions={<Button variant="destructive" disabled={node.id === def?.entryNodeId} onClick={() => { api.updateDraft(current => removeNode(current, node.id)); setSelectedId(null); }}>Eliminar nodo</Button>}>
        <div className="space-y-3">
          <label className="block text-sm font-medium">Nombre<Input value={node.name} onChange={event => api.updateDraft(current => updateNode(current, node.id, { name: event.target.value }))} /></label>
          <label className="block text-sm font-medium">Tipo<select className="h-8 w-full rounded-md border bg-card px-2" value={node.kind} onChange={event => api.updateDraft(current => updateNode(current, node.id, { kind: event.target.value as BotNodeKind }))}>{kinds.map(kind => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select></label>
          {node.kind !== 'action' ? <label className="block text-sm font-medium">Texto<Textarea maxLength={NODE_LIMITS.bodyMax} value={node.body} onChange={event => api.updateDraft(current => updateNode(current, node.id, { body: event.target.value }))} /><span className="text-xs text-muted-foreground">{node.body.length}/{NODE_LIMITS.bodyMax}</span></label> : <label className="block text-sm font-medium">Acción<select className="h-8 w-full rounded-md border bg-card px-2" value={node.action ?? ''} onChange={event => api.updateDraft(current => updateNode(current, node.id, { action: event.target.value as BotActionKey }))}><option value="">Seleccionar acción</option>{Object.entries(ACTION_CATALOG).map(([key, action]) => <option key={key} value={key}>{action.label}</option>)}</select></label>}
          {node.kind === 'list' ? <label className="block text-sm font-medium">Texto del botón de lista<Input maxLength={NODE_LIMITS.listButtonMax} value={node.listButtonLabel ?? ''} onChange={event => api.updateDraft(current => updateNode(current, node.id, { listButtonLabel: event.target.value }))} /><span className="text-xs text-muted-foreground">{(node.listButtonLabel ?? '').length}/{NODE_LIMITS.listButtonMax}</span></label> : null}
          {(node.kind === 'buttons' || node.kind === 'list') ? <div className="space-y-3"><h3 className="text-sm font-semibold">Opciones</h3>{node.options.map((option, index) => <fieldset key={option.id} className="space-y-2 rounded-md border p-3"><legend className="px-1 text-xs text-muted-foreground">Opción {index + 1}</legend>
            <label className="block text-sm font-medium">Título<Input value={option.title} maxLength={node.kind === 'list' ? NODE_LIMITS.listTitleMax : NODE_LIMITS.buttonTitleMax} onChange={event => api.updateDraft(current => updateNode(current, node.id, { options: node.options.map(item => item.id === option.id ? { ...item, title: event.target.value } : item) }))} /></label>
            <label className="block text-sm font-medium">Destino<select className="h-8 w-full rounded-md border bg-card px-2" value={option.next} onChange={event => api.updateDraft(current => updateNode(current, node.id, { options: node.options.map(item => item.id === option.id ? { ...item, next: event.target.value } : item) }))}>{def?.nodes.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label>
            {node.kind === 'list' ? <label className="block text-sm font-medium">Descripción<Input value={option.description ?? ''} maxLength={NODE_LIMITS.listDescriptionMax} onChange={event => api.updateDraft(current => updateNode(current, node.id, { options: node.options.map(item => item.id === option.id ? { ...item, description: event.target.value } : item) }))} /></label> : null}
            <div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" disabled={index === 0} onClick={() => api.updateDraft(current => moveOption(current, node.id, index, index - 1))}>Subir</Button><Button size="sm" variant="outline" disabled={index === node.options.length - 1} onClick={() => api.updateDraft(current => moveOption(current, node.id, index, index + 1))}>Bajar</Button><Button size="sm" variant="destructive" onClick={() => api.updateDraft(current => removeOption(current, node.id, option.id))}>Quitar</Button></div>
          </fieldset>)}<Button variant="outline" disabled={node.options.length >= maxOptions} onClick={() => api.updateDraft(current => addOption(current, node.id))}>Agregar opción</Button></div> : null}
        </div>
      </Panel> : null}
    </div>
    {graph ? <Panel title="Diagrama del flujo" description="Selecciona un nodo para editarlo."><div className="max-w-full overflow-x-auto"><svg role="img" aria-label="Diagrama del flujo" viewBox={`0 0 ${Math.max(graph.width, 1)} ${Math.max(graph.height, 1)}`} className="min-w-[320px] max-w-full" style={{ height: Math.max(graph.height, 160) }}>
      {graph.edges.map((edge, index) => { const from = graph.nodes.find(item => item.id === edge.from); const to = graph.nodes.find(item => item.id === edge.to); return from && to ? <g key={`${edge.from}-${edge.to}-${index}`}><line x1={from.x + from.width / 2} y1={from.y + from.height} x2={to.x + to.width / 2} y2={to.y} stroke="currentColor" className="text-muted-foreground" /><title>{edge.label}</title></g> : null; })}
      {graph.nodes.map(vertex => <g key={vertex.id} role="button" tabIndex={0} aria-label={`Seleccionar ${vertex.name}`} onClick={() => setSelectedId(vertex.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(vertex.id); } }} className="cursor-pointer focus:outline-ring"><rect x={vertex.x} y={vertex.y} width={vertex.width} height={vertex.height} rx="6" fill="currentColor" className={vertex.reachable ? 'text-card' : 'text-warning-subtle'} stroke="currentColor" /><text x={vertex.x + 8} y={vertex.y + vertex.height / 2} dominantBaseline="middle" fill="currentColor" className="text-foreground text-xs">{vertex.name.slice(0, 22)}</text></g>)}
    </svg></div></Panel> : null}
    <Panel title="Simulador" contentClassName="overflow-x-auto" actions={<Button variant="outline" disabled={!def} onClick={() => { if (def) setSimulation(startSimulation(def)); }}>Iniciar simulación</Button>}>
      {simulation ? <PhoneMockup contactName="MovieTime PTY" contactStatus="Simulación" mode="bot">{simulation.turns.map((turn, index) => <div key={index} className={`max-w-[90%] rounded-md p-2 text-sm ${turn.from === 'customer' ? 'ml-auto bg-primary text-primary-foreground' : 'bg-card'}`}><p className="whitespace-pre-wrap">{turn.text}</p>{turn.buttons?.map(button => <Button key={button.id} className="mt-1 w-full" variant="outline" disabled={simulation.finished} onClick={() => { const reply = parseOptionReplyId(button.id); if (def && reply) setSimulation(stepSimulation(def, simulation, reply.optionId)); }}>{button.title}</Button>)}{turn.list ? <div className="mt-1 space-y-1"><p className="text-xs font-medium">{turn.list.buttonLabel}</p>{turn.list.rows.map(row => <Button key={row.id} variant="outline" className="h-auto w-full justify-start whitespace-normal text-left" disabled={simulation.finished} onClick={() => { const reply = parseOptionReplyId(row.id); if (def && reply) setSimulation(stepSimulation(def, simulation, reply.optionId)); }}>{row.title}{row.description ? ` · ${row.description}` : ''}</Button>)}</div> : null}</div>)}</PhoneMockup> : <p className="text-sm text-muted-foreground">Inicia la simulación para probar el recorrido.</p>}
    </Panel>
  </div></BotState>;
}
