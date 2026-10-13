import { notificationsProduction } from './notifications-production.js';

const role=String(document.body.dataset.role||'CUSTOMER').toUpperCase();
const back=role==='PARTNER'?'/partner':'/customer';
const list=document.querySelector('#notificationList');
const unread=document.querySelector('#unreadCount');
const markAll=document.querySelector('#markAll');
const savePrefs=document.querySelector('#savePrefs');
const status=document.querySelector('#status');
document.querySelector('#backLink').href=back;

function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])}
function niceType(v=''){return String(v).replaceAll('_',' ')}
function time(v){try{return new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v))}catch{return''}}
function priorityClass(p){return p==='CRITICAL'?'critical':p==='HIGH'?'high':'normal'}
function setStatus(message,kind=''){status.textContent=message;status.className=`status ${kind}`.trim()}
function fillPreferences(p={}){for(const id of ['booking_alerts','scheduled_reminders','document_expiry','high_demand','return_load','support_updates','quiet_hours_enabled']){const el=document.querySelector(`#${id}`);if(el)el.checked=Boolean(p[id])}document.querySelector('#quiet_hours_start').value=p.quiet_hours_start||'22:00';document.querySelector('#quiet_hours_end').value=p.quiet_hours_end||'07:00'}
function renderItems(items=[]){list.innerHTML=items.map(n=>`<article class="notice ${n.status==='OPENED'?'opened':''}" data-id="${esc(n.id)}"><div class="notice-top"><span class="type">${esc(niceType(n.notification_type))}</span><span class="priority ${priorityClass(n.priority)}">${esc(n.priority)}</span></div><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><div class="meta"><span>${esc(time(n.created_at))}</span><span>${esc(n.status)}</span></div>${n.status!=='OPENED'?'<button class="openBtn" type="button">Mark read</button>':''}</article>`).join('')||'<div class="empty">No notifications yet.</div>';document.querySelectorAll('.openBtn').forEach(btn=>btn.addEventListener('click',async()=>{const card=btn.closest('[data-id]');btn.disabled=true;try{await notificationsProduction.markOpened(card.dataset.id);await load()}catch(e){setStatus(e.message,'error')}finally{btn.disabled=false}}))}
async function load(){setStatus('Refreshing…');try{const s=await notificationsProduction.snapshot();unread.textContent=String(s.unreadCount||0);fillPreferences(s.preferences||{});renderItems(s.notifications||[]);setStatus(notificationsProduction.configured?'Live notification inbox':'Demo notification inbox','ok')}catch(e){setStatus(e.message,'error');list.innerHTML='<div class="empty">Could not load notifications.</div>'}}
markAll.addEventListener('click',async()=>{markAll.disabled=true;try{const c=await notificationsProduction.markAll();setStatus(`${c||0} notification(s) marked read.`,'ok');await load()}catch(e){setStatus(e.message,'error')}finally{markAll.disabled=false}});
savePrefs.addEventListener('click',async()=>{savePrefs.disabled=true;const enabled=document.querySelector('#quiet_hours_enabled').checked;try{await notificationsProduction.setPreferences({booking_alerts:document.querySelector('#booking_alerts').checked,scheduled_reminders:document.querySelector('#scheduled_reminders').checked,document_expiry:document.querySelector('#document_expiry').checked,high_demand:document.querySelector('#high_demand').checked,return_load:document.querySelector('#return_load').checked,support_updates:document.querySelector('#support_updates').checked,quiet_hours_enabled:enabled,quiet_hours_start:enabled?document.querySelector('#quiet_hours_start').value:null,quiet_hours_end:enabled?document.querySelector('#quiet_hours_end').value:null});setStatus('Notification preferences saved.','ok')}catch(e){setStatus(e.message,'error')}finally{savePrefs.disabled=false}});
await load();
