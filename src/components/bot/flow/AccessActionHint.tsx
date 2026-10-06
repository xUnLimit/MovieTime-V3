'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BotActionKey } from '@/types/bot';

/**
 * «Enviar mis datos de acceso» usa una plantilla independiente, editable en Plantillas de mensajes.
 */
export function AccessActionHint({ action }: { action: BotActionKey | undefined }) {
  if (action !== 'service_access') return null;
  return <div role="note" className="space-y-2 rounded-md border bg-muted p-3 text-sm">
    <p>El cliente recibe los datos de su servicio con la plantilla «Datos de acceso solicitados», solo de sus servicios activos. Con varios servicios, primero elige de cuál.</p>
    <p className="text-xs text-muted-foreground">Los textos de «sin servicios», de la lista y de los servicios que entran con código se editan en Respuestas.</p>
    <Button variant="outline" asChild><Link href="/plantillas-mensajes?tipo=datos_acceso">Editar la plantilla<ExternalLink /></Link></Button>
  </div>;
}
