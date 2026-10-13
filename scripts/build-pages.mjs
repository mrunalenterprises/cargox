import {cp,mkdir,readFile,rm,writeFile,readdir} from 'node:fs/promises';
import {dirname,extname,join,posix} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const out=join(root,'_site');
const raw=String(process.env.LOADIN_PUBLIC_BASE||'').trim();
const base=raw==='/'?'':raw.replace(/\/$/,'');
const supabaseUrl=String(process.env.LOADIN_SUPABASE_URL||'').trim();
const supabaseAnonKey=String(process.env.LOADIN_SUPABASE_ANON_KEY||'').trim();
if(!supabaseUrl||!supabaseAnonKey)throw new Error('LOADIN public Supabase config required');
const routes={auth:'apps/auth-web/index.html',website:'apps/public-web/index.html',customer:'apps/customer-web/index.html','customer-account':'apps/customer-web/account.html','customer-notifications':'apps/customer-web/notifications.html','customer-experience':'apps/customer-web/experience.html','customer-checkout':'apps/customer-web/checkout.html','customer-recurring':'apps/customer-web/recurring.html','customer-business':'apps/customer-web/business.html','customer-rewards':'apps/customer-web/rewards.html','customer-reliability':'apps/customer-web/reliability-cargo.html','customer-shifting':'apps/customer-web/shifting-planner.html',partner:'apps/partner-web/index.html','partner-notifications':'apps/partner-web/notifications.html','partner-readiness':'apps/partner-web/readiness.html','partner-onboarding':'apps/partner-web/onboarding.html','partner-documents':'apps/partner-web/documents.html','partner-renewals':'apps/partner-web/document-renewals.html','partner-special':'apps/partner-web/special-jobs.html','partner-wallet':'apps/partner-web/wallet.html','partner-quality':'apps/partner-web/quality-demand.html','partner-plan':'apps/partner-web/plan-center.html',admin:'apps/admin-web/index.html','admin-map':'apps/admin-web/ops-map.html','admin-booking':'apps/admin-web/booking-detail.html','admin-settings':'apps/admin-web/ops-settings.html','admin-review':'apps/admin-web/review-center.html','admin-documents':'apps/admin-web/document-renewals.html','admin-finance':'apps/admin-web/finance-center.html','admin-reconciliation':'apps/admin-web/reconciliation.html','admin-safety':'apps/admin-web/safety-center.html','admin-growth':'apps/admin-web/growth-center.html','admin-support':'apps/admin-web/support-center.html','admin-city-services':'apps/admin-web/city-service-center.html','admin-staff':'apps/admin-web/staff-audit.html','admin-readiness':'apps/admin-web/production-readiness.html','admin-launch':'apps/admin-web/launch-control.html',fleet:'apps/fleet-web/index.html','fleet-compliance':'apps/fleet-web/compliance.html','fleet-reports':'apps/fleet-web/reports-center.html','fleet-assignments':'apps/fleet-web/assignment-planner.html','fleet-dispatch':'apps/fleet-web/dispatch-board.html'};
const names=[...Object.keys(routes),'loadin-config.json','firebase-messaging-sw.js'];
const url=(p='')=>`${base}/${p}`.replace(/\/+/g,'/')||'/';
function rewrite(text){let s=String(text);for(const n of [...names].sort((a,b)=>b.length-a.length)){for(const q of ["'",'"','`'])s=s.split(`${q}/${n}`).join(`${q}${url(n)}`)}return s.replace(/href="\/"/g,`href="${url()}"`)}
function addBase(html,target){const href=`../${posix.dirname(target)}/`;return /<base\s/i.test(html)?html:html.replace(/<head(\s[^>]*)?>/i,m=>`${m}<base href="${href}">`)}
async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const p=join(dir,item.name);if(item.isDirectory())await walk(p);else if(['.html','.js','.mjs'].includes(extname(item.name).toLowerCase()))await writeFile(p,rewrite(await readFile(p,'utf8')))}}
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
await cp(join(root,'apps'),join(out,'apps'),{recursive:true});
await cp(join(root,'apps/public-web/assets'),join(out,'assets'),{recursive:true});
await cp(join(root,'src'),join(out,'src'),{recursive:true});await cp(join(root,'firebase-messaging-sw.js'),join(out,'firebase-messaging-sw.js'));
await walk(join(out,'apps'));await walk(join(out,'src'));
let home=rewrite(await readFile(join(root,'apps/public-web/index.html'),'utf8')).replace('href="./styles.css"','href="apps/public-web/styles.css"');await writeFile(join(out,'index.html'),home);
for(const [route,target] of Object.entries(routes)){const dir=join(out,route);await mkdir(dir,{recursive:true});await writeFile(join(dir,'index.html'),addBase(rewrite(await readFile(join(root,target),'utf8')),target))}
await writeFile(join(out,'loadin-config.json'),JSON.stringify({supabaseUrl,supabaseAnonKey,googleMapsApiKey:'',paymentProvider:'UNSET',paymentPublicKey:'',paymentApiBase:'',adminApiBase:'',firebaseConfig:null,firebaseVapidKey:'',firebaseSdkVersion:'10.14.1'},null,2));
await writeFile(join(out,'.nojekyll'),'');
console.log(`LOADIN live web build ready: ${Object.keys(routes).length+1} routes`);
