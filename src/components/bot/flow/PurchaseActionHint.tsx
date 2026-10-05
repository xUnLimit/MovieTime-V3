'use client';

import { ShoppingCart } from 'lucide-react';
import { NODE_LIMITS, hasPurchaseBlocks } from '@/modules/bot-config';
import { Button } from '@/components/ui/button';
import type { BotActionKey, BotDefinition } from '@/types/bot';
import type { FlowActions } from './flow-actions';

const COMMERCE_ACTIONS: ReadonlySet<BotActionKey> = new Set<BotActionKey>(['purchase', 'renewal', 'my_services']);

/** Las acciones de compra no llevan texto propio: los mensajes que ve el cliente se editan en los bloques de compra. */
export function PurchaseActionHint({ def, action, actions }: { def: BotDefinition; action: BotActionKey | undefined; actions: FlowActions }) {
  if (!action || !COMMERCE_ACTIONS.has(action)) return null;
  const present = hasPurchaseBlocks(def);
  return <div role="note" className="space-y-2 rounded-md border bg-muted p-3 text-sm">
    <p>Esta acción no tiene texto propio: lo que el cliente lee en cada paso se edita en los bloques de compra de este recorrido (catálogo, carrito, pago…).</p>
    {present ? <p className="text-muted-foreground">Selecciona un bloque de compra en el lienzo o en la lista para cambiar sus textos.</p>
      : <Button variant="outline" disabled={def.nodes.length + 4 > NODE_LIMITS.nodesMax} onClick={() => void actions.addPurchaseFlow()}><ShoppingCart />Agregar flujo de compras</Button>}
  </div>;
}
