'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BotActionKey } from '@/types/bot';

/**
 * «Enviar mis datos de acceso» no lleva texto propio: el cliente recibe lo mismo que al crear su venta, con la plantilla de
 * Suscripción, así que lo que dice (correo, contraseña, perfil…) se edita en Plantillas de mensajes.
 */
export function AccessActionHint({ action }: { action: BotActionKey | undefined }) {
  if (action !== 'service_access') return null;
  return <div role="note" className="space-y-2 rounded-md border bg-muted p-3 text-sm">
    <p>Esta acción no tiene texto propio: el cliente recibe de nuevo los datos de su servicio con la plantilla «Notificación de Suscripción», solo de sus servicios activos. Con varios servicios, primero elige de cuál.</p>
    <p className="text-xs text-muted-foreground">Los textos de «sin servicios», de la lista y de los servicios que entran con código se editan en Respuestas.</p>
    <Button variant="outline" asChild><Link href="/plantillas-mensajes">Editar la plantilla<ExternalLink /></Link></Button>
  </div>;
}
