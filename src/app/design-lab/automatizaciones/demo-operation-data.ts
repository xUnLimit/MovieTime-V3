import type { AutomationControl } from '@/types/automation-control';
import type { Pedido } from '@/modules/orders/contracts';

export const demoControl: AutomationControl = {
  operations: { pendingMessages: 4, reviewMessages: 1, oldestPendingAt: '2026-10-03T12:00:00Z', retryAttempts: 2, averageResolutionSeconds: 48, pendingDeliveries: 5, reviewDeliveries: 1, ordersToday: 14, completedToday: 6, aiCallsToday: 9, aiReservedTokensToday: 2100 },
  settings: { aiMode: 'suggestions', model: 'modelo-de-ejemplo', dailyCalls: 100, dailyTokens: 100000, reservationMinutes: 15, maxReservations: 1, integrationsEnabled: false },
  health: { aiConfigured: true, integrationConfigured: false },
  providers: [{ id: 'netflix', name: 'Netflix', loginCode: true, travelCode: true, verified: true }],
  interests: Array.from({ length: 14 }, (_, index) => ({ id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`, contactSuffix: String(2000 + index), category: index % 2 ? 'Disney+' : 'Netflix', plan: 'Perfil mensual', consent: index % 3 !== 0, paused: index % 5 === 0, state: 'waiting', createdAt: '2026-10-03T12:00:00Z' })),
  access: [{ serviceId: '00000000-0000-4000-8000-000000000003', mode: 'password', provider: 'netflix', rotationConfirmedAt: null }],
};

export const demoOrders: Pedido[] = Array.from({ length: 14 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`, terceroId: null, contactId: null, moneda: 'USD', total: 12,
  estado: 'confirmado', paymentState: index === 4 ? 'exceso' : index % 3 ? 'cubierto' : 'parcial', deliveryState: index % 2 ? 'asignado' : 'pendiente', receivedAmount: index === 4 ? 14 : index % 3 ? 12 : 8, missingAmount: index % 3 ? 0 : 4, excessAmount: index === 4 ? 2 : 0, allocatedAmount: index % 2 ? 12 : 0, refundedAmount: 0, unallocatedAmount: index % 2 ? 0 : index % 3 ? 12 : 8, expiraAt: index === 0 ? '2000-10-03T13:00:00Z' : '2100-10-03T13:00:00Z',
  items: ['Netflix', 'Disney+'].map((planNombre, itemIndex) => ({ id: `00000000-0000-4000-8000-${String(index * 2 + itemIndex + 200).padStart(12, '0')}`, tipo: 'nueva', servicioId: '00000000-0000-4000-8000-000000000003', ventaId: null, planNombre, total: 6, estado: index % 2 ? 'aplicado' : 'pendiente', ventaIdResultante: index % 2 ? '00000000-0000-4000-8000-000000000009' : null })),
}));
