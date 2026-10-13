import { authProduction } from './auth-production.js';

function roleForPath(pathname=''){const p=String(pathname).toLowerCase();if(p.includes('partner'))return'PARTNER';if(p.includes('admin'))return'ADMIN';if(p.includes('fleet'))return'FLEET';return'CUSTOMER'}
function continueForRole(role){return({CUSTOMER:'/customer',PARTNER:'/partner',ADMIN:'/admin',FLEET:'/fleet'})[role]||'/customer'}
export async function enforceLiveAuth(){if(!authProduction.configured)return {required:false,mode:'DEMO'};const valid=await authProduction.ensureSession();if(valid)return {required:false,mode:'LIVE',authenticated:true};const role=roleForPath(location.pathname);const next=continueForRole(role);const target=`/auth?role=${encodeURIComponent(role)}&continue=${encodeURIComponent(next)}`;if(location.pathname!=='/auth')location.replace(target);return {required:true,mode:'LIVE',authenticated:false,role,target}}
await enforceLiveAuth();
