'use client';

import { useMemo, useState } from 'react';
import { GitBranch, LayoutList, Plus, ShoppingCart, Workflow } from 'lucide-react';
import { CONDITION_CATALOG, CONDITION_TYPES, NODE_LIMITS, canAddNode, flowWideIssues, hasPurchaseBlocks, issuesByNode } from '@/modules/bot-config';
import { Panel } from '@/components/shared/Panel';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/use-media-query';
import type { BotAdminApi } from '@/types/bot';
import { BotState } from './BotState';
import { KINDS, KIND_LABELS, useFlowActions } from './flow/flow-actions';
import { FlowCanvas } from './flow/FlowCanvas';
import { FlowSimulator } from './flow/FlowSimulator';
import { IssueList } from './flow/IssueList';
import { NodeEditor } from './flow/NodeEditor';
import { NodeList } from './flow/NodeList';
import { TemplatePicker } from './flow/TemplatePicker';

type View = 'canvas' | 'list';

/** Editor del recorrido: lienzo en pantallas anchas, lista de nodos con panel de edicion en angostas o por eleccion. */
export function FlowTab({ api }: { api: BotAdminApi }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>('canvas');
  const wide = useMediaQuery('(min-width: 1024px)');
  const actions = useFlowActions(api, setSelectedId);
  const def = api.draft;
  const problems = useMemo(() => issuesByNode(api.issues), [api.issues]);
  const node = def?.nodes.find((item) => item.id === selectedId) ?? def?.nodes[0];
  const showCanvas = wide && view === 'canvas';
  const errors = api.issues.filter((issue) => issue.severity === 'error').length;

  return <BotState api={api} empty={!def}>{def && node ? <div className="space-y-4">
    <Panel title="Pasos del recorrido" description="Conecta cada botón o fila con el paso al que lleva. Publicar se bloquea mientras haya errores."
      actions={wide ? <>
        <Button variant={view === 'canvas' ? 'secondary' : 'outline'} aria-pressed={view === 'canvas'} onClick={() => setView('canvas')}><Workflow />Lienzo</Button>
        <Button variant={view === 'list' ? 'secondary' : 'outline'} aria-pressed={view === 'list'} onClick={() => setView('list')}><LayoutList />Lista</Button>
      </> : undefined}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Agregar nodo">
          {KINDS.map((kind) => <Button key={kind} variant="outline" aria-label={`Agregar nodo de ${KIND_LABELS[kind].toLowerCase()}`} disabled={!canAddNode(def)} onClick={() => actions.addNode(kind)}><Plus />{KIND_LABELS[kind]}</Button>)}
          {api.purchaseBlocksEnabled && !hasPurchaseBlocks(def)
            ? <Button variant="outline" disabled={def.nodes.length + 4 > NODE_LIMITS.nodesMax} onClick={() => void actions.addPurchaseFlow()}><ShoppingCart />Agregar flujo de compras</Button> : null}
          {hasPurchaseBlocks(def) ? <Button variant="outline" onClick={actions.removePurchaseFlow}>Quitar flujo de compras</Button> : null}
          {api.flowExtensionsEnabled ? CONDITION_TYPES.map((type) => <Button key={type} variant="outline" disabled={!canAddNode(def)} onClick={() => actions.addCondition(type)}><GitBranch />Condición: {CONDITION_CATALOG[type].label.toLowerCase()}</Button>) : null}
          <p role="status" className={errors > 0 ? 'text-sm text-danger' : 'text-sm text-muted-foreground'}>
            {errors > 0 ? `${errors} ${errors === 1 ? 'error impide' : 'errores impiden'} publicar` : 'Sin errores: se puede publicar'}
          </p>
        </div>
        <TemplatePicker actions={actions} purchaseBlocksEnabled={api.purchaseBlocksEnabled} />
        <IssueList issues={flowWideIssues(api.issues)} label="Problemas del recorrido" />
        {showCanvas
          ? <FlowCanvas def={def} issues={api.issues} selectedId={node.id} onSelect={setSelectedId} actions={actions} />
          : <NodeList def={def} problems={problems} selectedId={node.id} onSelect={setSelectedId} actions={actions} />}
      </div>
    </Panel>
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <NodeEditor def={def} node={node} actions={actions} showOptions={!showCanvas} extensionsEnabled={api.flowExtensionsEnabled} />
      <FlowSimulator def={def} />
    </div>
  </div> : null}</BotState>;
}
