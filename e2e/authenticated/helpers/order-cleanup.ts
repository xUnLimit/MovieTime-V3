import { execFileSync } from 'node:child_process';
import { assertUuid } from '../../../src/platform/utils/safety';

/** Local fixture teardown only: commercial ledgers intentionally have no Data API delete grant. */
export function cleanupOrderFixtures(terceroId: string, servicioId: string): void {
  const third = assertUuid(terceroId, 'Tercero de prueba'), service = assertUuid(servicioId, 'Servicio de prueba');
  const url = new URL(process.env.E2E_SUPABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) throw new Error('La limpieza requiere Supabase local.');
  const container = process.env.E2E_DATABASE_CONTAINER ?? (process.env.CI ? 'supabase_db_MovieTime-V3' : 'supabase_db_MovieTime-Automation-Verification');
  if (!/^supabase_db_[A-Za-z0-9_-]+$/.test(container)) throw new Error('Contenedor de pruebas inválido.');
  if (!process.env.CI && container !== 'supabase_db_MovieTime-Automation-Verification') throw new Error('La limpieza requiere el sandbox aislado.');
  const sql = `BEGIN;
    DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.terceros WHERE id='${third}')
      OR NOT EXISTS(SELECT 1 FROM public.servicios WHERE id='${service}') THEN RAISE EXCEPTION 'fixture_scope_not_found'; END IF; END $$;
    CREATE TEMP TABLE fixture_order_ids ON COMMIT DROP AS SELECT p.id FROM public.pedidos p
      WHERE p.tercero_id='${third}' AND NOT EXISTS(SELECT 1 FROM public.pedido_items i WHERE i.pedido_id=p.id AND i.servicio_id<>'${service}');
    DELETE FROM public.notificaciones WHERE id IN(SELECT n.notificacion_id FROM public.notificaciones_venta n
      JOIN public.ventas v ON v.id=n.venta_id WHERE v.cliente_id='${third}' AND v.servicio_id='${service}');
    DELETE FROM public.mt_integration_deliveries WHERE event_id IN(SELECT id FROM public.domain_events WHERE aggregate_id IN(SELECT id::text FROM fixture_order_ids));
    DELETE FROM public.domain_events WHERE aggregate_id IN(SELECT id::text FROM fixture_order_ids);
    DELETE FROM public.mt_order_deliveries WHERE pedido_id IN(SELECT id FROM fixture_order_ids);
    DELETE FROM public.pedido_resoluciones WHERE pedido_id IN(SELECT id FROM fixture_order_ids);
    DELETE FROM public.pedido_exceso_resoluciones WHERE pedido_id IN(SELECT id FROM fixture_order_ids);
    DELETE FROM public.pedido_excedentes WHERE pedido_id IN(SELECT id FROM fixture_order_ids);
    DELETE FROM public.intentos_comprobante WHERE pedido_id IN(SELECT id FROM fixture_order_ids);
    DELETE FROM public.pedido_operaciones WHERE result_id IN(SELECT id FROM fixture_order_ids);
    DELETE FROM public.reservas_perfil WHERE servicio_id='${service}';
    DELETE FROM public.pedido_pagos WHERE pedido_id IN(SELECT id FROM fixture_order_ids);
    UPDATE public.yappy_payments SET revision_pedido_id=NULL WHERE revision_pedido_id IN(SELECT id FROM fixture_order_ids);
    DELETE FROM public.pedido_items WHERE pedido_id IN(SELECT id FROM fixture_order_ids);
    DELETE FROM public.pedidos WHERE id IN(SELECT id FROM fixture_order_ids);
    DELETE FROM public.mt_service_access WHERE service_id='${service}';
    COMMIT;`;
  try {
    execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1'],
      { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    throw new Error('No se pudieron limpiar las relaciones del pedido de prueba local.');
  }
}
