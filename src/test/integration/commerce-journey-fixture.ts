import { execFileSync } from 'node:child_process';
import { randomInt, randomUUID } from 'node:crypto';
import { addOption, addPurchaseFlow, connectOption, defaultDefinition } from '@/modules/bot-config';
import { z } from '@/platform/validation/zod';
import { integrationEnv } from './env';
import { uniqueWaId } from './fixtures';

const botStateSchema=z.object({enabled:z.boolean(),published_version:z.number().int().nullable()});
const literal=(value:string)=>`'${value.replaceAll("'","''")}'`;
export class CommerceJourneyFixture {
  readonly category=randomUUID();readonly planType=randomUUID();readonly plan=randomUUID();readonly service=randomUUID();
  readonly waId=uniqueWaId();readonly fixtureCredential=randomUUID();readonly code=`JOURNEY${randomUUID().replaceAll('-','').slice(0,16)}`.toUpperCase();
  /** Codigo de Yappy con la forma LETRAS-NUMEROS: el cliente solo da sus ultimos 4 digitos. */
  readonly digitsCode = `JOURNEYD-${randomInt(10_000_000, 99_999_999)}`;
  get last4(): string { return this.digitsCode.slice(-4); }
  readonly uidValidity=randomInt(1_000_000,2_000_000_000);
  private originalSettings:string|null=null;
  private originalBot:z.infer<typeof botStateSchema>|null=null;
  private originalAutomatic=false;
  private fixtureVersion:number|null=null;
  sql(statement:string):string {
    const container=process.env.INTEGRATION_DATABASE_CONTAINER
      ?? (process.env.CI?'supabase_db_MovieTime-V3':'supabase_db_MovieTime-Automation-Verification');
    if(!/^supabase_db_[A-Za-z0-9_-]+$/.test(container))throw new Error('Contenedor de pruebas inválido.');
    if(!['127.0.0.1','localhost','::1','[::1]'].includes(new URL(integrationEnv().url).hostname))
      throw new Error('El recorrido integrado requiere Supabase local.');
    if(!process.env.CI&&container!=='supabase_db_MovieTime-Automation-Verification')
      throw new Error('El recorrido requiere el contenedor aislado de verificación.');
    return execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'],
      {input:statement,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
  }
  /** Recorrido publicado en el escenario: el de siempre o el que trae los bloques de compra conectados desde el menu. */
  static definition(withPurchaseBlocks:boolean){
    const base=defaultDefinition();
    if(!withPurchaseBlocks)return base;
    return connectOption(CommerceJourneyFixture.withPurchaseButton(),'menu',CommerceJourneyFixture.purchaseOptionId(),'compra_catalogo');
  }
  /** Id del boton del menu que lleva al catalogo de compra en el recorrido con bloques; el cliente lo toca para empezar. */
  static purchaseOptionId():string{
    const added=CommerceJourneyFixture.withPurchaseButton().nodes.find(node=>node.id==='menu')?.options.at(-1);
    if(!added)throw new Error('El menú no admite otro botón.');
    return added.id;
  }
  private static withPurchaseButton(){return addOption(addPurchaseFlow(defaultDefinition()),'menu');}
  setup(withPurchaseBlocks=false):void {
    this.originalSettings=this.sql('SELECT settings::text FROM public.mt_automation_settings WHERE id;');
    this.originalBot=botStateSchema.parse(JSON.parse(this.sql("SELECT jsonb_build_object('enabled',enabled,'published_version',published_version) FROM public.whatsapp_bot_config WHERE id='global';")));
    this.originalAutomatic=this.sql("SELECT whatsapp_auto_enabled FROM public.config WHERE id='global';")==='t';
    this.fixtureVersion=z.coerce.number().int().positive().parse(this.sql(`INSERT INTO public.whatsapp_bot_versions(definition,note)
      VALUES(${literal(JSON.stringify(CommerceJourneyFixture.definition(withPurchaseBlocks)))}::jsonb,'Integration journey fixture') RETURNING version;`));
    this.sql(`BEGIN;
      UPDATE public.mt_automation_settings SET settings=jsonb_set(jsonb_set(settings,'{purchasesEnabled}','true'),'{aiMode}','"off"');
      UPDATE public.whatsapp_bot_config SET enabled=true,published_version=${this.fixtureVersion} WHERE id='global';
      UPDATE public.config SET whatsapp_auto_enabled=true WHERE id='global';
      INSERT INTO public.categorias(id,nombre,tipo) VALUES('${this.category}','Journey fixture','cliente');
      INSERT INTO public.planes_tipos(id,categoria_id,nombre) VALUES('${this.planType}','${this.category}','Individual');
      INSERT INTO public.planes(id,categoria_id,plan_tipo_id,nombre,ciclo_pago,precio)
        VALUES('${this.plan}','${this.category}','${this.planType}','Journey monthly','mensual',10);
      INSERT INTO public.servicios(id,categoria_id,plan_tipo_id,nombre,correo,contrasena,perfiles_disponibles)
        VALUES('${this.service}','${this.category}','${this.planType}','Journey access','journey@example.test','${this.fixtureCredential}',1);
      INSERT INTO public.whatsapp_contacts(wa_id,estado) VALUES('${this.waId}','lead');
      COMMIT;`);
  }
  cleanup():void {
    if(this.originalSettings===null||this.originalBot===null)return;
    this.sql(`BEGIN;
      UPDATE public.mt_automation_settings SET settings=${literal(this.originalSettings)}::jsonb WHERE id;
      UPDATE public.whatsapp_bot_config SET enabled=${this.originalBot.enabled},published_version=${this.originalBot.published_version ?? 'NULL'} WHERE id='global';
      UPDATE public.config SET whatsapp_auto_enabled=${this.originalAutomatic} WHERE id='global';
      DELETE FROM public.whatsapp_automation_inbox WHERE wa_id='${this.waId}';
      DELETE FROM public.whatsapp_conversation_state WHERE wa_id='${this.waId}';
      DELETE FROM public.mt_order_deliveries WHERE venta_id IN(SELECT id FROM public.ventas WHERE servicio_id='${this.service}');
      DELETE FROM public.whatsapp_outbound_messages WHERE to_wa_id='${this.waId}';
      DELETE FROM public.whatsapp_inbound_messages WHERE from_wa_id='${this.waId}';
      DELETE FROM public.whatsapp_bot_events WHERE wa_id='${this.waId}';
      DELETE FROM public.domain_events WHERE aggregate_id IN(SELECT id::text FROM public.pedidos WHERE contact_id='${this.waId}');
      DELETE FROM public.reservas_perfil WHERE servicio_id='${this.service}';
      DELETE FROM public.intentos_comprobante WHERE pedido_id IN(SELECT id FROM public.pedidos WHERE contact_id='${this.waId}');
      DELETE FROM public.pedido_operaciones WHERE result_id IN(SELECT id FROM public.pedidos WHERE contact_id='${this.waId}');
      DELETE FROM public.pedido_pagos WHERE pedido_id IN(SELECT id FROM public.pedidos WHERE contact_id='${this.waId}');
      UPDATE public.yappy_payments SET revision_pedido_id=NULL,matched_venta_id=NULL WHERE upper(confirmation_code) IN(upper('${this.code}'),upper('${this.digitsCode}'));
      DELETE FROM public.pedido_items WHERE servicio_id='${this.service}';
      DELETE FROM public.pedidos WHERE contact_id='${this.waId}';
      DELETE FROM public.pagos_venta WHERE venta_id IN(SELECT id FROM public.ventas WHERE servicio_id='${this.service}');
      DELETE FROM public.venta_periodos WHERE venta_id IN(SELECT id FROM public.ventas WHERE servicio_id='${this.service}');
      DELETE FROM public.ventas WHERE servicio_id='${this.service}';
      DELETE FROM public.whatsapp_contacts WHERE wa_id='${this.waId}';
      DELETE FROM public.terceros WHERE wa_id='${this.waId}';
      DELETE FROM public.yappy_payments WHERE upper(confirmation_code) IN(upper('${this.code}'),upper('${this.digitsCode}'));
      DELETE FROM public.yappy_mail_messages WHERE uid_validity=${this.uidValidity};
      DELETE FROM public.servicios WHERE id='${this.service}';
      DELETE FROM public.planes WHERE id='${this.plan}';
      DELETE FROM public.planes_tipos WHERE id='${this.planType}';
      DELETE FROM public.categorias WHERE id='${this.category}';
      DELETE FROM public.whatsapp_bot_versions WHERE version=${this.fixtureVersion ?? 0};
      COMMIT;`);
  }
}
