import { createSupabaseRestClient } from '../../src/platform/supabase-rest.js';

const cfg=globalThis.__LOADIN_CONFIG__||{};
const client=createSupabaseRestClient({url:cfg.supabaseUrl,anonKey:cfg.supabaseAnonKey});

export const adminProduction={
  configured:client.configured,
  async liveMapSnapshot(){
    if(!client.configured)return {role:'DEMO',cityCode:'CSN',trips:[],partners:[],alerts:[],demo:true};
    return client.rpc('loadin_admin_live_map_snapshot');
  },
  async payoutQueue(){
    if(!client.configured)return {role:'DEMO',cityCode:'CSN',requests:[],demo:true};
    return client.rpc('loadin_admin_payout_queue');
  },
  async processPayout({requestId,action,providerReference=null,notes=''}){
    if(!client.configured)return {id:requestId,status:action==='PAID'?'PAID':action==='REJECT'?'REJECTED':action==='PROCESS'?'PROCESSING':'APPROVED',demo:true};
    return client.rpc('loadin_admin_process_partner_payout',{p_request_id:requestId,p_action:action,p_provider_reference:providerReference,p_notes:notes});
  },
  async documentReviewQueue(){
    if(!client.configured)return {role:'DEMO',cityCode:'CSN',documents:[{scope:'VEHICLE',document_id:'DEMO-DOC-1',partner_id:'DEMO-PARTNER',partner_name:'LOADIN Demo Partner',city_code:'CSN',vehicle_id:'DEMO-TATA-ACE',registration_number:'MH20DEMO01',document_type:'INSURANCE',document_number:'DEMO-INS-01',expiry_date:new Date(Date.now()+330*86400000).toISOString().slice(0,10),status:'PENDING',updated_at:new Date().toISOString()}],demo:true};
    return client.rpc('loadin_admin_document_review_queue');
  },
  async reviewPartnerDocument({scope,documentId,approved,notes=''}){
    if(!client.configured)return {document_id:documentId,scope,status:approved?'APPROVED':'REJECTED',bookingEligible:Boolean(approved),demo:true};
    return client.rpc('loadin_admin_review_partner_document',{p_scope:scope,p_document_id:documentId,p_approved:Boolean(approved),p_notes:notes});
  }
};
