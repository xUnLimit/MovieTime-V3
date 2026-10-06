'use client';

import '@xyflow/react/dist/style.css';
import { useMemo, useState, type ReactNode } from 'react';
import { Background, Controls, ReactFlow } from '@xyflow/react';
import { PanelInset } from '@/components/shared/Panel';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCommerceCopy } from '@/hooks/use-commerce-copy';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/platform/utils';
import type { CopyStepId } from '@/modules/commerce-copy/catalog';
import { FLOW_STEPS } from '@/modules/commerce-copy/flow';
import type { BotDefinition } from '@/types/bot';
import type { FlowActions } from '../flow/flow-actions';
import { FlowSimulator } from '../flow/FlowSimulator';
import { usePurchaseDiagram } from '../flow/purchase-diagram';
import { blockFor, stepData } from '../flow/purchase-steps';
import { PurchaseStepNode, type PurchaseStepFlowNode } from '../flow/PurchaseStepNode';
import { ServiceMessagesEditor } from '../flow/ServiceMessagesEditor';
import { StepCopyList } from '../flow/StepCopyList';
import { StudioShell } from './StudioShell';

const nodeTypes = { step: PurchaseStepNode };
const ZOOM_KEYS = ['Control', 'Meta'];
/** Elemento extra de la lista: los mensajes propios de cada plataforma y plan, que no son un paso del diagrama. */
const SERVICES = 'servicios-mensajes';
type Selection = CopyStepId | typeof SERVICES;
type Pane = 'pasos' | 'paso' | 'probar';

type PurchaseStudioProps = {
  def: BotDefinition;
  actions: FlowActions;
  updateDraft: (updater: (current: BotDefinition) => BotDefinition) => void;
  /** Estado de publicación y botones de vista, que comparte la barra con el estudio del recorrido. */
  status: ReactNode;
  switcher: ReactNode;
};

const ROW = 'flex min-h-12 w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-14';

/**
 * Flujo de compra dentro del estudio: la lista de pasos, el diagrama fijo y, a la derecha, los textos del paso elegido
 * (o los mensajes por servicio) y el simulador. La estructura no se edita: reservar, cobrar y entregar son reglas del servidor.
 */
export function PurchaseStudio({ def, actions, updateDraft, status, switcher }: PurchaseStudioProps) {
  const stored = useCommerceCopy();
  const wide = useMediaQuery('(min-width: 1024px)');
  const [selected, setSelected] = useState<Selection>('plataformas');
  const [pane, setPane] = useState<Pane>('pasos');
  const inherited = useMemo<Partial<Record<string, string>>>(() => stored.data?.overrides ?? {}, [stored.data]);
  const steps = useMemo(() => FLOW_STEPS.filter((item) => blockFor(def, item.id) !== undefined), [def]);
  const data = useMemo(() => stepData(def, steps.map((item) => item.id), inherited), [def, steps, inherited]);
  const services = selected === SERVICES;
  const step = !services && steps.some((item) => item.id === selected) ? (selected as CopyStepId) : steps[0]?.id;
  const { nodes, edges, onNodesChange } = usePurchaseDiagram({ steps, data, current: services ? undefined : step, compact: true });
  const block = step ? blockFor(def, step) : undefined;
  const choose = (next: Selection) => { setSelected(next); setPane('paso'); };

  const list = <ul aria-label="Pasos de la compra" className="min-h-0 flex-1 overflow-y-auto p-1.5">
    {steps.map((item) => {
      const info = data.get(item.id);
      const current = !services && item.id === step;
      return <li key={item.id}>
        <button type="button" aria-current={current ? 'true' : undefined} onClick={() => choose(item.id)} className={cn(ROW, current && 'bg-accent')}>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-medium">{item.title}</span>
            <span className="block truncate text-xs text-muted-foreground">{info?.total ?? 0} {info?.total === 1 ? 'texto' : 'textos'}</span>
          </span>
          {info && info.edited > 0 ? <StatusBadge tone="info">{info.edited} {info.edited === 1 ? 'editado' : 'editados'}</StatusBadge> : null}
        </button>
      </li>;
    })}
    <li className="mt-1 border-t pt-1">
      <button type="button" aria-current={services ? 'true' : undefined} onClick={() => choose(SERVICES)} className={cn(ROW, services && 'bg-accent')}>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-medium">Mensajes por servicio</span>
          <span className="block truncate text-xs text-muted-foreground">Cada plataforma y plan</span>
        </span>
      </button>
    </li>
  </ul>;

  const edit = services
    ? <ServiceMessagesEditor def={def} update={updateDraft} />
    : step && block ? <div className="space-y-4 p-4">
      <StepCopyList key={step} node={block} steps={[step]} actions={actions} />
    </div> : null;

  if (!wide) {
    return <Tabs value={pane} onValueChange={(value) => setPane(value === 'paso' || value === 'probar' ? value : 'pasos')} className="gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsList variant="pills" aria-label="Paneles del flujo de compra"><TabsTrigger value="pasos">Pasos</TabsTrigger><TabsTrigger value="paso">Textos</TabsTrigger><TabsTrigger value="probar">Probar</TabsTrigger></TabsList>
        <div className="flex items-center gap-2">{switcher}</div>
      </div>
      {status}
      <TabsContent value="pasos" className="flex rounded-xl border bg-card">{list}</TabsContent>
      <TabsContent value="paso" className="rounded-xl border bg-card">{edit}</TabsContent>
      <TabsContent value="probar"><FlowSimulator def={def} /></TabsContent>
    </Tabs>;
  }

  const inspector = <Tabs value={pane === 'probar' ? 'probar' : 'paso'} onValueChange={(value) => setPane(value === 'probar' ? 'probar' : 'paso')} className="min-h-0 flex-1 gap-0">
    <div className="border-b p-3"><TabsList variant="pills" aria-label="Inspector del flujo de compra"><TabsTrigger value="paso">Textos</TabsTrigger><TabsTrigger value="probar">Probar</TabsTrigger></TabsList></div>
    <PanelInset>
      <TabsContent value="paso" className="min-h-0 overflow-y-auto">{edit}</TabsContent>
      <TabsContent value="probar" className="min-h-0 overflow-y-auto"><FlowSimulator def={def} /></TabsContent>
    </PanelInset>
  </Tabs>;
  return <StudioShell status={status} actions={switcher} sidebar={list} inspector={inspector}>
    <div className="h-full w-full bg-muted" role="region" aria-label="Diagrama del flujo de compra">
      <ReactFlow<PurchaseStepFlowNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onNodeClick={(_, node) => choose(node.id as CopyStepId)}
        nodesDraggable={false} nodesConnectable={false} edgesFocusable={false} zoomOnScroll={false} preventScrolling={false} zoomActivationKeyCode={ZOOM_KEYS}
        fitView fitViewOptions={{ maxZoom: 1, padding: 0.12 }} minZoom={0.2}>
        <Background gap={16} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  </StudioShell>;
}
