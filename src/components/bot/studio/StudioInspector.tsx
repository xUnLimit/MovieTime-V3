'use client';

import { PanelInset } from '@/components/shared/Panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { BotDefinition, BotIssue, BotNode } from '@/types/bot';
import type { FlowActions } from '../flow/flow-actions';
import { FlowSimulator } from '../flow/FlowSimulator';
import { IssueList } from '../flow/IssueList';
import { NodeEditor } from '../flow/NodeEditor';

type InspectorTab = 'paso' | 'probar';

type StudioInspectorProps = {
  def: BotDefinition;
  node: BotNode;
  /** Problemas de validación de este paso: se dicen aquí, donde se corrigen. */
  issues: readonly BotIssue[];
  actions: FlowActions;
  tab: InspectorTab;
  onTab: (tab: InspectorTab) => void;
  extensionsEnabled: boolean;
  onOpenPurchase: () => void;
  onStep: (nodeId: string | null) => void;
};

/** Columna derecha del estudio: editar el paso elegido o probar el recorrido en el teléfono, sin salir del lienzo. */
export function StudioInspector({ def, node, issues, actions, tab, onTab, extensionsEnabled, onOpenPurchase, onStep }: StudioInspectorProps) {
  return <Tabs value={tab} onValueChange={(value) => onTab(value === 'probar' ? 'probar' : 'paso')} className="min-h-0 flex-1 gap-0">
    <div className="border-b p-3">
      <TabsList variant="pills" aria-label="Inspector del recorrido">
        <TabsTrigger value="paso">Paso</TabsTrigger>
        <TabsTrigger value="probar">Probar</TabsTrigger>
      </TabsList>
    </div>
    <PanelInset>
      <TabsContent value="paso" className="min-h-0 overflow-y-auto">
        <IssueList issues={issues} label={`Problemas de ${node.name}`} />
        <NodeEditor def={def} node={node} actions={actions} showOptions extensionsEnabled={extensionsEnabled} onOpenPurchase={onOpenPurchase} />
      </TabsContent>
      <TabsContent value="probar" className="min-h-0 overflow-y-auto">
        <FlowSimulator def={def} onStep={onStep} />
      </TabsContent>
    </PanelInset>
  </Tabs>;
}
