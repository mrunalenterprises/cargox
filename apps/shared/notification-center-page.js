import { notificationsProduction } from './notifications-production.js';
import { pushProduction } from './push-production.js';

const role=String(document.body.dataset.role||'CUSTOMER').toUpperCase();
const back=role==='PARTNER'?'/partner':'/customer';
const list=document.querySelector('#notificationList');
const unread=document.querySelector('#unreadCount');
const markAll=document.querySelector('#markAll');
const savePrefs=document.querySelector('#savePrefs');
const status=document.querySelector('#status');
document.querySelector('#backLink').href=back;

const pushBox=document.createElement('div');
pushBox.style.cssText='margin-top:14px;padding:13px;border:1px solid #e6edf4;border-radius:14px;background:#f8fbfe';
pushBox.innerHTML='<strong>Device Alerts</strong><p id="pushState" style="margin:6px 0;color:#68798b;font-size:13px">Checking push status…</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="enablePush" class="openBtn" type="button">Enable device alerts</button><button id="disablePush" class="openBtn" type="button" style="display:none">Disable this device</button></div>';
status.parentElement.insertBefore(pushBox,status);
const pushState=pushBox.querySelector('#pushState');
const enablePush=pushBox.querySelector('#enablePush');
const disablePush=pushBox.querySelector('#disablePush');

function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])}
function niceType(v=''){return String(v).replaceAll('_',' ')}
function time(v){try{return new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v))}catch{return''}}
function priorityClass(p){return p==='CRITICAL'?'critical':p==='HIGH'?'high':'normal'}
function setStatus(message,kind=''){status.textContent=message;status.className=`status ${kind}`.trim()}
function fillPreferences(p={}){for(const id of ['booking_alerts','scheduled_reminders','document_expiry','high_demand','return_load','support_updates','quiet_hours_enabled']){const el=document.querySelector(`#${id}`);if(el)el.checked=Boolean(p[id])}document.querySelector('#quiet_hours_start').value=p.quiet_hours_start||'22:00';document.querySelector('#quiet_hours_end').value=p.quiet_hours_end||'07:00'}
function renderItems(items=[]){list.innerHTML=items.map(n=>`<article class="notice ${n.status==='OPENED'?'opened':''}" data-id="${esc(n.id)}"><div class="notice-top"><span class="type">${esc(niceType(n.notification_type))}</span><span class="priority ${priorityClass(n.priority)}">${esc(n.priority)}</span></div><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><div class="meta"><span>${esc(time(n.created_at))}</span><span>${esc(n.status)}</span></div>${n.status!=='OPENED'?'<button class="openBtn" type="button">Mark read</button>':''}</article>`).join('')||'<div class="empty">No notifications yet.</div>';document.querySelectorAll('.openBtn').forEach(btn=>{if(btn.id==='enablePush'||btn.id==='disablePush')return;btn.addEventListener('click',async()=>{const card=btn.closest('[data-id]');if(!card)return;btn.disabled=true;try{await notificationsProduction.markOpened(card.dataset.id);await load()}catch(e){setStatus(e.message,'error')}finally{btn.disabled=false}})})}
async function load(){setStatus('Refreshing…');try{const s=await notificationsProduction.snapshot();unread.textContent=String(s.unreadCount||0);fillPreferences(s.preferences||{});renderItems(s.notifications||[]);setStatus(notificationsProduction.configured?'Live notification inbox':'Demo notification inbox','ok')}catch(e){setStatus(e.message,'error');list.innerHTML='<div class="empty">Could not load notifications.</div>'}}
async function loadPush(){try{const s=await pushProduction.status();if(s.demo){pushState.textContent='Demo mode: device push stays off until live Supabase + Firebase Web Push config is supplied.';enablePush.disabled=true;disablePush.style.display='none';return}if(!s.configured){pushState.textContent='Firebase Web Push configuration is pending. Inbox notifications still work.';enablePush.disabled=true;disablePush.style.display='none';return}pushState.textContent=s.active?`This browser is registered for FCM alerts • permission ${s.permission}.`:`This browser is not registered • permission ${s.permission}.`;enablePush.disabled=Boolean(s.active)||s.permission==='denied';enablePush.style.display=s.active?'none':'inline-block';disablePush.style.display=s.active?'inline-block':'none'}catch(e){pushState.textContent=`Push status unavailable: ${e.message}`}}
markAll.addEventListener('click',async()=>{markAll.disabled=true;try{const c=await notificationsProduction.markAll();setStatus(`${c||0} notification(s) marked read.`,'ok');await load()}catch(e){setStatus(e.message,'error')}finally{markAll.disabled=false}});
savePrefs.addEventListener('click',async()=>{savePrefs.disabled=true;const enabled=document.querySelector('#quiet_hours_enabled').checked;try{await notificationsProduction.setPreferences({booking_alerts:document.querySelector('#booking_alerts').checked,scheduled_reminders:document.querySelector('#scheduled_reminders').checked,document_expiry:document.querySelector('#document_expiry').checked,high_demand:document.querySelector('#high_demand').checked,return_load:document.querySelector('#return_load').checked,support_updates:document.querySelector('#support_updates').checked,quiet_hours_enabled:enabled,quiet_hours_start:enabled?document.querySelector('#quiet_hours_start').value:null,quiet_hours_end:enabled?document.querySelector('#quiet_hours_end').value:null});setStatus('Notification preferences saved.','ok')}catch(e){setStatus(e.message,'error')}finally{savePrefs.disabled=false}});
enablePush.addEventListener('click',async()=>{enablePush.disabled=true;try{setStatus('Registering this browser for secure device alerts…');await pushProduction.enable();setStatus('Device alerts enabled for this browser.','ok');await loadPush()}catch(e){setStatus(`Could not enable device alerts: ${e.message}`,'error');await loadPush()}});
disablePush.addEventListener('click',async()=>{disablePush.disabled=true;try{await pushProduction.disable();setStatus('Device alerts disabled for this browser.','ok');await loadPush()}catch(e){setStatus(`Could not disable device alerts: ${e.message}`,'error')}finally{disablePush.disabled=false}});
globalThis.addEventListener('loadin:push',async()=>{setStatus('New device alert received.','ok');await load()});
await Promise.all([load(),loadPush()]);
