import { createSupabaseRestClient } from '../../src/platform/supabase-rest.js';
import { runtimeConfig as cfg } from './runtime-config.js';

const client=createSupabaseRestClient({url:cfg.supabaseUrl,anonKey:cfg.supabaseAnonKey});
const apiBase=String(cfg.adminApiBase||'').replace(/\/$/,'');

async function api(path,{method='GET',body}={}){
  const token=client.accessToken();
  if(!token)throw new Error('login_required');
  const r=await fetch(`${apiBase}${path}`,{method,headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok)throw new Error(data?.error||`launch_api_${r.status}`);
  return data;
}
function demoSnapshot(cityCode='CSN'){
  const manual=['OTP_REAL_DEVICE','RAZORPAY_LIVE','GOOGLE_MAPS_LIVE','FCM_LIVE','SECURITY_HEADERS','CUSTOMER_E2E','PARTNER_E2E','ADMIN_E2E','FLEET_E2E'].map(key=>({key,category:key.endsWith('_E2E')?'E2E':'EXTERNAL',label:key.replaceAll('_',' '),required:true,status:'PENDING'}));
  return {releaseReady:false,role:'DEMO',city:{code:cityCode,name:'Chhatrapati Sambhaji Nagar',enabled:false},checks:[{key:'CITY_ENABLED',label:'Launch city enabled',status:'FAIL',value:false,blocking:true},{key:'MANUAL_EXTERNAL',label:'All required external/E2E checks signed off',status:'FAIL',value:{required:manual.length,satisfied:0},blocking:true}],manualChecks:manual,signoffs:[],generatedAt:new Date().toISOString(),demo:true};
}

export const launchProduction={
  configured:client.configured,
  async snapshot(cityCode='CSN'){
    if(!client.configured)return demoSnapshot(cityCode);
    if(apiBase)return api(`/admin/launch-gate?cityCode=${encodeURIComponent(cityCode)}`);
    return client.rpc('loadin_admin_launch_gate_snapshot',{p_city_code:cityCode});
  },
  async setManualCheck({key,status,evidence='',metadata={}}){
    if(!client.configured)return {key,status,evidence,demo:true};
    if(apiBase)return api('/admin/launch-check',{method:'POST',body:{key,status,evidence,metadata}});
    return client.rpc('loadin_admin_set_launch_check',{p_check_key:key,p_status:status,p_evidence:evidence||null,p_metadata:metadata||{}});
  },
  async createSignoff({releaseLabel,commitSha='',cityCode='CSN',notes=''}){
    if(!client.configured)return {id:`DEMO-${Date.now()}`,status:'DRAFT',releaseLabel,commitSha,cityCode,demo:true};
    if(apiBase)return api('/admin/release-signoff',{method:'POST',body:{releaseLabel,commitSha,cityCode,notes}});
    return client.rpc('loadin_admin_create_release_signoff',{p_release_label:releaseLabel,p_commit_sha:commitSha||null,p_city_code:cityCode,p_notes:notes||null});
  },
  async approveSignoff(id,notes=''){
    if(!client.configured)return {id,status:'APPROVED',demo:true};
    if(apiBase)return api(`/admin/release-signoff/${encodeURIComponent(id)}/approve`,{method:'POST',body:{notes}});
    return client.rpc('loadin_admin_approve_release_signoff',{p_signoff_id:id,p_notes:notes||null});
  },
  async revokeSignoff(id,notes=''){
    if(!client.configured)return {id,status:'REVOKED',demo:true};
    if(apiBase)return api(`/admin/release-signoff/${encodeURIComponent(id)}/revoke`,{method:'POST',body:{notes}});
    return client.rpc('loadin_admin_revoke_release_signoff',{p_signoff_id:id,p_notes:notes||null});
  }
};
