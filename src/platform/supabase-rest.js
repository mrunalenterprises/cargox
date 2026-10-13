function trimSlash(value=''){return String(value).replace(/\/+$/,'')}

export function createSupabaseRestClient({url,anonKey,fetchImpl=globalThis.fetch,storage=globalThis.localStorage}={}){
  const base=trimSlash(url);
  const key=String(anonKey||'').trim();
  const configured=Boolean(base&&key&&typeof fetchImpl==='function');
  const sessionKey='loadin.supabase.session';
  let memorySession=null;

  function readSession(){
    if(memorySession)return memorySession;
    try{const raw=storage?.getItem?.(sessionKey);if(raw)memorySession=JSON.parse(raw)}catch{}
    return memorySession;
  }
  function saveSession(session){
    memorySession=session||null;
    try{if(session)storage?.setItem?.(sessionKey,JSON.stringify(session));else storage?.removeItem?.(sessionKey)}catch{}
    return memorySession;
  }
  function accessToken(){return readSession()?.access_token||null}
  function authHeaders(extra={}){
    const token=accessToken();
    return {'apikey':key,'Authorization':`Bearer ${token||key}`,...extra};
  }
  function headers(extra={}){return authHeaders({'Content-Type':'application/json',...extra})}
  async function parseResponse(res){
    const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
    if(!res.ok){const err=new Error(data?.message||data?.error_description||data?.error||`http_${res.status}`);err.status=res.status;err.data=data;throw err}
    return data;
  }
  async function request(path,{method='GET',body,extraHeaders}={}){
    if(!configured)throw new Error('supabase_not_configured');
    const res=await fetchImpl(`${base}${path}`,{method,headers:headers(extraHeaders),body:body===undefined?undefined:JSON.stringify(body)});
    return parseResponse(res);
  }
  async function sendOtp(phone){return request('/auth/v1/otp',{method:'POST',body:{phone}})}
  async function verifyOtp({phone,token,type='sms'}){
    const data=await request('/auth/v1/verify',{method:'POST',body:{phone,token,type}});if(data?.access_token)saveSession(data);return data;
  }
  async function refreshSession(){const refresh_token=readSession()?.refresh_token;if(!refresh_token)throw new Error('refresh_token_missing');const data=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token}});saveSession(data);return data}
  async function getUser(){return request('/auth/v1/user')}
  function signOutLocal(){saveSession(null)}
  async function select(table,{select='*',filters={},order,limit}={}){
    const qs=new URLSearchParams({select});
    Object.entries(filters).forEach(([k,v])=>{if(v!==undefined&&v!==null)qs.set(k,String(v))});
    if(order)qs.set('order',order);if(limit)qs.set('limit',String(limit));
    return request(`/rest/v1/${encodeURIComponent(table)}?${qs}`);
  }
  async function insert(table,row,{returning='representation'}={}){
    return request(`/rest/v1/${encodeURIComponent(table)}`,{method:'POST',body:row,extraHeaders:{Prefer:`return=${returning}`}});
  }
  async function update(table,patch,filters={}){
    const qs=new URLSearchParams();Object.entries(filters).forEach(([k,v])=>qs.set(k,String(v)));
    return request(`/rest/v1/${encodeURIComponent(table)}?${qs}`,{method:'PATCH',body:patch,extraHeaders:{Prefer:'return=representation'}});
  }
  async function rpc(functionName,args={}){
    return request(`/rest/v1/rpc/${encodeURIComponent(functionName)}`,{method:'POST',body:args});
  }
  async function uploadObject(bucket,path,body,{contentType='application/octet-stream',upsert=false}={}){
    if(!configured)throw new Error('supabase_not_configured');
    if(!accessToken())throw new Error('login_required');
    const safeBucket=encodeURIComponent(String(bucket||''));
    const safePath=String(path||'').split('/').filter(Boolean).map(encodeURIComponent).join('/');
    if(!safeBucket||!safePath)throw new Error('storage_path_required');
    const res=await fetchImpl(`${base}/storage/v1/object/${safeBucket}/${safePath}`,{
      method:'POST',
      headers:authHeaders({'Content-Type':contentType,'x-upsert':upsert?'true':'false'}),
      body
    });
    return parseResponse(res);
  }
  return {configured,readSession,saveSession,accessToken,sendOtp,verifyOtp,refreshSession,getUser,signOutLocal,select,insert,update,rpc,uploadObject};
}
