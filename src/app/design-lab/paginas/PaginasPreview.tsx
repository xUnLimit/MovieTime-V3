'use client';

import type { QueryClient } from '@tanstack/react-query';

import YappyPage from '@/app/(dashboard)/pagos-yappy/page';
import EditorMensajesPage from '@/app/(dashboard)/editor-mensajes/page';
import PedidosPage from '@/app/(dashboard)/ventas/pedidos/page';
import InteresadosPage from '@/app/(dashboard)/terceros/interesados/page';
import AutomationConfigurationPage from '@/app/(dashboard)/configuracion/automatizacion/page';
import { ServiceAccessPanel } from '@/components/servicios/ServiceAccessPanel';
import { demoControl, demoOrders } from '../automatizaciones/demo-operation-data';
import type { YappyPayment } from '@/application/use-cases/yappy-use-cases';
import { queryKeys } from '@/platform/query-keys';

import { ShellPreview } from '../shell/ShellPreview';

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

export function PaginasPreview() {
  const which = typeof window === 'undefined' ? 'yappy' : new URLSearchParams(window.location.search).get('p') ?? 'yappy';
  return <ShellPreview seed={seed}>{which === 'mensajes' ? <EditorMensajesPage /> : which === 'pedidos' ? <PedidosPage /> : which === 'interesados' ? <InteresadosPage /> : which === 'configuracion' ? <AutomationConfigurationPage /> : which === 'acceso' ? <ServiceAccessPanel serviceId="00000000-0000-4000-8000-000000000003" clients={4} /> : <YappyPage />}</ShellPreview>;
}
