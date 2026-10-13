import { adminStaffProduction } from '../shared/admin-staff-production.js';
import { adminRolePermissions } from '../shared/readiness-ops.js';

const roleCards=document.querySelector('#roles');
const staffRows=document.querySelector('#staffRows');
const auditRows=document.querySelector('#auditRows');
const msg=document.querySelector('#msg');
const form=document.querySelector('#staffForm');
const userId=document.querySelector('#userId');
const displayName=document.querySelector('#displayName');
const role=document.querySelector('#role');
const cityCode=document.querySelector('#cityCode');
const active=document.querySelector('#active');
const reason=document.querySelector('#reason');
const refresh=document.querySelector('#refresh');
const submit=document.querySelector('#submit');
const scope=document.querySelector('#scope');
const state={snapshot:null,busy:false};
const uuidRe=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function when(v){if(!v)return '—';try{return new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v))}catch{return String(v)}}
function setMsg(text,kind=''){msg.textContent=text;msg.className=`notice ${kind}`;msg.hidden=!text}
function setBusy(v){state.busy=Boolean(v);submit.disabled=state.busy;refresh.disabled=state.busy}
function renderRoles(){const visible=state.snapshot?.role==='GM'?['GM','FIELD_OFFICER']:['SUPER_ADMIN','GM','ACCOUNTS','FIELD_OFFICER'];roleCards.innerHTML=visible.map(r=>{const x=adminRolePermissions(r);return `<article class="card"><span class="pill">${esc(r)}</span><h2>${x.permissions.length} permissions</h2><div>${x.permissions.map(p=>`<span class="perm">${esc(p)}</span>`).join('')}</div></article>`}).join('')}
function editStaff(s){userId.value=s.user_id||'';displayName.value=s.display_name||'';role.value=s.role||'FIELD_OFFICER';cityCode.value=s.city_code||'';active.checked=s.is_active!==false;reason.value='Update staff access';userId.scrollIntoView({behavior:'smooth',block:'center'})}
function renderStaff(){const rows=state.snapshot?.staff||[];staffRows.innerHTML=rows.map(s=>`<div class="staff-row"><div><strong>${esc(s.display_name||'Staff Member')}</strong><small>${esc(s.user_id)}</small></div><span class="pill">${esc(s.role)}</span><span>${esc(s.city_code||'All cities')}</span><span class="status ${s.is_active?'ok':'off'}">${s.is_active?'ACTIVE':'INACTIVE'}</span><button class="edit" data-edit="${esc(s.user_id)}" ${s.can_edit?'':'disabled'}>Edit</button></div>`).join('')||'<p class="muted">No staff in this scope.</p>';document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{const s=rows.find(x=>x.user_id===b.dataset.edit);if(s)editStaff(s)})}
function renderAudit(){const rows=state.snapshot?.audit||[];auditRows.innerHTML=rows.map(a=>`<div class="log"><div><strong>${esc(a.action)}</strong><small>${esc(a.reason||'')}</small></div><span>${esc(a.actor_name||a.actor_user_id)}</span><span>${esc(a.actor_role)}</span><span>${esc(`${a.entity_type} • ${a.entity_id}`)}</span><span>${esc(when(a.created_at))}</span></div>`).join('')||'<p class="muted">No audit events yet.</p>'}
function configureForm(){const r=state.snapshot?.role||'SUPER_ADMIN';scope.textContent=r==='SUPER_ADMIN'?'Super Admin • all-city staff control':`GM • ${state.snapshot?.cityCode||'assigned city'} • Field Officer management only`;if(r==='GM'){role.innerHTML='<option value="FIELD_OFFICER">FIELD_OFFICER</option>';role.value='FIELD_OFFICER';cityCode.value=state.snapshot?.cityCode||'';cityCode.readOnly=true}else{role.innerHTML=['SUPER_ADMIN','GM','ACCOUNTS','FIELD_OFFICER'].map(x=>`<option>${x}</option>`).join('');cityCode.readOnly=false}}
function render(){renderRoles();renderStaff();renderAudit();configureForm()}
async function sync(){setBusy(true);setMsg('Loading secure staff scope…');try{state.snapshot=await adminStaffProduction.snapshot();render();setMsg(adminStaffProduction.configured?'Live staff and audit data loaded.':'Demo staff data loaded.','ok')}catch(e){setMsg(e.message,'err')}finally{setBusy(false)}}
form.addEventListener('submit',async e=>{e.preventDefault();if(state.busy)return;const id=userId.value.trim();if(adminStaffProduction.configured&&!uuidRe.test(id)){setMsg('Enter the authenticated user UUID created by Phone OTP sign-in.','err');return}if(!id){setMsg('User ID is required.','err');return}const selectedRole=role.value;const city=selectedRole==='SUPER_ADMIN'?null:cityCode.value.trim().toUpperCase();if(selectedRole!=='SUPER_ADMIN'&&!city){setMsg('City code is required for this role.','err');return}setBusy(true);setMsg('Saving staff access…');try{await adminStaffProduction.upsert({userId:id,displayName:displayName.value.trim(),role:selectedRole,cityCode:city,isActive:active.checked,reason:reason.value.trim()||'Staff access update'});form.reset();active.checked=true;state.snapshot=await adminStaffProduction.snapshot();render();setMsg('Staff access saved and audit logged.','ok')}catch(err){setMsg(err.message,'err')}finally{setBusy(false)}});
refresh.addEventListener('click',sync);
await sync();
