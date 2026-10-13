import { createSupabaseRestClient } from '../../src/platform/supabase-rest.js';

const cfg=globalThis.__LOADIN_CONFIG__||{};
const client=createSupabaseRestClient({url:cfg.supabaseUrl,anonKey:cfg.supabaseAnonKey});

export const adminProduction={
  configured:client.configured,
  async payoutQueue(){
    if(!client.configured)return {role:'DEMO',cityCode:'CSN',requests:[],demo:true};
    return client.rpc('loadin_admin_payout_queue');
  },
  async processPayout({requestId,action,providerReference=null,notes=''}){
    if(!client.configured)return {id:requestId,status:action==='PAID'?'PAID':action==='REJECT'?'REJECTED':action==='PROCESS'?'PROCESSING':'APPROVED',demo:true};
    return client.rpc('loadin_admin_process_partner_payout',{p_request_id:requestId,p_action:action,p_provider_reference:providerReference,p_notes:notes});
  }
};
