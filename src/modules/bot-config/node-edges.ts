import type { BotNode } from '@/types/bot';
export function nodeEdges(node: BotNode): { next: string; title: string }[] {
  if (node.kind === 'input' && node.input) return [{ next: node.input.next, title: 'Respuesta válida' }];
  if (node.kind === 'condition' && node.condition) return [
    { next: node.condition.yes, title: 'Sí' }, { next: node.condition.no, title: 'No' },
  ];
  return node.options;
}
