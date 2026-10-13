import { createSupabaseRestClient } from '../../src/platform/supabase-rest.js';
import { runtimeConfig as cfg } from './runtime-config.js';

const client=createSupabaseRestClient({url:cfg.supabaseUrl,anonKey:cfg.supabaseAnonKey});
const apiBase=String(cfg.adminApiBase||'').replace(/\/$/,'');

async function api(path,{method='POST',body=null}={}){
  if(!apiBase)throw new Error('portal_api_not_configured');
  const token=client.accessToken();if(!token)throw new Error('login_required');
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),8000);
  try{
    const res=await fetch(`${apiBase}${path}`,{method,signal:ctrl.signal,headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:body==null?undefined:JSON.stringify(body)});
    const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data={error:text}}
    if(!res.ok)throw new Error(data?.error||`portal_api_${res.status}`);
    return data;
  }catch(error){if(error.name==='AbortError')throw new Error('portal_api_timeout');throw error}finally{clearTimeout(timer)}
}
async function rpc(name,args){if(!client.configured)throw new Error('live_backend_not_configured');return client.rpc(name,args)}
async function mutate({path,rpcName,args,body}){return apiBase?api(path,{body}):rpc(rpcName,args)}

export const fleetProduction={
  configured:client.configured,
  viaPortalApi:Boolean(apiBase),
  async addVehicle({registrationNumber,vehicleType}){return mutate({path:'/fleet/vehicles',rpcName:'loadin_fleet_add_vehicle',args:{p_registration_number:registrationNumber,p_vehicle_type:vehicleType},body:{registrationNumber,vehicleType}})},
  async addDriver({fullName,mobile=''}){return mutate({path:'/fleet/drivers',rpcName:'loadin_fleet_add_driver',args:{p_full_name:fullName,p_mobile:mobile||null},body:{fullName,mobile:mobile||null}})},
  async assignDriver({vehicleId,driverId}){return mutate({path:'/fleet/assignments',rpcName:'loadin_fleet_assign_driver',args:{p_vehicle_id:vehicleId,p_driver_id:driverId},body:{vehicleId,driverId}})},
  async endAssignment(assignmentId){return mutate({path:`/fleet/assignments/${encodeURIComponent(assignmentId)}/end`,rpcName:'loadin_fleet_end_assignment',args:{p_assignment_id:assignmentId},body:{}})},
  async setVehicleStatus(vehicleId,status){return mutate({path:`/fleet/vehicles/${encodeURIComponent(vehicleId)}/status`,rpcName:'loadin_fleet_set_vehicle_status',args:{p_vehicle_id:vehicleId,p_status:status},body:{status}})},
  async setDriverStatus(driverId,status){return mutate({path:`/fleet/drivers/${encodeURIComponent(driverId)}/status`,rpcName:'loadin_fleet_set_driver_status',args:{p_driver_id:driverId,p_status:status},body:{status}})}
};
