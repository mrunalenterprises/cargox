const APP_BASE=String(process.env.LOADIN_APP_BASE||'').replace(/\/$/,'');
const ADMIN_API=String(process.env.LOADIN_ADMIN_API_BASE||'').replace(/\/$/,'');
const TOKEN=String(process.env.LOADIN_ADMIN_BEARER_TOKEN||'').trim();
const CITY=String(process.env.LOADIN_LAUNCH_CITY||'CSN').trim().toUpperCase();
const EXPECTED_COMMIT=String(process.env.LOADIN_EXPECTED_COMMIT||'').trim().toLowerCase();
const CHECK_ONLY=process.argv.includes('--check');

function validUrl(v){try{const u=new URL(v);return u.protocol==='https:'||u.hostname==='127.0.0.1'||u.hostname==='localhost'}catch{return false}}
function configState(){const checks={appBase:validUrl(APP_BASE),adminApi:validUrl(ADMIN_API),bearerToken:Boolean(TOKEN),city:Boolean(CITY)};return {ok:Object.values(checks).every(Boolean),checks,city:CITY,expectedCommit:EXPECTED_COMMIT||null}}
function die(message,extra={}){console.error(JSON.stringify({ok:false,error:message,...extra}));process.exit(1)}
async function fetchJson(url,options={}){const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),7000);try{const r=await fetch(url,{...options,signal:ctrl.signal,cache:'no-store'});const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}if(!r.ok)throw new Error(`${new URL(url).pathname}_http_${r.status}`);return data}finally{clearTimeout(timer)}}
async function page(path,needle){const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),7000);try{const r=await fetch(`${APP_BASE}${path}`,{signal:ctrl.signal,cache:'no-store'});const text=await r.text();return {path,ok:r.ok&&text.includes(needle),status:r.status}}finally{clearTimeout(timer)}}

const cfg=configState();
if(CHECK_ONLY){console.log(JSON.stringify(cfg));process.exit(cfg.ok?0:1)}
if(!cfg.ok)die('launch_preflight_not_configured',{checks:cfg.checks});

const pages=await Promise.all([
  page('/website','LOADIN'),page('/auth','Secure sign in'),page('/customer','LOADIN Customer'),
  page('/partner','LOADIN Partner'),page('/admin','LOADIN Admin'),page('/fleet','LOADIN Fleet'),page('/admin-launch','Production release gate')
]);
if(pages.some(x=>!x.ok))die('production_surface_smoke_failed',{pages});

let ready;try{ready=await fetchJson(`${ADMIN_API}/ready`)}catch(e){die('portal_api_not_ready',{message:e.message})}
if(!ready?.ok)die('portal_api_not_ready',{ready});

const headers={Authorization:`Bearer ${TOKEN}`,'content-type':'application/json'};
let gate;try{gate=await fetchJson(`${ADMIN_API}/admin/launch-gate?cityCode=${encodeURIComponent(CITY)}`,{headers})}catch(e){die('launch_gate_fetch_failed',{message:e.message})}
if(!gate?.releaseReady){const failed=(gate?.checks||[]).filter(x=>x.status!=='PASS').map(x=>x.key);const manual=(gate?.manualChecks||[]).filter(x=>!['PASS','WAIVED'].includes(x.status)).map(x=>x.key);die('launch_gate_blocked',{failedChecks:failed,manualPending:manual,city:gate?.city||CITY})}

const approved=(gate.signoffs||[]).find(x=>x.status==='APPROVED');
if(!approved)die('approved_release_signoff_missing',{city:CITY});
if(EXPECTED_COMMIT){const actual=String(approved.commitSha||approved.commit_sha||'').toLowerCase();if(!actual||!EXPECTED_COMMIT.startsWith(actual)&&!actual.startsWith(EXPECTED_COMMIT))die('approved_commit_mismatch',{expected:EXPECTED_COMMIT,approved:actual||null})}

console.log(JSON.stringify({ok:true,city:CITY,releaseReady:true,approvedRelease:approved,pages,portalService:ready.service||'loadin-portal-api'}));
