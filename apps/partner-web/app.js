import { loadinData } from '../shared/loadin-data.js';

const screen=document.querySelector('#screen');
const nav=[...document.querySelectorAll('.nav')];
const state={route:'home',online:false,job:null,acceptedJobs:[],earningsToday:1680,commissionBalance:920,earningsBalance:4850,qualityScore:92,plan:'COMMISSION',backend:loadinData.configured?'READY':'DEMO'};
const demoJob={id:'LDN-482731',service:'Loading Vehicle',vehicle:'Tata Ace',pickup:'Cidco, Sambhaji Nagar',drop:'Waluj MIDC',distanceToPickupKm:2.8,tripDistanceKm:14.6,customerFare:620,partnerEarning:527,scheduled:false,returnLoad:false,replacement:false,expiresInSec:20};

function money(v){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(v)}
function toast(m){document.querySelector('.toast')?.remove();const e=document.createElement('div');e.className='toast';e.textContent=m;document.body.appendChild(e);setTimeout(()=>e.remove(),2300)}
function setRoute(route){state.route=route;nav.forEach(n=>n.classList.toggle('active',n.dataset.route===route));render()}
nav.forEach(n=>n.addEventListener('click',()=>setRoute(n.dataset.route)));
function render(){if(state.route==='home')return renderHome();if(state.route==='jobs')return renderJobs();if(state.route==='earnings')return renderEarnings();return renderAccount()}

async function syncPartnerData(){
  if(!loadinData.configured)return;
  try{
    const [bookings,offers]=await Promise.all([loadinData.partnerBookings(),loadinData.partnerOffers()]);
    state.acceptedJobs=bookings.map(b=>({id:b.id,service:b.service_code,pickup:b.pickup_address,drop:b.drop_address,partnerEarning:Math.round(Number(b.locked_fare||0)*.85),status:b.status}));
    const first=offers[0];
    if(first){state.job={...demoJob,id:first.booking_id,expiresInSec:20};}
  }catch(error){toast(`Live sync failed: ${error.message}`)}
}

function renderHome(){screen.innerHTML=`
<section class="status-card"><div class="status-head"><div><span class="eyebrow">PARTNER STATUS</span><h1>${state.online?'You are Online':'You are Offline'}</h1></div><button id="onlineToggle" class="online-toggle ${state.online?'online':''}">${state.online?'ONLINE':'GO ONLINE'}</button></div><div class="status-grid"><div class="status-stat"><small>Today Earnings</small><strong>${money(state.earningsToday)}</strong></div><div class="status-stat"><small>Quality Score</small><strong>${state.qualityScore}/100</strong></div><div class="status-stat"><small>Backend</small><strong>${state.backend}</strong></div></div></section>
<div class="section-title"><div><span class="eyebrow" style="color:#ff7a00">WALLET & PLAN</span><h2>Your partner account</h2></div><small>${state.plan==='COMMISSION'?'15% commission':'0% commission'}</small></div>
<section class="metrics"><article class="metric-card"><small>Commission Balance</small><strong class="${state.commissionBalance<300?'warn':'good'}">${money(state.commissionBalance)}</strong></article><article class="metric-card"><small>Earnings Balance</small><strong>${money(state.earningsBalance)}</strong></article><article class="metric-card"><small>Partner Plan</small><strong>${state.plan==='COMMISSION'?'Commission':'Subscription'}</strong></article><article class="metric-card"><small>Payout Status</small><strong class="good">Eligible</strong></article></section>
<div class="section-title"><div><span class="eyebrow" style="color:#ff7a00">INCOMING JOB</span><h2>${state.online?'Ready for bookings':'Go online to receive jobs'}</h2></div><small>${state.online?'20 sec response':''}</small></div>
<div id="jobSlot">${state.online?jobCard(state.job||demoJob):'<section class="panel"><p class="hint">Complete identity selfie and valid documents are required before going online.</p></section>'}</div>`;

document.querySelector('#onlineToggle').addEventListener('click',async()=>{const next=!state.online;if(loadinData.configured){try{await loadinData.setPartnerOnline(next)}catch(error){toast(error.message==='login_required'?'Partner login required for live online status.':`Could not update live status: ${error.message}`);return}}state.online=next;toast(state.online?'You are now online. Booking alerts enabled.':'You are offline. New booking alerts paused.');renderHome()});
wireJobActions();
}

function jobCard(job){return `<article class="job-card" data-job-card><div class="job-top"><div><span class="badge">${job.replacement?'REPLACEMENT':job.returnLoad?'RETURN LOAD':job.scheduled?'SCHEDULED':'BOOK NOW'}</span><h3>${job.service}</h3><small>${job.vehicle}</small></div><div class="earning"><small>YOUR EARNING</small>${money(job.partnerEarning)}</div></div><div class="route"><strong>Pickup:</strong> ${job.pickup}<br><strong>Drop:</strong> ${job.drop}</div><div class="job-meta"><span>${job.distanceToPickupKm} km to pickup</span><span>${job.tripDistanceKm} km trip</span><span>Customer fare ${money(job.customerFare)}</span></div><div class="countdown"><i id="countdownBar"></i></div><div class="job-actions"><button class="decline" data-decline>Decline</button><button class="accept" data-accept>Accept Job</button></div></article>`}

function wireJobActions(){const accept=document.querySelector('[data-accept]');const decline=document.querySelector('[data-decline]');if(!accept||!decline)return;accept.addEventListener('click',()=>{const source=state.job||demoJob;state.acceptedJobs.unshift({...source,status:'ACCEPTED'});toast(loadinData.configured?'Job accepted in UI; server-side atomic acceptance endpoint is next.':'Job accepted in demo mode.');document.querySelector('[data-job-card]')?.remove()});decline.addEventListener('click',()=>{toast('Job declined before acceptance.');document.querySelector('[data-job-card]')?.remove()});let left=20;const bar=document.querySelector('#countdownBar');const timer=setInterval(()=>{left-=1;if(bar)bar.style.width=`${Math.max(0,left/20*100)}%`;if(left<=0){clearInterval(timer);if(document.body.contains(accept))toast('Booking alert expired and moved to next eligible partner.')}},1000)}

function renderJobs(){const rows=state.acceptedJobs.length?state.acceptedJobs.map(j=>`<div class="list-row"><div><strong>${j.service}</strong><small>${j.pickup||''} → ${j.drop||''}</small></div><div><strong>${money(j.partnerEarning||0)}</strong><small>${j.status}</small></div></div>`).join(''):`<p class="hint">No assigned jobs yet.</p>`;screen.innerHTML=`<span class="eyebrow" style="color:#ff7a00">JOBS</span><h1>My Jobs</h1><section class="panel">${rows}</section>`}
function renderEarnings(){screen.innerHTML=`<span class="eyebrow" style="color:#ff7a00">EARNINGS</span><h1>Money & settlement</h1><section class="metrics"><article class="metric-card"><small>Today Earnings</small><strong>${money(state.earningsToday)}</strong></article><article class="metric-card"><small>Available Payout</small><strong>${money(state.earningsBalance)}</strong></article><article class="metric-card"><small>Commission Balance</small><strong>${money(state.commissionBalance)}</strong></article><article class="metric-card"><small>Current Plan</small><strong>${state.plan}</strong></article></section><section class="panel"><p class="hint">Live partner ledger endpoint is wired in the shared data layer and will populate after authenticated production configuration.</p></section>`}
function renderAccount(){const session=loadinData.session();screen.innerHTML=`<span class="eyebrow" style="color:#ff7a00">ACCOUNT</span><h1>Partner profile</h1><section class="panel"><div class="list-row"><div><strong>Backend</strong><small>Supabase connection layer</small></div><strong>${loadinData.configured?'Configured':'Demo'}</strong></div><div class="list-row"><div><strong>Session</strong><small>Required for own availability/offers</small></div><strong>${session?'Signed in':'Not signed in'}</strong></div></section>`}

await syncPartnerData();
render();