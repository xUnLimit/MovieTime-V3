import { createServiceRoleClient } from '@/platform/server/supabase-server';
import { assertRpcStringId, assertUuid } from '@/platform/utils/safety';
import { z } from '@/platform/validation/zod';
import { listCatalogoServerUseCase, listServiciosServerUseCase, createCompraServerUseCase,
  createRenovacionServerUseCase, getPedidoServerUseCase, reconcilePedidoServerUseCase,
  cancelPedidoServerUseCase } from './pedidos-server-use-cases';
import type { CommerceConversationDeps } from './commerce-conversation-use-case';
import { createAutomationControlStore } from '@/modules/automation-control/store';
import { createCommerceCopyStore } from '@/modules/commerce-copy/store';

export function createCommerceConversationDeps(): CommerceConversationDeps {
  return {
    purchasesEnabled: async () => (await createAutomationControlStore().settings()).purchasesEnabled === true,
    copyOverrides: () => createCommerceCopyStore().overrides(),
    catalogue: listCatalogoServerUseCase, services: listServiciosServerUseCase,
    buy: createCompraServerUseCase, renew: createRenovacionServerUseCase,
    order: getPedidoServerUseCase, reconcile: reconcilePedidoServerUseCase,
    cancelOrder: async (waId, id, key) => { await cancelPedidoServerUseCase(waId, id, key); },
    paymentInstructions: z.string().trim().min(1).max(600).safeParse(process.env.YAPPY_PAYMENT_INSTRUCTIONS).data ?? null,
    async interest(waId, categoryId, planId, consent) {
      const contact = z.string().regex(/^507\d{8}$/).parse(waId);
      assertUuid(categoryId, 'Categoría'); assertUuid(planId, 'Plan');
      const { data, error } = await createServiceRoleClient().rpc('mt_register_interest', {
        p_contact: contact, p_category_id: categoryId, p_plan_id: planId, p_consent: consent,
      });
      if (error) throw new Error('Interest registration failed');
      assertRpcStringId(data, 'mt_register_interest');
    },
  };
}
