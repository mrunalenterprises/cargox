import { createSupabaseRestClient } from '../../src/platform/supabase-rest.js';
import { runtimeConfig as cfg } from './runtime-config.js';

const client=createSupabaseRestClient({url:cfg.supabaseUrl,anonKey:cfg.supabaseAnonKey});
const apiBase=String(cfg.adminApiBase||'').replace(/\/$/,'');
async function api(path,{method='GET',body}={}){const token=client.accessToken();if(!token)throw new Error('login_required');const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),10000);try{const res=await fetch(`${apiBase}${path}`,{method,signal:ctrl.signal,headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data={error:text}}if(!res.ok)throw new Error(data?.error||`portal_api_${res.status}`);return data}catch(e){if(e.name==='AbortError')throw new Error('portal_api_timeout');throw e}finally{clearTimeout(timer)}}
function demoSnapshot(){return {role:'ACCOUNTS',cityCode:'CSN',latestRun:{id:'DEMO-RUN',status:'COMPLETED',scope_from:new Date(Date.now()-7*86400000).toISOString(),scope_to:new Date().toISOString(),summary:{openIssues:1,p0:0,p1:1,completedFare:15240,settledFare:15240}},issues:[{id:'DEMO-I1',issue_type:'COMMISSION_DEBIT_EVENT_MISSING',severity:'P1',city_code:'CSN',booking_id:'DEMO-BK',expected_amount:150,actual_amount:0,status:'OPEN',details:{settlement_mode:'COMMISSION_BALANCE_DEBIT'},created_at:new Date().toISOString()}],demo:true}}
export const reconciliationProduction={
  configured:client.configured,
  async snapshot(){if(!client.configured)return demoSnapshot();if(apiBase)return api('/admin/reconciliation');return client.rpc('loadin_admin_finance_reconciliation_snapshot')},
  async run(hours=168){if(!client.configured)return {...demoSnapshot().latestRun,run_id:`DEMO-RUN-${Date.now()}`,openIssues:1,p0:0,p1:1,demo:true};if(apiBase)return api('/admin/reconciliation/run',{method:'POST',body:{hours}});return client.rpc('loadin_admin_run_finance_reconciliation',{p_hours:Number(hours)})},
  async resolve(issueId,{status='RESOLVED',notes=''}={}){if(!client.configured)return {id:issueId,status,resolved_at:new Date().toISOString(),demo:true};if(apiBase)return api(`/admin/reconciliation/${encodeURIComponent(issueId)}/resolve`,{method:'POST',body:{status,notes}});return client.rpc('loadin_admin_resolve_reconciliation_issue',{p_issue_id:issueId,p_status:status,p_notes:notes||null})}
};
