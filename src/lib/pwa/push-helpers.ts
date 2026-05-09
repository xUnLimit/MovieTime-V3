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

function formatAmounts(amounts: Record<string, number>): string {
  const entries = Object.entries(amounts).filter(([, value]) => value > 0);
  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, value]) => `${value.toFixed(2)} ${currency}`)
    .join(', ');
}

export function isExecutivePushBlockActive(block: ExecutivePushSummaryBlock): boolean {
  if (block.amounts !== undefined) {
    return Object.values(block.amounts).some((value) => value > 0);
  }
  return (block.count ?? 0) > 0;
}

export function filterExecutivePushActiveBlocks(
  blocks: ExecutivePushSummaryBlock[]
): ExecutivePushSummaryBlock[] {
  return blocks.filter(isExecutivePushBlockActive);
}

export function buildExecutivePushBody(blocks: ExecutivePushSummaryBlock[]): string {
  return blocks
    .map((block) => {
      if (block.amounts !== undefined) {
        return `${block.label}: ${formatAmounts(block.amounts)}`;
      }
      return `${block.label}: ${block.count ?? 0}`;
    })
    .join(' | ');
}

export function buildExecutivePushSummaryPayload(
  blocks: ExecutivePushSummaryBlock[]
): ExecutivePushSummaryPayload {
  const activeBlocks = filterExecutivePushActiveBlocks(blocks);
  const { destination, tab } = buildExecutivePushDestination(activeBlocks);
  return {
    kind: 'executive_daily_summary',
    title: 'Recordatorio',
    body: buildExecutivePushBody(activeBlocks),
    destination,
    tab,
    blocks: activeBlocks,
    generatedAt: new Date().toISOString(),
  };
}
