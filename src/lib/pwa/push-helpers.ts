import type { ExecutivePushBlock, ExecutivePushSummaryBlock, ExecutivePushSummaryPayload } from '@/types';
import { EXECUTIVE_PUSH_BLOCKS } from './push-constants';

export function getExecutivePushBlockMeta(block: ExecutivePushBlock) {
  return EXECUTIVE_PUSH_BLOCKS.find((item) => item.key === block);
}

export function buildExecutivePushDestination(blocks: ExecutivePushSummaryBlock[]): { destination: string; tab?: string } {
  const primary = blocks[0];
  return {
    destination: primary?.destination ?? '/dashboard',
    tab: primary?.tab,
  };
}

export function buildExecutivePushBody(blocks: ExecutivePushSummaryBlock[]): string {
  return blocks
    .map((block) => {
      if (block.amount !== undefined) {
        return `${block.label}: ${block.amount.toFixed(2)} ${block.currency ?? 'USD'}`;
      }
      return `${block.label}: ${block.count ?? 0}`;
    })
    .join(' | ');
}

export function buildExecutivePushSummaryPayload(
  blocks: ExecutivePushSummaryBlock[]
): ExecutivePushSummaryPayload {
  const { destination, tab } = buildExecutivePushDestination(blocks);
  return {
    kind: 'executive_daily_summary',
    title: 'Resumen operativo del dia',
    body: buildExecutivePushBody(blocks),
    destination,
    tab,
    blocks,
    generatedAt: new Date().toISOString(),
  };
}
