'use client';

import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BotActionKey } from '@/types/bot';

const COMMERCE_ACTIONS: ReadonlySet<BotActionKey> = new Set<BotActionKey>(['purchase', 'renewal', 'my_services']);

/** Las acciones de compra no llevan texto propio: lo que el cliente lee en cada paso se edita en el flujo de compra, que siempre está disponible. */
export function PurchaseActionHint({ action, onOpenPurchase }: { action: BotActionKey | undefined; onOpenPurchase?: () => void }) {
  if (!action || !COMMERCE_ACTIONS.has(action)) return null;
  return <div role="note" className="space-y-2 rounded-md border bg-muted p-3 text-sm">
    <p>Esta acción no tiene texto propio: lo que el cliente lee en cada paso (catálogo, carrito, pago…) se edita en el flujo de compra.</p>
    {onOpenPurchase ? <Button variant="outline" onClick={onOpenPurchase}><ShoppingCart />Editar textos de compra</Button> : null}
  </div>;
}
