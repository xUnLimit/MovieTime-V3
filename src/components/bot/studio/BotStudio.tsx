'use client';

import { useEffect, useMemo, useState } from 'react';
import { Redo2, ShoppingCart, Undo2, Workflow } from 'lucide-react';
import { flowWideIssues, hasPurchaseBlocks, issuesByNode, withPurchaseBlocks } from '@/modules/bot-config';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMediaQuery } from '@/hooks/use-media-query';
import type { BotAdminApi } from '@/types/bot';
import { BotState } from '../BotState';
import { useFlowActions } from '../flow/flow-actions';
import { FlowCanvas } from '../flow/FlowCanvas';
import { FlowSimulator } from '../flow/FlowSimulator';
import { IssueList } from '../flow/IssueList';
import { PurchaseStudio } from './PurchaseStudio';
import { TemplatesDialog } from '../flow/TemplatesDialog';
import { StepSidebar } from './StepSidebar';
import { StudioInspector } from './StudioInspector';
import { StudioShell } from './StudioShell';
import { useDraftHistory } from './use-draft-history';
import { hideUnlinkedBlocks } from './visible-nodes';
import { NodeEditor } from '../flow/NodeEditor';

type Pane = 'pasos' | 'paso' | 'probar';

/**
 * Estudio del recorrido: lista de pasos, lienzo de estructura e inspector en una sola pantalla, para editar y probar sin
 * bajar la página. En pantallas angostas (< 1024px) las tres columnas pasan a tres paneles que se alternan.
 * El flujo de compra conserva su propia vista: su estructura es fija y solo cambian los textos.
 */
export function BotStudio({ api }: { api: BotAdminApi }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pane, setPane] = useState<Pane>('pasos');
  const [view, setView] = useState<'canvas' | 'purchase'>('canvas');
  const [active, setActive] = useState<string | null>(null);
  const wide = useMediaQuery('(min-width: 1024px)');
  const history = useDraftHistory(api);
  const studioApi = useMemo<BotAdminApi>(() => ({ ...api, updateDraft: history.edit }), [api, history.edit]);
  const actions = useFlowActions(studioApi, setSelectedId);
  const def = api.draft;
  const node = def?.nodes.find((item) => item.id === selectedId) ?? def?.nodes[0];
  // El flujo de compra se edita siempre: si el borrador aún no tiene los bloques se muestra con ellos y se crean con la primera edición.
  const purchaseDef = useMemo(() => (def ? withPurchaseBlocks(def) : null), [def]);
  const hasPurchase = purchaseDef ? hasPurchaseBlocks(purchaseDef) : false;
  const shown = useMemo(() => (def ? hideUnlinkedBlocks(def) : null), [def]);
  const errors = api.issues.filter((issue) => issue.severity === 'error').length;
  const extensions = api.flowExtensionsEnabled;

  const { undo, redo } = history;
  useEffect(() => {
    // Fuera de un campo de texto, Ctrl/Cmd+Z deshace y Ctrl/Cmd+Shift+Z o Ctrl/Cmd+Y rehace; dentro, manda el campo.
    function onKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || (event.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) { event.preventDefault(); undo(); }
      else if ((key === 'z' && event.shiftKey) || key === 'y') { event.preventDefault(); redo(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);
  const choose = (nodeId: string) => { setSelectedId(nodeId); setPane('paso'); };
  const switcher = <>
    <TemplatesDialog api={api} actions={actions} />
    {hasPurchase ? <>
      <Button variant={view === 'canvas' ? 'secondary' : 'outline'} aria-pressed={view === 'canvas'} onClick={() => setView('canvas')}><Workflow />Recorrido</Button>
      <Button variant={view === 'purchase' ? 'secondary' : 'outline'} aria-pressed={view === 'purchase'} onClick={() => setView('purchase')}><ShoppingCart />Flujo de compra</Button>
    </> : null}
  </>;
  const status = <div className="flex items-center gap-2">
    <div role="group" aria-label="Historial de cambios" className="flex items-center">
      <Button variant="ghost" size="icon" aria-label="Deshacer" title="Deshacer (Ctrl+Z)" disabled={!history.canUndo} onClick={undo}><Undo2 /></Button>
      <Button variant="ghost" size="icon" aria-label="Rehacer" title="Rehacer (Ctrl+Shift+Z)" disabled={!history.canRedo} onClick={redo}><Redo2 /></Button>
    </div>
    <p role="status" className={errors > 0 ? 'text-sm text-danger' : 'text-sm text-muted-foreground'}>
      {errors > 0 ? `${errors} ${errors === 1 ? 'error impide' : 'errores impiden'} publicar` : 'Sin errores: se puede publicar'}
    </p>
  </div>;

  if (!def || !shown || !node) return <BotState api={api} empty>{null}</BotState>;
  if (hasPurchase && purchaseDef && view === 'purchase') {
    return <BotState api={api}><PurchaseStudio def={purchaseDef} actions={actions} updateDraft={history.edit} status={status} switcher={switcher} /></BotState>;
  }

  const wideIssues = flowWideIssues(api.issues);
  const sidebar = <StepSidebar def={shown} purchaseLinked={hasPurchaseBlocks(shown)} issues={api.issues} selectedId={node.id} onSelect={choose} actions={actions} extensionsEnabled={extensions} />;
  const inspector = <StudioInspector def={def} node={node} issues={issuesByNode(api.issues)[node.id] ?? []} actions={actions} tab={pane === 'probar' ? 'probar' : 'paso'} onTab={setPane}
    extensionsEnabled={extensions} onOpenPurchase={() => setView('purchase')} onStep={setActive} />;

  return <BotState api={api}>{wide
    ? <StudioShell sidebar={sidebar} status={status} actions={switcher} inspector={inspector}
      banner={wideIssues.length > 0 ? <div className="max-h-24 overflow-y-auto border-b"><IssueList issues={wideIssues} label="Problemas del recorrido" /></div> : null}>
      <FlowCanvas embedded def={shown} issues={api.issues} selectedId={node.id} onSelect={setSelectedId} actions={actions} activeId={pane === 'probar' ? active : null} />
    </StudioShell>
    : <Tabs value={pane} onValueChange={(value) => setPane(value === 'paso' || value === 'probar' ? value : 'pasos')} className="gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsList variant="pills" aria-label="Paneles del estudio">
          <TabsTrigger value="pasos">Pasos</TabsTrigger><TabsTrigger value="paso">Paso</TabsTrigger><TabsTrigger value="probar">Probar</TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">{switcher}</div>
      </div>
      {status}
      <IssueList issues={wideIssues} label="Problemas del recorrido" />
      <TabsContent value="pasos" className="rounded-xl border bg-card">{sidebar}</TabsContent>
      <TabsContent value="paso"><IssueList issues={issuesByNode(api.issues)[node.id] ?? []} label={`Problemas de ${node.name}`} /><NodeEditor def={def} node={node} actions={actions} showOptions extensionsEnabled={extensions} onOpenPurchase={() => setView('purchase')} /></TabsContent>
      <TabsContent value="probar"><FlowSimulator def={def} /></TabsContent>
    </Tabs>}</BotState>;
}
