import { loadinData } from '../shared/loadin-data.js';
import { experienceStore } from '../shared/experience-store.js';
import { validateDocumentUpload } from '../../src/platform/runtime-integrations.js';

const form=document.querySelector('#profileForm');
const checks=document.querySelector('#checks');
const statusBox=document.querySelector('#statusBox');
const submitBtn=document.querySelector('#submitReview');
const selfieInput=document.querySelector('#selfieInput');
const selfieStatus=document.querySelector('#selfieStatus');
const resetBtn=document.querySelector('#resetDemo');
const bar=document.querySelector('#bar');
const pct=document.querySelector('#pct');
const modeLine=document.querySelector('#modeLine');
let snapshot=null;

const labels={profile:'Profile & city',personalDocs:'5 personal documents',selfie:'Identity selfie',vehicle:'Vehicle profile',vehicleDocs:'5 vehicle documents',bank:'Bank proof',pricing:'Partner plan'};

function toast(message){document.querySelector('.toast')?.remove();const e=document.createElement('div');e.className='toast';e.textContent=message;document.body.appendChild(e);setTimeout(()=>e.remove(),2500)}
function readyCount(obj={}){return Object.values(obj).filter(Boolean).length}
function setProgress(obj={}){const total=7,done=readyCount(obj),percent=Math.round(done/total*100);bar.style.width=`${percent}%`;pct.textContent=`${percent}%`;return {done,total,percent}}
function formValue(name){return form.elements[name]?.value?.trim?.()||''}
function hydrateForm(s){const p=s?.profile||{},v=s?.vehicle||{};if(formValue('fullName'))return;form.elements.fullName.value=p.full_name||'';form.elements.mobile.value=p.mobile||'';form.elements.email.value=p.email||'';form.elements.cityCode.value=p.city_code||'CSN';form.elements.vehicleCategory.value=v.vehicle_category||'TATA_ACE';form.elements.registrationNumber.value=v.registration_number||'';form.elements.make.value=v.make||'';form.elements.model.value=v.model||'';form.elements.capacityKg.value=v.capacity_kg||'';form.elements.plan.value=s?.plan||'COMMISSION'}
function renderSnapshot(s){snapshot=s;const c=s?.checks||{};const progress=setProgress(c);checks.innerHTML=Object.entries(labels).map(([key,label])=>`<div class="check"><span>${label}</span><strong class="${c[key]?'done':'pending'}">${c[key]?'✓ READY':'PENDING'}</strong></div>`).join('');statusBox.innerHTML=`<div class="status-line"><span>Onboarding Status</span><strong>${s?.status||'DRAFT'}</strong></div><div class="status-line"><span>Staff Review</span><strong>${s?.staffApproved?'APPROVED':'PENDING'}</strong></div><div class="status-line"><span>Admin Decision</span><strong>${s?.adminDecision||'PENDING'}</strong></div>${s?.rejectionReason?`<p class="error">${s.rejectionReason}</p>`:''}`;submitBtn.disabled=progress.done!==progress.total||['STAFF_REVIEW','ADMIN_REVIEW','ACTIVE_OFFLINE'].includes(s?.status);submitBtn.textContent=s?.status==='ACTIVE_OFFLINE'?'Approved • Active Offline':s?.status==='STAFF_REVIEW'?'Waiting for Staff Review':s?.status==='ADMIN_REVIEW'?'Waiting for Admin Approval':'Send for Final Review';hydrateForm(s)}
async function refresh(){modeLine.textContent=loadinData.mode==='LIVE'?'LIVE backend • private documents • staff + Admin approval':'DEMO mode • no OTP subscription required';if(loadinData.mode==='DEMO'){const o=experienceStore.onboarding();const c={PROFILE:'profile',PERSONAL_DOCS:'personalDocs',SELFIE:'selfie',VEHICLE:'vehicle',VEHICLE_DOCS:'vehicleDocs',BANK:'bank',PRICING:'pricing'};const converted={profile:false,personalDocs:false,selfie:false,vehicle:false,vehicleDocs:false,bank:false,pricing:false};for(const step of o.steps){if(c[step.code])converted[c[step.code]]=step.done}renderSnapshot({...snapshot,...{partner_id:'DEMO-PARTNER',status:'DRAFT',profile:{full_name:'Demo Partner',city_code:'CSN'},vehicle:{vehicle_category:'TATA_ACE',registration_number:'MH20DEMO01'},plan:'COMMISSION',checks:converted,staffApproved:false,adminDecision:null,demo:true}});return}try{renderSnapshot(await loadinData.partnerOnboardingSnapshot())}catch(e){statusBox.innerHTML=`<p class="error">${e.message}</p>`}}

form.addEventListener('submit',async e=>{e.preventDefault();const payload={fullName:formValue('fullName'),mobile:formValue('mobile'),email:formValue('email'),cityCode:formValue('cityCode'),vehicleCategory:formValue('vehicleCategory'),registrationNumber:formValue('registrationNumber'),make:formValue('make'),model:formValue('model'),capacityKg:formValue('capacityKg')||null,plan:formValue('plan')};try{if(loadinData.mode==='DEMO'){experienceStore.completeStep('PROFILE');experienceStore.completeStep('VEHICLE');experienceStore.completeStep('PRICING');toast('Demo profile, vehicle and plan saved')}else{await loadinData.savePartnerOnboardingProfile(payload);toast('Profile, vehicle and plan saved securely')}await refresh()}catch(err){toast(err.message)}});

selfieInput.addEventListener('change',async()=>{const file=selfieInput.files?.[0];if(!file)return;const check=validateDocumentUpload(file);if(!check.ok){selfieStatus.textContent=check.errors.join(', ');return}selfieStatus.textContent='Uploading…';try{if(loadinData.mode==='DEMO'){experienceStore.completeStep('SELFIE');selfieStatus.textContent='Demo selfie ready'}else{await loadinData.uploadPartnerOnboardingSelfie(file);selfieStatus.textContent='Selfie uploaded • verification pending'}await refresh()}catch(e){selfieStatus.textContent=e.message}});

submitBtn.addEventListener('click',async()=>{try{if(loadinData.mode==='DEMO'){experienceStore.completeStep('FINAL_REVIEW');toast('Demo submitted for staff review');return refresh()}const result=await loadinData.submitPartnerOnboarding();renderSnapshot(result);toast('Submitted for staff review')}catch(e){toast(e.message)}});

resetBtn?.addEventListener('click',()=>{experienceStore.resetOnboarding();snapshot=null;refresh()});
refresh();
