import { authProduction } from './auth-production.js';

function roleForPath(pathname=''){const p=String(pathname).toLowerCase();if(p.includes('partner'))return'PARTNER';if(p.includes('admin'))return'ADMIN';if(p.includes('fleet'))return'FLEET';return'CUSTOMER'}
function continueForRole(role){return({CUSTOMER:'/customer',PARTNER:'/partner',ADMIN:'/admin',FLEET:'/fleet'})[role]||'/customer'}
function authTarget(role){const next=continueForRole(role);return `/auth?role=${encodeURIComponent(role)}&continue=${encodeURIComponent(next)}`}
export async function enforceLiveAuth(){
  if(!authProduction.configured)return {required:false,mode:'DEMO'};
  const role=roleForPath(location.pathname);
  const valid=await authProduction.ensureSession();
  if(!valid){
    const target=authTarget(role);
    if(location.pathname!=='/auth')location.replace(target);
    return {required:true,mode:'LIVE',authenticated:false,role,target};
  }
  try{
    const access=await authProduction.authorizeRole(role);
    if(access?.allowed)return {required:false,mode:'LIVE',authenticated:true,authorized:true,role,identity:access.identity,onboardingRequired:Boolean(access.onboardingRequired)};
    const target=authTarget(role);
    if(location.pathname!=='/auth')location.replace(`${target}&error=${encodeURIComponent(access?.error||'role_not_authorized')}`);
    return {required:true,mode:'LIVE',authenticated:true,authorized:false,role,target,error:access?.error||'role_not_authorized'};
  }catch(error){
    const target=authTarget(role);
    if(location.pathname!=='/auth')location.replace(`${target}&error=${encodeURIComponent('authorization_check_failed')}`);
    return {required:true,mode:'LIVE',authenticated:true,authorized:false,role,target,error:error?.message||'authorization_check_failed'};
  }
}
await enforceLiveAuth();
