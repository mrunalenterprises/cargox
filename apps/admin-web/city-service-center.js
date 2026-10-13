import { cityServiceProduction } from '../shared/city-service-production.js';

const cards=document.querySelector('#services');
const rows=document.querySelector('#configRows');
const cityTitle=document.querySelector('#cityTitle');
const statusBox=document.querySelector('#saveStatus');
const state={cityCode:'CSN',snapshot:null,busy:false};
const defaults={PARCEL_2W:{base:35,commission:15},LOADING_VEHICLE:{base:180,commission:15},HELPER:{base:250,commission:15},FULL_SHIFTING:{base:999,commission:15}};
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function statusClass(s){return s==='ACTIVE'?'':s==='COMING_SOON'?'soon':'off'}
function label(s){if(s==='ACTIVE')return 'Bookings enabled';if(s==='COMING_SOON')return 'Customers see Coming Soon';if(s==='PAUSED')return 'Temporarily paused';return 'Disabled'}
function setMessage(text,kind='info'){statusBox.textContent=text;statusBox.className=`notice ${kind}`;statusBox.hidden=!text}
function setBusy(v){state.busy=Boolean(v);document.querySelectorAll('[data-save]').forEach(b=>b.disabled=state.busy)}
function render(){const snap=state.snapshot;if(!snap)return;cityTitle.textContent=snap.city?.name||snap.city?.code||state.cityCode;cards.innerHTML=snap.services.map(s=>`<div class="svc"><b>${esc(s.name)}</b><p><span class="pill ${statusClass(s.status)}">${esc(s.status)}</span></p><small>${esc(label(s.status))}</small></div>`).join('');rows.innerHTML=snap.services.map(s=>{const d=defaults[s.code]||{base:0,commission:15};return `<div class="row" data-service="${esc(s.code)}"><div><b>${esc(s.name)}</b><small>${esc(s.code)}</small></div><select data-status aria-label="${esc(s.name)} status"><option ${s.status==='ACTIVE'?'selected':''}>ACTIVE</option><option ${s.status==='COMING_SOON'?'selected':''}>COMING_SOON</option><option ${s.status==='PAUSED'?'selected':''}>PAUSED</option><option ${s.status==='DISABLED'?'selected':''}>DISABLED</option></select><input value="${d.base}" readonly aria-label="base fare reference"><input value="${d.commission}%" readonly aria-label="commission rule"><input data-reason maxlength="160" placeholder="Reason / note"><button data-save="${esc(s.code)}">Save Status</button></div>`}).join('');document.querySelectorAll('[data-save]').forEach(b=>b.addEventListener('click',()=>saveRow(b.closest('[data-service]'))))}
async function load(){setMessage('Loading city controls…');try{state.snapshot=await cityServiceProduction.snapshot(state.cityCode);render();setMessage(cityServiceProduction.configured?'Live city/service controls loaded.':'Demo controls loaded.','ok')}catch(e){setMessage(e.message,'err')}}
async function saveRow(row){if(!row||state.busy)return;const serviceCode=row.dataset.service,status=row.querySelector('[data-status]').value,reason=row.querySelector('[data-reason]').value.trim();setBusy(true);setMessage(`Saving ${serviceCode}…`);try{await cityServiceProduction.setStatus({cityCode:state.cityCode,serviceCode,status,reason});state.snapshot=await cityServiceProduction.snapshot(state.cityCode);render();setMessage(`${serviceCode} updated to ${status}. Change is server-audited.`,'ok')}catch(e){setMessage(e.message,'err')}finally{setBusy(false)}}
await load();
