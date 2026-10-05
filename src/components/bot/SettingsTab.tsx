'use client';

import Link from 'next/link';
import { Panel } from '@/components/shared/Panel';
import { Button } from '@/components/ui/button';
import type { BotAdminApi } from '@/types/bot';
import { BotChecks } from './BotChecks';
import { RulesTab } from './RulesTab';

/** Ajustes del bot: tiempos, palabras clave y comprobaciones; las reglas de compra viven en Configuración. */
export function SettingsTab({ api }: { api: BotAdminApi }) {
  return <div className="space-y-4">
    <RulesTab api={api} />
    <BotChecks api={api} />
    <Panel title="Compras por WhatsApp" description="Permitir compras nuevas, minutos de reserva y reservas máximas por contacto se configuran en Configuración.">
      <Button variant="outline" asChild><Link href="/configuracion">Ir a Configuración</Link></Button>
    </Panel>
  </div>;
}
