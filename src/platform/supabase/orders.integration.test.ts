import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServiceClient } from '@/test/integration/clients';
import { requireIntegrationEnv, integrationEnv } from '@/test/integration/env';
import { unwrap, uniqueWaId } from '@/test/integration/fixtures';
import { assertUuid } from '@/platform/utils/safety';

// PostgreSQL fixture setup/cleanup uses the local container. Production RPC grants are not
// widened to let a fixture delete the commercial ledger through the Data API.
describe.skipIf(requireIntegrationEnv() === null)('integracion: reservas comerciales concurrentes', () => {
  const category = randomUUID(), type = randomUUID(), plan = randomUUID(), service = randomUUID();
  const contacts = [uniqueWaId(), uniqueWaId()];
  const container = process.env.INTEGRATION_DATABASE_CONTAINER ?? 'supabase_db_MovieTime-V3';
  const orders: { id: string; wa: string }[] = [];
  let purchasesWereEnabled = false;
  const sql = (statement: string) => {
    if (!/^supabase_db_[A-Za-z0-9_-]+$/.test(container)) throw new Error('Contenedor de pruebas inválido.');
    if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(new URL(integrationEnv().url).hostname)) {
      throw new Error('Las pruebas comerciales requieren Supabase local.');
    }
    return execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'],
      { input: statement, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  };
  const create = (wa: string, key: string) => createServiceClient().rpc('mt_create_commerce_order', {
    p_wa_id: wa, p_ids: [plan], p_kind: 'compra', p_idempotency_key: key, p_expected_total: 10,
  });
  beforeAll(() => {
    purchasesWereEnabled = sql("SELECT coalesce((settings->>'purchasesEnabled')::boolean,false) FROM public.mt_automation_settings WHERE id;").trim() === 't';
    sql(`BEGIN;
      UPDATE public.mt_automation_settings SET settings=jsonb_set(settings,'{purchasesEnabled}','true');
      INSERT INTO public.categorias(id,nombre,tipo) VALUES('${category}','Concurrency fixture','cliente');
      INSERT INTO public.planes_tipos(id,categoria_id,nombre) VALUES('${type}','${category}','Individual');
      INSERT INTO public.planes(id,categoria_id,plan_tipo_id,nombre,ciclo_pago,precio)
        VALUES('${plan}','${category}','${type}','Mensual','mensual',10);
      INSERT INTO public.servicios(id,categoria_id,plan_tipo_id,nombre,correo,contrasena,perfiles_disponibles)
        VALUES('${service}','${category}','${type}','Concurrency fixture','fixture@example.test','fixture-only',1);
      INSERT INTO public.whatsapp_contacts(wa_id,estado) VALUES('${contacts[0]}','lead'),('${contacts[1]}','lead');
      COMMIT;`);
  });
  afterAll(() => {
    sql(`BEGIN;
      UPDATE public.mt_automation_settings SET settings=jsonb_set(settings,'{purchasesEnabled}','${purchasesWereEnabled}');
      DELETE FROM public.domain_events WHERE aggregate_id IN (SELECT id::text FROM public.pedidos WHERE contact_id IN ('${contacts[0]}','${contacts[1]}'));
      DELETE FROM public.reservas_perfil WHERE servicio_id='${service}';
      DELETE FROM public.pedido_operaciones WHERE result_id IN (SELECT id FROM public.pedidos WHERE contact_id IN ('${contacts[0]}','${contacts[1]}'));
      DELETE FROM public.pedido_items WHERE servicio_id='${service}';
      DELETE FROM public.pedidos WHERE contact_id IN ('${contacts[0]}','${contacts[1]}');
      DELETE FROM public.whatsapp_contacts WHERE wa_id IN ('${contacts[0]}','${contacts[1]}');
      DELETE FROM public.servicios WHERE id='${service}';
      DELETE FROM public.planes WHERE id='${plan}';
      DELETE FROM public.planes_tipos WHERE id='${type}';
      DELETE FROM public.categorias WHERE id='${category}';
      COMMIT;`);
  });
  it('two simultaneous buyers of the last profile get one reservation and one controlled rejection', async () => {
    const results = await Promise.all(contacts.map(wa => create(wa, randomUUID())));
    expect(results.filter(result => result.error === null)).toHaveLength(1);
    const failure = results.find(result => result.error !== null);
    expect(failure?.error?.message).toContain('pedido_no_stock');
    const index = results.findIndex(result => result.error === null);
    orders.push({ id: unwrap<string>(results[index], 'winning reservation'), wa: contacts[index] });
    expect(sql(`SELECT count(*) FROM public.reservas_perfil WHERE servicio_id='${service}' AND cerrada_at IS NULL;`).trim()).toBe('1');
    unwrap(await createServiceClient().rpc('mt_order_command', {
      p_order_id: orders[0].id, p_action: 'cancel', p_idempotency_key: randomUUID(), p_wa_id: orders[0].wa,
    }), 'release winning reservation');
  });
  it('parallel retries of one intent return the same order and do not acquire more stock', async () => {
    const key = randomUUID();
    const results = await Promise.all(Array.from({ length: 5 }, () => create(contacts[0], key)));
    const ids = results.map(result => assertUuid(unwrap<string>(result, 'parallel retry'), 'Pedido'));
    expect(new Set(ids).size).toBe(1);
    expect(sql(`SELECT count(*) FROM public.reservas_perfil WHERE servicio_id='${service}' AND cerrada_at IS NULL;`).trim()).toBe('1');
    expect(sql(`SELECT count(*) FROM public.domain_events WHERE aggregate_id='${ids[0]}' AND type='pedido.confirmado';`).trim()).toBe('1');
    const stranger = await createServiceClient().rpc('mt_get_commerce_order', { p_wa_id: contacts[1], p_order_id: ids[0] });
    expect(stranger.error?.code).toBe('42501');
  });
});
