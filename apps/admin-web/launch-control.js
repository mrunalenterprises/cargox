import { launchProduction } from '../shared/launch-production.js';

const $=s=>document.querySelector(s);
const els={city:$('#city'),refresh:$('#refresh'),gateBadge:$('#gateBadge'),message:$('#message'),dynamic:$('#dynamicChecks'),manual:$('#manualChecks'),releaseLabel:$('#releaseLabel'),commitSha:$('#commitSha'),releaseNotes:$('#releaseNotes'),createSignoff:$('#createSignoff'),signoffs:$('#signoffs')};
let snapshot=null;
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])}
function fmt(v){if(v===null||v===undefined)return '—';if(typeof v==='object')return Object.entries(v).map(([k,x])=>`${k}: ${x}`).join(' • ');return String(v)}
function pill(status){const s=String(status||'PENDING').toUpperCase();return `<span class="pill ${s.toLowerCase()}">${esc(s)}</span>`}
function setMessage(text,type=''){els.message.className=`msg ${type}`.trim();els.message.textContent=text}
function setBusy(v){[els.refresh,els.createSignoff].forEach(x=>x.disabled=Boolean(v));document.querySelectorAll('[data-launch-action],[data-signoff-action]').forEach(x=>x.disabled=Boolean(v))}

function render(){
  if(!snapshot)return;
  const ready=Boolean(snapshot.releaseReady);
  els.gateBadge.className=`badge ${ready?'ready':'blocked'}`;
  els.gateBadge.textContent=ready?'READY FOR SUPER ADMIN APPROVAL':'BLOCKED';
  setMessage(ready?'All current launch gates are satisfied. Create/approve a release sign-off only after confirming the intended commit and deployment.':`Launch blocked. Fix failing dynamic checks and complete required external/E2E evidence.`,ready?'ok':'bad');
  els.dynamic.innerHTML=(snapshot.checks||[]).map(c=>`<div class="check"><div><strong>${esc(c.label||c.key)}</strong><div><small>${esc(fmt(c.value))}</small></div></div>${pill(c.status)}</div>`).join('')||'<p class="muted">No dynamic checks returned.</p>';
  const canMutate=snapshot.role==='SUPER_ADMIN'||snapshot.role==='DEMO';
  els.manual.innerHTML=(snapshot.manualChecks||[]).map(c=>`<div class="manual"><div class="manual-head"><div><strong>${esc(c.label||c.key)}</strong><div class="muted">${esc(c.category||'EXTERNAL')} • ${esc(c.key)}</div></div>${pill(c.status)}</div>${canMutate?`<div class="manual-actions"><select class="select" data-status-for="${esc(c.key)}"><option ${c.status==='PENDING'?'selected':''}>PENDING</option><option ${c.status==='PASS'?'selected':''}>PASS</option><option ${c.status==='FAIL'?'selected':''}>FAIL</option><option ${c.status==='WAIVED'?'selected':''}>WAIVED</option></select><input class="input" data-evidence-for="${esc(c.key)}" value="${esc(c.evidence||'')}" placeholder="Evidence / reason"><button class="btn alt" data-launch-action="${esc(c.key)}">Save</button></div>`:`<p class="muted">Read-only for role ${esc(snapshot.role||'UNKNOWN')}.</p>`}</div>`).join('')||'<p class="muted">No manual checks configured.</p>';
  els.signoffs.innerHTML=(snapshot.signoffs||[]).map(s=>`<div class="signoff"><div><strong>${esc(s.releaseLabel||s.release_label||s.id)}</strong><div class="muted">${esc(s.commitSha||s.commit_sha||'No commit')} • ${esc(s.createdAt||s.created_at||'')}</div></div><div>${pill(s.status)}</div><div class="muted">${esc(s.cityCode||s.city_code||'')}</div><div>${canMutate&&s.status!=='APPROVED'&&s.status!=='REVOKED'?`<button class="btn" data-signoff-action="approve" data-id="${esc(s.id)}">Approve</button>`:''}${canMutate&&s.status!=='REVOKED'?` <button class="btn red" data-signoff-action="revoke" data-id="${esc(s.id)}">Revoke</button>`:''}</div></div>`).join('')||'<p class="muted">No release sign-offs yet.</p>';
  document.querySelectorAll('[data-launch-action]').forEach(btn=>btn.addEventListener('click',()=>saveManual(btn.dataset.launchAction)));
  document.querySelectorAll('[data-signoff-action]').forEach(btn=>btn.addEventListener('click',()=>signoffAction(btn.dataset.id,btn.dataset.signoffAction)));
}

async function sync(){setBusy(true);try{snapshot=await launchProduction.snapshot(els.city.value);render()}catch(e){setMessage(`Launch gate sync failed: ${e.message}`,'bad')}finally{setBusy(false)}}
async function saveManual(key){const status=document.querySelector(`[data-status-for="${CSS.escape(key)}"]`)?.value||'PENDING';const evidence=document.querySelector(`[data-evidence-for="${CSS.escape(key)}"]`)?.value||'';setBusy(true);try{await launchProduction.setManualCheck({key,status,evidence});await sync()}catch(e){setMessage(e.message,'bad');setBusy(false)}}
async function createSignoff(){const releaseLabel=els.releaseLabel.value.trim();if(!releaseLabel){setMessage('Release label is required.','bad');return}setBusy(true);try{await launchProduction.createSignoff({releaseLabel,commitSha:els.commitSha.value.trim(),cityCode:els.city.value,notes:els.releaseNotes.value.trim()});els.releaseLabel.value='';els.releaseNotes.value='';await sync()}catch(e){setMessage(e.message,'bad');setBusy(false)}}
async function signoffAction(id,action){setBusy(true);try{if(action==='approve')await launchProduction.approveSignoff(id,'Approved from Launch Control Center');else await launchProduction.revokeSignoff(id,'Revoked from Launch Control Center');await sync()}catch(e){setMessage(e.message,'bad');setBusy(false)}}

els.refresh.addEventListener('click',sync);els.city.addEventListener('change',sync);els.createSignoff.addEventListener('click',createSignoff);sync();
