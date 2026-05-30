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

function formatBlock(block: ExecutivePushSummaryBlock): string {
  if (block.amounts !== undefined) {
    return `${block.label}: ${formatAmounts(block.amounts)}`;
  }
  return `${block.label}: ${block.count ?? 0}`;
}

export function buildExecutivePushBody(blocks: ExecutivePushSummaryBlock[]): string {
  const clientesBlock = blocks.find((b) => b.key === 'clientes_por_notificar');
  const serviciosBlock = blocks.find((b) => b.key === 'servicios_por_pagar');
  const montoBlock = blocks.find((b) => b.key === 'monto_a_fondear');
  const reposoBlock = blocks.find((b) => b.key === 'reposo_terminado');

  const lines: string[] = [];

  const clientesServiciosParts = [clientesBlock, serviciosBlock]
    .filter(Boolean)
    .map((b) => formatBlock(b!));
  if (clientesServiciosParts.length > 0) {
    lines.push(clientesServiciosParts.join(' | '));
  }

  const montoReposoParts = [montoBlock, reposoBlock]
    .filter(Boolean)
    .map((b) => formatBlock(b!));
  if (montoReposoParts.length > 0) {
    lines.push(montoReposoParts.join(' | '));
  }

  // Fallback for any blocks not covered by the two groups above
  const handledKeys = new Set(['clientes_por_notificar', 'servicios_por_pagar', 'monto_a_fondear', 'reposo_terminado']);
  const extra = blocks.filter((b) => !handledKeys.has(b.key)).map(formatBlock);
  lines.push(...extra);

  return lines.join('\n');
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
