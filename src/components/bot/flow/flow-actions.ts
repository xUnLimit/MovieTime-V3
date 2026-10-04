import { useMemo } from 'react';
import { toast } from 'sonner';
import { fetchCommerceCopyUseCase } from '@/application/use-cases/commerce-copy-use-cases';
import {
  addConditionNode, addHandoffOption, addNode, addOption, addPurchaseFlow, applyFlowTemplate, connectOption, moveNode, moveOption, removeNode, removeOption, removePurchaseFlow,
  setBlockCopy, updateNode, updateOption,
} from '@/modules/bot-config';
import type { FlowTemplateId } from '@/modules/bot-config';
import type { BotAdminApi, BotConditionType, BotDefinition, BotNode, BotNodeKind, BotOption } from '@/types/bot';

export const KIND_LABELS: Record<BotNodeKind, string> = {
  buttons: 'Botones', list: 'Lista', text: 'Texto', action: 'Acción',
};
export const KINDS = Object.keys(KIND_LABELS) as BotNodeKind[];

/** `exit`: nodo del recorrido (no un bloque de compra), que puede ser la salida de "cancelar". */
export type FlowTarget = { id: string; name: string; exit?: boolean };
type OptionPatch = Partial<Pick<BotOption, 'title' | 'description' | 'next'>>;

/** Cada accion delega en una funcion pura de `bot-config/edit.ts`; la UI no repite reglas. */
export type FlowActions = {
  addNode: (kind: BotNodeKind) => void;
  removeNode: (nodeId: string) => void;
  updateNode: (nodeId: string, patch: Partial<Omit<BotNode, 'id'>>) => void;
  moveNode: (from: number, to: number) => void;
  addOption: (nodeId: string) => void;
  removeOption: (nodeId: string, optionId: string) => void;
  moveOption: (nodeId: string, from: number, to: number) => void;
  updateOption: (nodeId: string, optionId: string, patch: OptionPatch) => void;
  connect: (nodeId: string, optionId: string, targetId: string) => void;
  /** Bloques de compra: se agregan juntos (con los textos editados hoy) y se quitan juntos. */
  addPurchaseFlow: () => Promise<void>;
  removePurchaseFlow: () => void;
  setBlockCopy: (nodeId: string, key: string, text: string | null) => void;
  /** Salida «Hablar con alguien» desde cualquier nodo de botones o lista hacia el pase a una persona. */
  addHandoffOption: (nodeId: string) => void;
  addCondition: (type: BotConditionType) => void;
  /** Reemplaza el borrador por una plantilla; la de compras siembra los textos editados hoy. */
  applyTemplate: (id: FlowTemplateId) => Promise<void>;
};

export function useFlowActions(api: BotAdminApi, select: (nodeId: string | null) => void): FlowActions {
  const { updateDraft, draft } = api;
  return useMemo(() => {
    const edit = (change: (def: BotDefinition) => BotDefinition) => updateDraft(change);
    return {
      addNode: (kind) => {
        if (!draft) return;
        const next = addNode(draft, kind, '');
        if (next === draft) return;
        edit(() => next);
        select(next.nodes[next.nodes.length - 1].id);
      },
      removeNode: (nodeId) => { edit((def) => removeNode(def, nodeId)); select(null); },
      updateNode: (nodeId, patch) => edit((def) => updateNode(def, nodeId, patch)),
      moveNode: (from, to) => edit((def) => moveNode(def, from, to)),
      addOption: (nodeId) => edit((def) => addOption(def, nodeId)),
      removeOption: (nodeId, optionId) => edit((def) => removeOption(def, nodeId, optionId)),
      moveOption: (nodeId, from, to) => edit((def) => moveOption(def, nodeId, from, to)),
      updateOption: (nodeId, optionId, patch) => edit((def) => updateOption(def, nodeId, optionId, patch)),
      connect: (nodeId, optionId, targetId) => edit((def) => connectOption(def, nodeId, optionId, targetId)),
      addPurchaseFlow: async () => {
        // Se siembra con los textos que el bot usa hoy: si no se pueden leer, no se agrega para no perder ediciones.
        let overrides: Record<string, string>;
        try {
          overrides = (await fetchCommerceCopyUseCase()).overrides;
        } catch {
          toast.error('No se pudieron leer los textos actuales de compras. Intenta de nuevo.');
          return;
        }
        edit((def) => addPurchaseFlow(def, overrides));
      },
      removePurchaseFlow: () => { edit((def) => removePurchaseFlow(def)); select(null); },
      setBlockCopy: (nodeId, key, text) => edit((def) => setBlockCopy(def, nodeId, key, text)),
      addHandoffOption: (nodeId) => edit((def) => addHandoffOption(def, nodeId)),
      addCondition: (type) => {
        if (!draft) return;
        const next = addConditionNode(draft, type);
        if (next === draft) return;
        edit(() => next);
        select(next.nodes[next.nodes.length - 1].id);
      },
      applyTemplate: async (id) => {
        let overrides: Record<string, string> = {};
        if (id === 'base_compras') {
          try {
            overrides = (await fetchCommerceCopyUseCase()).overrides;
          } catch {
            toast.error('No se pudieron leer los textos actuales de compras. Intenta de nuevo.');
            return;
          }
        }
        edit(() => applyFlowTemplate(id, overrides));
        select(null);
      },
    };
  }, [updateDraft, draft, select]);
}
