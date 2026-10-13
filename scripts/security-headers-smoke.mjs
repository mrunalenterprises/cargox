const base=String(process.env.LOADIN_APP_BASE||'').replace(/\/$/,'');
if(!base)throw new Error('LOADIN_APP_BASE_required');
const url=new URL(base);
const local=['localhost','127.0.0.1'].includes(url.hostname);

async function fetchPage(path){
  const res=await fetch(`${base}${path}`,{redirect:'manual',cache:'no-store'});
  if(!res.ok)throw new Error(`${path}: HTTP ${res.status}`);
  return res;
}
function hasToken(value,token){return String(value||'').toLowerCase().includes(token.toLowerCase())}
function assertHeader(res,name,test,message){const value=res.headers.get(name)||'';if(!test(value))throw new Error(`${name}: ${message}; got ${value||'<missing>'}`)}

const page=await fetchPage('/auth');
assertHeader(page,'x-content-type-options',v=>v.toLowerCase()==='nosniff','must be nosniff');
assertHeader(page,'referrer-policy',v=>Boolean(v),'must be configured');
assertHeader(page,'permissions-policy',v=>Boolean(v),'must be configured');
assertHeader(page,'content-security-policy',v=>hasToken(v,"default-src")&&hasToken(v,"script-src"),'must define default-src and script-src');
if(!local&&url.protocol==='https:')assertHeader(page,'strict-transport-security',v=>hasToken(v,'max-age='),'must enable HSTS on HTTPS');

const config=await fetchPage('/loadin-config.json');
const cache=String(config.headers.get('cache-control')||'').toLowerCase();
if(!(cache.includes('no-store')||cache.includes('no-cache')||cache.includes('max-age=0')))throw new Error(`/loadin-config.json: unsafe cache-control ${cache||'<missing>'}`);
const body=await config.text();
if(/service[_-]?role|sb_secret_|private[_-]?key|key[_-]?secret|webhook[_-]?secret/i.test(body))throw new Error('/loadin-config.json: possible server secret marker detected');

console.log(JSON.stringify({ok:true,base,https:url.protocol==='https:',local,checked:['CSP','HSTS','X-Content-Type-Options','Referrer-Policy','Permissions-Policy','runtime-config-cache','runtime-config-secret-markers']}));
