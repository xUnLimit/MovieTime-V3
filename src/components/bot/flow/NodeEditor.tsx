'use client';

import { Plus, Trash2, UserRound } from 'lucide-react';
import { ACTION_CATALOG, NODE_LIMITS, canAddHandoffOption, canAddOption } from '@/modules/bot-config';
import { Panel } from '@/components/shared/Panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { BotActionKey, BotDefinition, BotNode, BotNodeKind } from '@/types/bot';
import { KINDS, KIND_LABELS, type FlowActions } from './flow-actions';
import { BlockEditor } from './BlockEditor';
import { ConditionEditor } from './ConditionEditor';
import { EntryButton } from './EntryButton';
import { VariableHints } from './VariableHints';
import { OptionRow, SELECT_CLASS } from './OptionRow';
import { PurchaseActionHint } from './PurchaseActionHint';

type NodeEditorProps = {
  def: BotDefinition;
  node: BotNode;
  actions: FlowActions;
  /** En la vista de lista las opciones se editan aqui; en el lienzo se editan dentro del propio nodo. */
  showOptions: boolean;
  /** Bandera del servidor: permite usar datos del pedido en los textos. */
  extensionsEnabled?: boolean;
};

/** Propiedades del nodo seleccionado. Es tambien la ruta de teclado y celular para todo lo que hace el lienzo. */
export function NodeEditor({ def, node, actions, showOptions, extensionsEnabled = false }: NodeEditorProps) {
  const targets = def.nodes.map((item) => ({ id: item.id, name: item.name, exit: item.block === undefined }));
  if (node.block) return <BlockEditor node={node} targets={targets} exits={targets.filter((item) => item.exit)} actions={actions} />;
  if (node.condition) return <ConditionEditor node={node} targets={targets} isEntry={node.id === def.entryNodeId} actions={actions} />;
  const noun = node.kind === 'list' ? 'fila' : 'botón';
  return <Panel title={`Editar: ${node.name}`} actions={<>
    <EntryButton node={node} isEntry={node.id === def.entryNodeId} actions={actions} />
    <Button variant="destructive" disabled={node.id === def.entryNodeId} onClick={() => actions.removeNode(node.id)}><Trash2 />Eliminar nodo</Button></>}>
    <div className="space-y-3">
      <label className="block text-sm font-medium">Nombre
        <Input value={node.name} onChange={(event) => actions.updateNode(node.id, { name: event.target.value })} /></label>
      <label className="block text-sm font-medium">Tipo
        <select className={SELECT_CLASS} value={node.kind} onChange={(event) => actions.updateNode(node.id, { kind: event.target.value as BotNodeKind })}>
          {KINDS.map((kind) => <option key={kind} value={kind}>{KIND_LABELS[kind]}</option>)}</select></label>
      {node.kind === 'action'
        ? <label className="block text-sm font-medium">Acción
          <select className={SELECT_CLASS} value={node.action ?? ''} onChange={(event) => actions.updateNode(node.id, { action: event.target.value as BotActionKey })}>
            <option value="">Seleccionar acción</option>
            {Object.entries(ACTION_CATALOG).map(([key, action]) => <option key={key} value={key}>{action.label}</option>)}</select></label>
        : <label className="block text-sm font-medium">Texto
          <Textarea maxLength={NODE_LIMITS.bodyMax} value={node.body} onChange={(event) => actions.updateNode(node.id, { body: event.target.value })} />
          <span className="text-xs font-normal text-muted-foreground">{node.body.length}/{NODE_LIMITS.bodyMax}</span></label>}
      {node.kind === 'action' ? <PurchaseActionHint def={def} action={node.action} actions={actions} /> : null}
      {extensionsEnabled && node.kind !== 'action' ? <VariableHints body={node.body} onInsert={(marker) => actions.updateNode(node.id, { body: `${node.body}${marker}` })} /> : null}
      {node.kind === 'list' ? <label className="block text-sm font-medium">Texto del botón de lista
        <Input maxLength={NODE_LIMITS.listButtonMax} value={node.listButtonLabel ?? ''} onChange={(event) => actions.updateNode(node.id, { listButtonLabel: event.target.value })} />
        <span className="text-xs font-normal text-muted-foreground">{(node.listButtonLabel ?? '').length}/{NODE_LIMITS.listButtonMax}</span></label> : null}
      {node.kind === 'buttons' || node.kind === 'list' ? <Button variant="outline" disabled={!canAddHandoffOption(def, node)} onClick={() => actions.addHandoffOption(node.id)}><UserRound />Agregar salida a una persona</Button> : null}
      {showOptions && (node.kind === 'buttons' || node.kind === 'list') ? <div className="space-y-2">
        <h3 className="text-sm font-semibold">{node.kind === 'list' ? 'Filas' : 'Botones'}</h3>
        <ul aria-label={`Opciones de ${node.name}`} className="rounded-md border">
          {node.options.map((option, index) => <OptionRow key={option.id} node={node} option={option} index={index} targets={targets} actions={actions} />)}
        </ul>
        <Button variant="outline" disabled={!canAddOption(node)} onClick={() => actions.addOption(node.id)}><Plus />Agregar {noun}</Button>
      </div> : null}
    </div>
  </Panel>;
}
