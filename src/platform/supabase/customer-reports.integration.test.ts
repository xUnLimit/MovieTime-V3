import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from '@/platform/validation/zod';
import { createUserClient } from '@/test/integration/clients';
import { requireIntegrationEnv } from '@/test/integration/env';
import { FixtureScope, uniqueId, uniqueWaId, unwrap } from '@/test/integration/fixtures';

const claimSchema = z.object({ id:z.number(),token:z.string().uuid(),fence:z.number(),message:z.object({text_body:z.string()}) });
describe.skipIf(requireIntegrationEnv() === null)('integracion: reportes explícitos y recopilación',()=>{
  const scope=new FixtureScope();
  let admin:SupabaseClient;
  let operator:SupabaseClient;
  let waId:string;
  beforeAll(async()=>{
    const owner=await scope.createUser({role:'admin'});
    const user=await scope.createUser({role:'operador'});
    admin=await createUserClient(owner.email,owner.password);
    operator=await createUserClient(user.email,user.password);
    waId=scope.trackWaId(uniqueWaId());
  });
  afterAll(async()=>{
    if(waId) unwrap(await scope.service.from('customer_reports').delete().eq('wa_id',waId).select('id'),'limpiar reportes');
    await Promise.all([admin,operator].map(client=>client?.auth.signOut()));
    await scope.cleanup();
  });
  it('recopila dos textos, crea un solo reporte y protege su lectura y actualización',async()=>{
    const db=scope.service;
    unwrap(await db.from('whatsapp_conversation_state').insert({wa_id:waId}).select('wa_id'),'conversación');
    unwrap(await db.from('whatsapp_bot_waits').insert({wa_id:waId,node_id:'problema',expires_at:new Date(Date.now()+3_600_000).toISOString(),collect_minutes:1}).select('wa_id'),'espera');
    const messageId=uniqueId('wamid');
    for(const [id,text] of [[messageId,'No abre.'],[uniqueId('wamid'),'Desde ayer.']]){
      unwrap(await db.from('whatsapp_inbound_messages').insert({wa_message_id:id,phone_number_id:'fixture',from_wa_id:waId,message_type:'text',text_body:text,sent_at:new Date().toISOString()}).select('id'),'texto');
    }
    const pending=unwrap<{available_at:string}[]>(await db.from('whatsapp_automation_inbox').select('available_at').eq('wa_id',waId),'ventana');
    expect(pending).toHaveLength(2);
    expect(new Set(pending.map(row=>row.available_at)).size).toBe(1);
    expect(new Date(pending[0].available_at).getTime()).toBeGreaterThan(Date.now());
    expect(unwrap(await db.from('customer_reports').select('id').eq('wa_id',waId),'sin reporte')).toEqual([]);
    unwrap(await db.from('whatsapp_automation_inbox').update({available_at:new Date(Date.now()-1000).toISOString()}).eq('wa_id',waId).select('id'),'vencer ventana');
    const claim=claimSchema.parse(unwrap(await db.rpc('claim_whatsapp_automation',{p_lease_seconds:90}),'reclamar'));
    expect(claim.message.text_body).toBe('No abre.\n\nDesde ayer.');
    const args={p_wa_id:waId,p_message_id:messageId,p_description:claim.message.text_body,p_token:claim.token,p_fence:claim.fence};
    const id=z.string().uuid().parse(unwrap(await db.rpc('create_customer_report',args),'crear reporte'));
    expect(unwrap(await db.rpc('create_customer_report',args),'reintento')).toBe(id);
    expect(unwrap(await admin.from('customer_reports').select('id,description').eq('id',id),'leer admin')).toEqual([{id,description:claim.message.text_body}]);
    expect(unwrap(await operator.from('customer_reports').select('id').eq('id',id),'leer operador')).toEqual([]);
    expect((await operator.rpc('update_customer_report',{p_id:id,p_status:'resolved',p_version:0})).error).not.toBeNull();
    expect(unwrap(await admin.rpc('update_customer_report',{p_id:id,p_status:'in_progress',p_version:0}),'atender')).toBe(true);
    expect(unwrap(await admin.rpc('update_customer_report',{p_id:id,p_status:'resolved',p_version:0}),'versión obsoleta')).toBe(false);
    expect(unwrap(await db.rpc('finish_whatsapp_automation',{p_id:claim.id,p_token:claim.token,p_fence:claim.fence,p_outcome:'handoff'}),'entregar')).toBe(true);
    const jobs=unwrap<{status:string}[]>(await db.from('whatsapp_automation_inbox').select('status').eq('wa_id',waId),'trabajos');
    expect(jobs.every(row=>row.status==='done')).toBe(true);
  });
});
