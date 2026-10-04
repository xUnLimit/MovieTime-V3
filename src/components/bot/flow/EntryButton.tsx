'use client';

import { LogIn } from 'lucide-react';
import { canSetEntry } from '@/modules/bot-config';
import { Button } from '@/components/ui/button';
import type { BotNode } from '@/types/bot';
import type { FlowActions } from './flow-actions';

type EntryButtonProps = { node: BotNode; isEntry: boolean; actions: FlowActions; className?: string };

/** «Usar como entrada»: solo en los nodos que el cliente puede recibir como primer paso (no bloques de compra ni acciones). */
export function EntryButton({ node, isEntry, actions, className }: EntryButtonProps) {
  if (isEntry || !canSetEntry(node)) return null;
  return <Button type="button" size="sm" variant="outline" className={className} aria-label={`Usar como entrada: ${node.name}`}
    onClick={() => actions.setEntry(node.id)}><LogIn />Usar como entrada</Button>;
}
