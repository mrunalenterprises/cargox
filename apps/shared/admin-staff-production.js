import { createSupabaseRestClient } from '../../src/platform/supabase-rest.js';
import { runtimeConfig as cfg } from './runtime-config.js';

const client=createSupabaseRestClient({url:cfg.supabaseUrl,anonKey:cfg.supabaseAnonKey});
const apiBase=String(cfg.adminApiBase||'').replace(/\/$/,'');
const demoStaff=[
  {user_id:'DEMO-SA',display_name:'Super Admin',role:'SUPER_ADMIN',city_code:null,is_active:true,can_edit:true},
  {user_id:'DEMO-GM',display_name:'City GM',role:'GM',city_code:'CSN',is_active:true,can_edit:true},
  {user_id:'DEMO-AC',display_name:'Accounts',role:'ACCOUNTS',city_code:'CSN',is_active:true,can_edit:true},
  {user_id:'DEMO-FO',display_name:'Field Officer',role:'FIELD_OFFICER',city_code:'CSN',is_active:true,can_edit:true}
];
async function api(path,{method='GET',body}={}){const token=client.accessToken();if(!token)throw new Error('login_required');const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),8000);try{const res=await fetch(`${apiBase}${path}`,{method,signal:ctrl.signal,headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data={error:text}}if(!res.ok)throw new Error(data?.error||`portal_api_${res.status}`);return data}catch(e){if(e.name==='AbortError')throw new Error('portal_api_timeout');throw e}finally{clearTimeout(timer)}}

export const adminStaffProduction={
  configured:client.configured,
  async snapshot(){
    if(!client.configured)return {role:'SUPER_ADMIN',cityCode:null,staff:demoStaff,audit:[{id:'DEMO-A1',actor_name:'Super Admin',actor_role:'SUPER_ADMIN',action:'UPSERT_STAFF_MEMBER',entity_type:'ADMIN_MEMBER',entity_id:'DEMO-FO',reason:'Demo staff setup',created_at:new Date().toISOString()}],demo:true};
    if(apiBase)return api('/admin/staff');
    return client.rpc('loadin_admin_staff_snapshot');
  },
  async upsert({userId,role,cityCode=null,displayName='',isActive=true,reason=''}){
    if(!client.configured)return {user_id:userId||`DEMO-${Date.now()}`,display_name:displayName,role,city_code:role==='SUPER_ADMIN'?null:cityCode,is_active:isActive,demo:true};
    const payload={userId,role,cityCode,displayName,isActive,reason};
    if(apiBase)return api('/admin/staff',{method:'POST',body:payload});
    return client.rpc('loadin_admin_upsert_staff',{p_user_id:userId,p_role:role,p_city_code:cityCode||null,p_display_name:displayName||null,p_is_active:Boolean(isActive),p_reason:reason||null});
  }
};
