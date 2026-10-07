'use client';

import type { QueryClient } from '@tanstack/react-query';

import PedidosCobrosPage from '@/app/(dashboard)/pedidos-cobros/page';
import PlantillasMensajesPage from '@/app/(dashboard)/plantillas-mensajes/page';
import { ConfiguracionView } from '@/components/configuracion/ConfiguracionView';
import { ServiceAccessPanel } from '@/components/servicios/ServiceAccessPanel';
import { demoControl, demoOrders } from '../automatizaciones/demo-operation-data';
import type { YappyPayment } from '@/application/use-cases/yappy-use-cases';
import { queryKeys } from '@/platform/query-keys';

import { ShellPreview } from '../shell/ShellPreview';
import { ReportsView } from '@/components/customer-reports/ReportsView';
import { ChatTimelinePreview } from './ChatTimelinePreview';

const STATUSES = ['match_unico', 'ambiguo', 'sin_match', 'registrado', 'descartado'] as const;

function demoPayments(): YappyPayment[] {
  return Array.from({ length: 14 }, (_, i) => ({
    id: `00000000-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`,
    confirmationCode: `GZCSS-2061${3000 + i}`,
    amount: 4 + (i % 5),
    payerNameShort: `Cliente ${i + 1}`,
    payerPhoneLast4: '0268',
    paidAt: new Date(Date.now() - i * 3_600_000).toISOString(),
    matchStatus: STATUSES[i % STATUSES.length],
    candidateVentaIds: [],
    matchedVentaId: null,
  }));
}

function seed(queryClient: QueryClient) {
  for (const status of ['open', 'in_progress', 'resolved'] as const) {
    for (const page of [1, 2]) {
      const reports = Array.from({ length: page === 1 ? 10 : 4 }, (_, i) => ({
        id: `00000000-0000-4000-8000-${String((page - 1) * 10 + i).padStart(12, '0')}`, wa_id: `507600000${String(i).padStart(2, '0')}`,
        source_message_id: `demo-report-${page}-${i}`, description: `El servicio muestra un error al entrar.\n\nEmpezó ayer por la tarde.\n\nYa probé reiniciar el dispositivo. Caso ${(page - 1) * 10 + i + 1}.`,
        status, version: 0, created_at: '2026-10-06T15:00:00.000Z', updated_at: '2026-10-06T15:00:00.000Z',
      }));
      queryClient.setQueryData(['customer-reports', { status, page }], { reports, total: 14 });
    }
  }
  queryClient.setQueryDefaults(['customer-reports'], { staleTime: Infinity, refetchInterval: false });
  queryClient.setQueryData(['automation-control'], demoControl);
  queryClient.setQueryData(['pedidos'], demoOrders);
  queryClient.setQueryDefaults(['automation-control'], { staleTime: Infinity, refetchInterval: false });
  queryClient.setQueryDefaults(['pedidos'], { staleTime: Infinity, refetchInterval: false });
  queryClient.setQueryData(['yappy', 'payments'], demoPayments());
  queryClient.setQueryData(['yappy', 'connections'], [
    { mailbox: 'owner@gmail.com', status: 'configurado', lastSyncedAt: new Date().toISOString(), lastErrorCode: null },
  ]);
  queryClient.setQueryData(queryKeys.templates.list(), []);
  queryClient.setQueryData(queryKeys.whatsapp.metaTemplates(), []);
}

/** `?p=`: pedidos-cobros (y su `?tab=`), plantillas, configuracion o acceso. Por defecto, Pedidos y cobros. */
export function PaginasPreview() {
  const which = typeof window === 'undefined' ? 'pedidos-cobros' : new URLSearchParams(window.location.search).get('p') ?? 'pedidos-cobros';
  return <ShellPreview seed={seed}>{which === 'chats' ? <ChatTimelinePreview /> : which === 'reportes' ? <ReportsView /> : which === 'plantillas' ? <PlantillasMensajesPage /> : which === 'configuracion' ? <ConfiguracionView /> : which === 'acceso' ? <ServiceAccessPanel serviceId="00000000-0000-4000-8000-000000000003" clients={4} /> : <PedidosCobrosPage />}</ShellPreview>;
}
