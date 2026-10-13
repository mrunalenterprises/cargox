import { createSupabaseRestClient } from '../../src/platform/supabase-rest.js';

const cfg=globalThis.__LOADIN_CONFIG__||{};
const client=createSupabaseRestClient({url:cfg.supabaseUrl,anonKey:cfg.supabaseAnonKey});
const ROLES=new Set(['CUSTOMER','PARTNER','ADMIN','FLEET']);
const CONTINUE={CUSTOMER:'/customer',PARTNER:'/partner',ADMIN:'/admin',FLEET:'/fleet'};

function digits(v=''){return String(v).replace(/\D/g,'')}
function jwtExpiry(token=''){try{const p=String(token).split('.')[1];if(!p)return 0;const normalized=p.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(p.length/4)*4,'=');const json=JSON.parse(globalThis.atob(normalized));return Number(json?.exp||0)}catch{return 0}}
export function normalizePhone(value,{defaultCountryCode='91'}={}){
  const raw=String(value||'').trim();
  if(!raw)throw new Error('mobile_required');
  const d=digits(raw);
  if(raw.startsWith('+')&&d.length>=10&&d.length<=15)return `+${d}`;
  if(d.length===10)return `+${defaultCountryCode}${d}`;
  if(d.length===11&&d.startsWith('0'))return `+${defaultCountryCode}${d.slice(1)}`;
  if(d.length>=11&&d.length<=15)return `+${d}`;
  throw new Error('invalid_mobile_number');
}
function safeRole(role){const r=String(role||'CUSTOMER').toUpperCase();return ROLES.has(r)?r:'CUSTOMER'}
export function safeContinue(role,path){const r=safeRole(role);const clean=String(path||'');return clean===CONTINUE[r]?clean:CONTINUE[r]}

export const authProduction={
  configured:client.configured,
  session:()=>client.readSession(),
  accessToken:()=>client.accessToken(),
  async ensureSession({minValiditySec=60}={}){if(!client.configured)return true;const s=client.readSession();if(!s?.access_token)return false;const exp=jwtExpiry(s.access_token);const now=Math.floor(Date.now()/1000);if(!exp||exp>now+Math.max(0,Number(minValiditySec)||0))return true;if(!s.refresh_token){client.signOutLocal();return false}try{const refreshed=await client.refreshSession();return Boolean(refreshed?.access_token)}catch{client.signOutLocal();return false}},
  async sendOtp(phone){if(!client.configured)return {demo:true,phone:normalizePhone(phone)};return client.sendOtp(normalizePhone(phone))},
  async verifyOtp({phone,token}){const normalized=normalizePhone(phone);if(!/^\d{6}$/.test(String(token||'')))throw new Error('otp_must_be_6_digits');if(!client.configured)return {demo:true,phone:normalized};return client.verifyOtp({phone:normalized,token:String(token),type:'sms'})},
  async identity(){if(!client.configured)return {user_id:'DEMO-USER',customer:{exists:true,city_code:'CSN'},partner:{exists:true,status:'ACTIVE'},admin:{exists:true,role:'SUPER_ADMIN'},fleet:{exists:true,account_id:'DEMO-FLEET'},demo:true};return client.rpc('get_my_loadin_identity')},
  async ensureCustomer({fullName=null,mobile=null,cityCode='CSN'}={}){if(!client.configured)return {user_id:'DEMO-CUSTOMER',full_name:fullName,mobile,city_code:cityCode,demo:true};return client.rpc('ensure_my_customer_profile',{p_full_name:fullName,p_mobile:mobile?normalizePhone(mobile):null,p_city_code:cityCode})},
  async authorizeRole(role){const r=safeRole(role);const identity=await this.identity();if(r==='CUSTOMER')return {allowed:true,identity};if(r==='PARTNER')return {allowed:true,identity,onboardingRequired:!identity?.partner};if(r==='ADMIN')return {allowed:Boolean(identity?.admin),identity,error:identity?.admin?null:'admin_access_not_assigned'};return {allowed:Boolean(identity?.fleet),identity,error:identity?.fleet?null:'fleet_access_not_assigned'}},
  signOut(){client.signOutLocal()},
  safeRole,
  safeContinue
};
