const cfg=globalThis.__LOADIN_CONFIG__||{};
const configured=Boolean(String(cfg.supabaseUrl||'').trim()&&String(cfg.supabaseAnonKey||'').trim());
function readSession(){try{return JSON.parse(localStorage.getItem('loadin.supabase.session')||'null')}catch{return null}}
function roleForPath(pathname=''){const p=String(pathname).toLowerCase();if(p.includes('partner'))return'PARTNER';if(p.includes('admin'))return'ADMIN';if(p.includes('fleet'))return'FLEET';return'CUSTOMER'}
function continueForRole(role){return({CUSTOMER:'/customer',PARTNER:'/partner',ADMIN:'/admin',FLEET:'/fleet'})[role]||'/customer'}
export function enforceLiveAuth(){if(!configured)return {required:false,mode:'DEMO'};const session=readSession();if(session?.access_token)return {required:false,mode:'LIVE',authenticated:true};const role=roleForPath(location.pathname);const next=continueForRole(role);const target=`/auth?role=${encodeURIComponent(role)}&continue=${encodeURIComponent(next)}`;if(location.pathname!=='/auth')location.replace(target);return {required:true,mode:'LIVE',authenticated:false,role,target}}
enforceLiveAuth();
