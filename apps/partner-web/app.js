const screen=document.querySelector('#screen');
const nav=[...document.querySelectorAll('.nav')];

const state={route:'home',online:false,job:null,acceptedJobs:[],earningsToday:1680,commissionBalance:920,earningsBalance:4850,qualityScore:92,plan:'COMMISSION'};

const demoJob={id:'LDN-482731',service:'Loading Vehicle',vehicle:'Tata Ace',pickup:'Cidco, Sambhaji Nagar',drop:'Waluj MIDC',distanceToPickupKm:2.8,tripDistanceKm:14.6,customerFare:620,partnerEarning:527,scheduled:false,returnLoad:false,replacement:false,expiresInSec:20};

function money(v){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(v)}
function toast(m){document.querySelector('.toast')?.remove();const e=document.createElement('div');e.className='toast';e.textContent=m;document.body.append(e);setTimeout(()=>e.remove(),2300)}
function setRoute(route){state.route=route;nav.forEach(n=>n.classList.toggle('active',n.dataset.route===route));render()}
nav.forEach(n=>n.addEventListener('click',()=>setRoute(n.dataset.route)));

function render(){if(state.route==='home')return renderHome();if(state.route==='jobs')return renderJobs();if(state.route==='earnings')return renderEarnings();return renderAccount()}

function renderHome(){screen.innerHTML=`
<section class="status-card">
  <div class="status-head"><div><span class="eyebrow">PARTNER STATUS</span><h1>${state.online?'You are Online':'You are Offline'}</h1></div><button id="onlineToggle" class="online-toggle ${state.online?'online':''}">${state.online?'ONLINE':'GO ONLINE'}</button></div>
  <div class="status-grid">
    <div class="status-stat"><small>Today Earnings</small><strong>${money(state.earningsToday)}</strong></div>
    <div class="status-stat"><small>Quality Score</small><strong>${state.qualityScore}/100</strong></div>
    <div class="status-stat"><small>Priority</small><strong>${state.qualityScore>=90?'HIGH':'NORMAL'}</strong></div>
  </div>
</section>

<div class="section-title"><div><span class="eyebrow" style="color:#ff7a00">WALLET & PLAN</span><h2>Your partner account</h2></div><small>${state.plan==='COMMISSION'?'15% commission':'0% commission'}</small></div>
<section class="metrics">
  <article class="metric-card"><small>Commission Balance</small><strong class="${state.commissionBalance<300?'warn':'good'}">${money(state.commissionBalance)}</strong></article>
  <article class="metric-card"><small>Earnings Balance</small><strong>${money(state.earningsBalance)}</strong></article>
  <article class="metric-card"><small>Partner Plan</small><strong>${state.plan==='COMMISSION'?'Commission':'Subscription'}</strong></article>
  <article class="metric-card"><small>Payout Status</small><strong class="good">Eligible</strong></article>
</section>

<div class="section-title"><div><span class="eyebrow" style="color:#ff7a00">QUALITY</span><h2>Performance health</h2></div><small>Keep it above 90</small></div>
<section class="panel quality">
  <div class="quality-score"><strong>${state.qualityScore}</strong></div>
  <div><strong>${state.qualityScore>=90?'Excellent partner performance':'Improve to unlock higher priority'}</strong><p class="hint">Strong on-time completion, low cancellations and good customer feedback increase booking priority.</p></div>
</section>

<div class="section-title"><div><span class="eyebrow" style="color:#ff7a00">INCOMING JOB</span><h2>${state.online?'Ready for bookings':'Go online to receive jobs'}</h2></div><small>${state.online?'20 sec response':''}</small></div>
<div id="jobSlot">${state.online?jobCard(demoJob):'<section class="panel"><p class="hint">Complete identity selfie and valid documents are required before going online. New job alerts use high-priority sound and vibration.</p></section>'}</div>`;

document.querySelector('#onlineToggle').addEventListener('click',()=>{state.online=!state.online;toast(state.online?'You are now online. Booking alerts enabled.':'You are offline. New booking alerts paused.');renderHome()});
wireJobActions();
}

function jobCard(job){return `<article class="job-card" data-job-card>
  <div class="job-top"><div><span class="badge">${job.replacement?'REPLACEMENT':job.returnLoad?'RETURN LOAD':job.scheduled?'SCHEDULED':'BOOK NOW'}</span><h3>${job.service}</h3><small>${job.vehicle}</small></div><div class="earning"><small>YOUR EARNING</small>${money(job.partnerEarning)}</div></div>
  <div class="route"><strong>Pickup:</strong> ${job.pickup}<br><strong>Drop:</strong> ${job.drop}</div>
  <div class="job-meta"><span>${job.distanceToPickupKm} km to pickup</span><span>${job.tripDistanceKm} km trip</span><span>Customer fare ${money(job.customerFare)}</span></div>
  <div class="countdown"><i id="countdownBar"></i></div>
  <div class="job-actions"><button class="decline" data-decline>Decline</button><button class="accept" data-accept>Accept Job</button></div>
</article>`}

function wireJobActions(){const accept=document.querySelector('[data-accept]');const decline=document.querySelector('[data-decline]');if(!accept||!decline)return;accept.addEventListener('click',()=>{state.acceptedJobs.unshift({...demoJob,status:'ACCEPTED'});toast('Job accepted. Navigate to pickup and follow OTP/proof flow.');document.querySelector('[data-job-card]').remove()});decline.addEventListener('click',()=>{toast('Job declined before acceptance. Small/no penalty applied.');document.querySelector('[data-job-card]').remove()});let left=20;const bar=document.querySelector('#countdownBar');const timer=setInterval(()=>{left-=1;if(bar)bar.style.width=`${Math.max(0,left/20*100)}%`;if(left<=0){clearInterval(timer);if(document.body.contains(accept))toast('Booking alert expired and moved to next eligible partner.')}},1000)}

function renderJobs(){const rows=state.acceptedJobs.length?state.acceptedJobs.map(j=>`<div class="list-row"><div><strong>${j.service}</strong><small>${j.pickup} → ${j.drop}</small></div><div><strong>${money(j.partnerEarning)}</strong><small>${j.status}</small></div></div>`).join(''):`<p class="hint">No accepted jobs yet. Go online to receive matching bookings.</p>`;screen.innerHTML=`<span class="eyebrow" style="color:#ff7a00">JOBS</span><h1>My Jobs</h1><section class="panel">${rows}</section>`}

function renderEarnings(){screen.innerHTML=`<span class="eyebrow" style="color:#ff7a00">EARNINGS</span><h1>Money & settlement</h1><section class="metrics"><article class="metric-card"><small>Today Earnings</small><strong>${money(state.earningsToday)}</strong></article><article class="metric-card"><small>Available Payout</small><strong>${money(state.earningsBalance)}</strong></article><article class="metric-card"><small>Commission Balance</small><strong>${money(state.commissionBalance)}</strong></article><article class="metric-card"><small>Current Plan</small><strong>${state.plan}</strong></article></section><div class="section-title"><div><h2>Settlement logic</h2></div></div><section class="panel"><div class="list-row"><div><strong>Cash / Direct UPI trip</strong><small>Customer pays partner directly</small></div><strong>15% debited</strong></div><div class="list-row"><div><strong>Online trip</strong><small>Partner entitlement credited to Earnings Balance</small></div><strong>85%</strong></div><div class="list-row"><div><strong>Payout</strong><small>Daily batch settlement preferred</small></div><strong>Eligible</strong></div></section>`}

function renderAccount(){screen.innerHTML=`<span class="eyebrow" style="color:#ff7a00">ACCOUNT</span><h1>Partner profile</h1><section class="panel"><div class="list-row"><div><strong>Partner Verification</strong><small>Personal + vehicle documents</small></div><strong>Approved</strong></div><div class="list-row"><div><strong>Identity Selfie</strong><small>Required when going online</small></div><strong>Valid</strong></div><div class="list-row"><div><strong>Vehicle</strong><small>MH20 • Tata Ace</small></div><strong>Active</strong></div><div class="list-row"><div><strong>Documents</strong><small>RC, Insurance, PUC, Fitness, Permit</small></div><strong>Valid</strong></div><div class="list-row"><div><strong>Plan</strong><small>Commission Partner</small></div><strong>15%</strong></div></section>`}

render();
