import { createSupabaseRestClient } from '../../src/platform/supabase-rest.js';

const cfg=globalThis.__LOADIN_CONFIG__||{};
const client=createSupabaseRestClient({url:cfg.supabaseUrl,anonKey:cfg.supabaseAnonKey});
function eq(v){return `eq.${v}`}
function desc(col){return `${col}.desc`}
function safeFileName(value='file'){return String(value).replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'file'}
async function currentUser(){const session=client.readSession();if(!session?.access_token)return null;return client.getUser()}

export const partnerProduction={
  configured:client.configured,
  async complianceSnapshot(){
    if(!client.configured)return {approved:true,vehicleEligible:true,partnerDocsValid:true,vehicleDocsValid:true,identityReady:true,canGoOnline:true,expiringWithin30Days:0,expiredDocuments:0,demo:true};
    return client.rpc('get_my_partner_compliance_snapshot');
  },
  async documentSnapshot(){
    if(!client.configured){const today=new Date();const soon=new Date(today);soon.setDate(soon.getDate()+18);return {partner:[{id:'D1',document_type:'DRIVING_LICENCE',status:'APPROVED',expiry_date:soon.toISOString().slice(0,10)},{id:'D2',document_type:'PAN',status:'APPROVED',expiry_date:null}],vehicle:[{id:'V1',document_type:'INSURANCE',status:'APPROVED',expiry_date:soon.toISOString().slice(0,10)},{id:'V2',document_type:'PUC',status:'APPROVED',expiry_date:null}],vehicleId:'DEMO-VEHICLE',demo:true}}
    const user=await currentUser();if(!user?.id)throw new Error('login_required');
    const [partnerDocs,vehicles]=await Promise.all([
      client.select('partner_documents',{filters:{partner_id:eq(user.id)},order:desc('updated_at'),limit:100}),
      client.select('partner_vehicles',{filters:{partner_id:eq(user.id)},order:desc('updated_at'),limit:1})
    ]);
    const vehicle=vehicles?.[0]||null;
    const vehicleDocs=vehicle?await client.select('vehicle_documents',{filters:{vehicle_id:eq(vehicle.id)},order:desc('updated_at'),limit:100}):[];
    return {partner:partnerDocs||[],vehicle:vehicleDocs||[],vehicleId:vehicle?.id||null};
  },
  async uploadOnlineIdentitySelfie(file){
    if(!file)throw new Error('selfie_required');
    if(!client.configured)return {status:'CAPTURED',valid_for_minutes:15,demo:true};
    const user=await currentUser();if(!user?.id)throw new Error('login_required');
    const path=`${user.id}/identity/online/${Date.now()}-${safeFileName(file.name)}`;
    await client.uploadObject('partner-documents',path,file,{contentType:file.type||'image/jpeg',upsert:false});
    return client.rpc('register_partner_online_identity_selfie',{p_storage_path:path});
  },
  async requestPayout(amount){
    if(!client.configured)return {id:`DEMO-PAYOUT-${Date.now()}`,status:'REQUESTED',amount:Number(amount||0),demo:true};
    return client.rpc('request_my_partner_payout',{p_amount:Number(amount)});
  },
  async payoutRequests(){
    if(!client.configured)return [];
    const user=await currentUser();if(!user?.id)return [];
    return client.select('partner_payout_requests',{filters:{partner_id:eq(user.id)},order:desc('requested_at'),limit:50});
  },
  async registerPushToken({token,platform='WEB',deviceId='browser'}){
    if(!client.configured)return {active:true,platform,device_id:deviceId,demo:true};
    return client.rpc('upsert_my_push_token',{p_token:token,p_platform:platform,p_device_id:deviceId});
  },
  async deactivatePushToken(token){
    if(!client.configured)return true;
    return client.rpc('deactivate_my_push_token',{p_token:token});
  }
};
