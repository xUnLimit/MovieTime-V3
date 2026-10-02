import type { ReceiptReader } from '@/modules/payments-reconciliation';
import { createLogger } from '@/platform/observability/logger';
import type { ClaimResult, PedidoPaymentRepository } from '@/platform/supabase/pedido-payment-repository';
import { assertUuid } from '@/platform/utils/safety';

const logger = createLogger('PedidoPayment');
const RETRY_BATCH = 50;

export type ReceiptRejectReason = 'sin_codigo' | 'codigo_usado' | 'pedido_invalido' | 'intentos_excedidos';
export type ReceiptReviewReason = 'monto_menor' | 'entrega_pendiente' | 'fuera_de_ventana';

// Resultado que el bot traduce a mensajes. Nunca contiene el codigo ni telefonos.
export type SubmitReceiptResult =
  | { estado: 'confirmado'; sobrepago: boolean }
  | { estado: 'esperando_correo' }
  | { estado: 'en_revision'; motivo: ReceiptReviewReason; faltante: number }
  | { estado: 'rechazado'; motivo: ReceiptRejectReason };

export type PedidoPaymentDeps = {
  repository: PedidoPaymentRepository;
  reader: ReceiptReader;
  newKey(): string;
};

export type SubmitReceiptInput = {
  pedidoId: string; waId: string; imageMediaId?: string | null; typedCode?: string | null; idempotencyKey?: string;
};

/** Traduce el resultado del RPC. La entrega se hizo dentro del RPC; aqui solo se clasifica. */
export function mapClaimResult(claim: ClaimResult): SubmitReceiptResult {
  switch (claim.outcome) {
    case 'confirmado':
    case 'monto_mayor':
      return claim.confirmed
        ? { estado: 'confirmado', sobrepago: claim.outcome === 'monto_mayor' }
        : { estado: 'en_revision', motivo: 'entrega_pendiente', faltante: 0 };
    case 'monto_menor': return { estado: 'en_revision', motivo: 'monto_menor', faltante: claim.remaining };
    case 'fuera_de_ventana': return { estado: 'en_revision', motivo: 'fuera_de_ventana', faltante: claim.remaining };
    case 'no_encontrado': return { estado: 'esperando_correo' };
    case 'codigo_usado': return { estado: 'rechazado', motivo: 'codigo_usado' };
    case 'intentos_excedidos': return { estado: 'rechazado', motivo: 'intentos_excedidos' };
    case 'pedido_invalido': return { estado: 'rechazado', motivo: 'pedido_invalido' };
  }
}

/**
 * Procesa el comprobante de un cliente. Solo el correo de Yappy (fila en yappy_payments) confirma el pago:
 * la imagen o el texto solo aportan el codigo. El RPC aplica el cobro y entrega el pedido de forma atomica,
 * por eso no se llama despues a confirmar_pedido (que exige un usuario autenticado y duplicaria el cobro).
 */
export async function submitReceipt(deps: PedidoPaymentDeps, input: SubmitReceiptInput): Promise<SubmitReceiptResult> {
  const pedidoId = assertUuid(input.pedidoId, 'pedido');
  const reading = await deps.reader.read({ typedCode: input.typedCode, imageMediaId: input.imageMediaId });
  if (!reading.code) return { estado: 'rechazado', motivo: 'sin_codigo' };
  const claim = await deps.repository.claim({
    pedidoId, code: reading.code, waId: input.waId, idempotencyKey: input.idempotencyKey ?? deps.newKey(), retry: false,
  });
  return mapClaimResult(claim);
}

export type ResolvedReceipt = { pedidoId: string; waId: string | null; result: SubmitReceiptResult };

/**
 * Reintenta los comprobantes que esperaban el correo. Se ejecuta tras cada sincronizacion de Yappy; no cuenta
 * contra el limite de intentos. Devuelve solo los que cambiaron de estado para que el bot avise al cliente.
 */
export async function retryPendingReceipts(
  deps: Pick<PedidoPaymentDeps, 'repository' | 'newKey'>,
  onResolved?: (resolved: ResolvedReceipt) => Promise<void>,
): Promise<ResolvedReceipt[]> {
  const pending = await deps.repository.listPending(RETRY_BATCH);
  const resolved: ResolvedReceipt[] = [];
  for (const item of pending) {
    try {
      const claim = await deps.repository.claim({
        pedidoId: item.pedidoId, code: item.code, waId: item.waId, idempotencyKey: deps.newKey(), retry: true,
      });
      const result = mapClaimResult(claim);
      if (result.estado === 'esperando_correo') continue;
      const entry = { pedidoId: item.pedidoId, waId: item.waId, result };
      resolved.push(entry);
      if (onResolved) await onResolved(entry);
    } catch {
      // Sin codigo ni telefono en el log; el comprobante sigue pendiente para la proxima sincronizacion.
      logger.warn('Pending receipt retry failed', { errorCode: 'receipt_retry_failed' });
    }
  }
  return resolved;
}
