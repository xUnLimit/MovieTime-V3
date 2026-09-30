import { triggerYappySync } from '@/platform/supabase/yappy-client';
import { getCurrentSession } from '@/platform/supabase/auth';
import { dismissYappyPayment, listYappyCandidateVentas, listYappyConnections, listYappyPayments, resolveYappyPayment, searchYappyCandidateVentas } from '@/platform/supabase/yappy-repository';

export type { YappyPayment,  YappyCandidateVenta } from '@/platform/supabase/yappy-repository';
export const fetchYappyPayments = listYappyPayments;
export const fetchYappyConnections = listYappyConnections;
export const fetchYappyCandidateVentas = listYappyCandidateVentas;
export const searchYappyVentas = searchYappyCandidateVentas;

export async function syncYappyNowUseCase(): Promise<{ errorCode: string | null }> {
  const session = await getCurrentSession();
  if (!session?.access_token) throw new Error('La sesión expiró. Inicia sesión de nuevo.');
  return triggerYappySync(session.access_token);
}

export async function resolveYappyUseCase(paymentId: string, ventaId: string) {
  await resolveYappyPayment(paymentId, ventaId);
}

export async function dismissYappyUseCase(paymentId: string, note: string) {
  if (!note.trim()) throw new Error('Escribe un motivo para descartar el pago.');
  await dismissYappyPayment(paymentId, note.trim());
}
