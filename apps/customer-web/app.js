import { SERVICE_CODE, SERVICE_STATUS, serviceCardState } from '../../src/domain/city-service-control.js';
import { calculateDynamicFare, DEMAND_LEVEL } from '../../src/domain/dynamic-pricing.js';
import { loadinData } from '../shared/loadin-data.js';

const polish = document.createElement('link');
polish.rel = 'stylesheet';
polish.href = './polish.css';
document.head.appendChild(polish);

const screen = document.querySelector('#screen');
const homeTemplate = document.querySelector('#homeTemplate');
const navItems = [...document.querySelectorAll('.nav-item')];

const cityConfig = {
  code: 'CSN',
  enabled: true,
  allowOutstationDrop: false,
  services: [
    { serviceCode: SERVICE_CODE.PARCEL_2W, status: SERVICE_STATUS.ACTIVE, allowedZones: ['CENTRAL', 'MIDC'], allowedVehicleTypes: ['BIKE'] },
    { serviceCode: SERVICE_CODE.LOADING_VEHICLE, status: SERVICE_STATUS.ACTIVE, allowedZones: ['CENTRAL', 'MIDC'], allowedVehicleTypes: ['3W', 'TATA_ACE', 'PICKUP_8FT', 'PICKUP_9FT', 'TATA_407', 'TRUCK_14FT_PLUS'] },
    { serviceCode: SERVICE_CODE.HELPER, status: SERVICE_STATUS.ACTIVE, allowedZones: ['CENTRAL', 'MIDC'] },
    { serviceCode: SERVICE_CODE.FULL_SHIFTING, status: SERVICE_STATUS.ACTIVE, allowedZones: ['CENTRAL', 'MIDC'] },
  ],
};

const state = {
  route: 'home',
  bookingTime: 'now',
  selectedService: null,
  lastGoods: '',
  activeBooking: null,
  liveBookings: [],
  backend: loadinData.mode,
  demand: { level: DEMAND_LEVEL.NORMAL, score: 56, supplyGap: 8, avgPickupEtaMin: 9 },
};

const services = {
  parcel: { label: '2-Wheeler Parcel', code: SERVICE_CODE.PARCEL_2W, vehicle: 'Bike', vehicleType: 'BIKE', baseFare: 149, eta: '7 min', maxWeightKg: 20 },
  loading: { label: 'Loading Vehicle', code: SERVICE_CODE.LOADING_VEHICLE, vehicle: 'Tata Ace', vehicleType: 'TATA_ACE', baseFare: 489, eta: '11 min' },
  helper: { label: 'Helper', code: SERVICE_CODE.HELPER, vehicle: '1 Helper', vehicleType: null, baseFare: 299, eta: '18 min' },
  shifting: { label: 'Full Shifting', code: SERVICE_CODE.FULL_SHIFTING, vehicle: 'Verified Team + Vehicle', vehicleType: null, baseFare: 2199, eta: 'Inspection/quote' },
};

const vehicleOptions = { loading: ['3W Loader', 'Tata Ace', '8-ft Pickup', '9-ft Pickup', 'Tata 407', '14-ft+ Truck'] };

function setupAssetFallbacks() {
  const brand = document.querySelector('[data-brand-image]');
  if (brand) brand.addEventListener('error', () => brand.classList.add('broken'), { once: true });
  document.querySelectorAll('[data-service-image]').forEach((img) => img.addEventListener('error', () => img.classList.add('broken'), { once: true }));
}
setupAssetFallbacks();

function money(value) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value); }
function toast(message) { document.querySelector('.toast')?.remove(); const el = document.createElement('div'); el.className = 'toast'; el.textContent = message; document.body.appendChild(el); setTimeout(() => el.remove(), 2400); }
function availabilityFor(serviceKey) { const service = services[serviceKey]; return serviceCardState({ city: cityConfig, serviceCode: service.code, vehicleType: service.vehicleType, zoneCode: 'CENTRAL' }); }
function setRoute(route) { state.route = route; navItems.forEach((item) => item.classList.toggle('active', item.dataset.route === route)); render(); }
navItems.forEach((item) => item.addEventListener('click', () => setRoute(item.dataset.route)));

function render() { if (state.route === 'home') return renderHome(); if (state.route === 'bookings') return renderBookings(); if (state.route === 'support') return renderSupport(); return renderAccount(); }

function renderHome() {
  screen.replaceChildren(homeTemplate.content.cloneNode(true));
  setupAssetFallbacks();
  applyCityServiceAvailability();
  wireHome();
  const cityBar=document.querySelector('#cityStatusBar small');
  if(cityBar)cityBar.textContent=loadinData.mode==='LIVE'?'Live backend • Fare Lock + verified partners':'End-to-end demo active • no OTP subscription required';
}

function applyCityServiceAvailability() {
  document.querySelectorAll('.service-card').forEach((card) => { const status = availabilityFor(card.dataset.service); card.dataset.unavailable = String(!status.enabled); if (!status.enabled) { card.dataset.badge = status.badge || 'Unavailable'; card.setAttribute('aria-disabled', 'true'); } });
}

function wireHome() {
  const serviceCards = [...document.querySelectorAll('.service-card')];
  const segmentButtons = [...document.querySelectorAll('.segment')];
  const scheduleRow = document.querySelector('#scheduleRow');
  const goodsInput = document.querySelector('#goodsInput');
  const bookingHint = document.querySelector('#bookingHint');

  serviceCards.forEach((card) => {
    card.classList.toggle('selected', card.dataset.service === state.selectedService);
    card.addEventListener('click', () => { const next = card.dataset.service; const availability = availabilityFor(next); if (!availability.enabled) return toast(`${services[next].label}: ${availability.badge}.`); state.selectedService = next; serviceCards.forEach((item) => item.classList.toggle('selected', item === card)); bookingHint.classList.remove('hidden'); bookingHint.textContent = recommendationHint(next); toast(`${services[next].label} selected`); });
  });

  segmentButtons.forEach((button) => { button.classList.toggle('active', button.dataset.time === state.bookingTime); button.addEventListener('click', () => { state.bookingTime = button.dataset.time; segmentButtons.forEach((item) => item.classList.toggle('active', item === button)); scheduleRow.classList.toggle('hidden', state.bookingTime !== 'schedule'); if (state.bookingTime === 'schedule') setDefaultSchedule(); }); });
  scheduleRow.classList.toggle('hidden', state.bookingTime !== 'schedule'); if (state.bookingTime === 'schedule') setDefaultSchedule();

  goodsInput.addEventListener('input', () => { const goods = goodsInput.value.trim(); if (goods.length < 3) return bookingHint.classList.add('hidden'); const recommended = detectService(goods); bookingHint.classList.remove('hidden'); bookingHint.textContent = `AI suggestion: ${services[recommended].label}. ${recommendationHint(recommended)}`; });
  document.querySelector('#voiceButton').addEventListener('click', () => toast('Voice booking UI ready for speech-provider connection.'));
  document.querySelector('#photoButton').addEventListener('click', () => toast('Photo goods-analysis UI ready for AI upload connection.'));
  document.querySelector('#bookAgainButton').addEventListener('click', () => { state.selectedService = 'loading'; goodsInput.value = 'Office material'; document.querySelector('#pickupInput').value = 'Cidco, Sambhaji Nagar'; document.querySelector('#dropInput').value = 'Waluj MIDC'; serviceCards.forEach((item) => item.classList.toggle('selected', item.dataset.service === 'loading')); bookingHint.classList.remove('hidden'); bookingHint.textContent = 'Book Again reuses route/service only; a fresh Fare Lock is calculated before confirmation.'; showMatches(); });
  document.querySelector('#findButton').addEventListener('click', showMatches);
}

function setDefaultSchedule() { const date = document.querySelector('#scheduleDate'); const time = document.querySelector('#scheduleTime'); if (!date || !time || date.value) return; const then = new Date(Date.now() + 2 * 60 * 60 * 1000); date.value = then.toISOString().slice(0, 10); time.value = `${String(then.getHours()).padStart(2, '0')}:${String(then.getMinutes()).padStart(2, '0')}`; }
function detectService(goods) { const text = goods.toLowerCase(); if (/house|home|flat|office shifting|shifting|furniture|bed|sofa|wardrobe/.test(text)) return 'shifting'; if (/helper|labour|labor|loading only|unloading|lifting/.test(text)) return 'helper'; if (/document|parcel|small box|medicine|envelope|file/.test(text)) return 'parcel'; if (/fridge|washing|box|carton|material|machine|goods|stock|appliance/.test(text)) return 'loading'; return 'loading'; }
function recommendationHint(serviceKey) { if (serviceKey === 'parcel') return 'Best for small/light parcels. Oversized goods are redirected to Loading Vehicle.'; if (serviceKey === 'helper') return 'Use when you need manpower only for loading, unloading or lifting.'; if (serviceKey === 'shifting') return 'Includes inventory, skilled team, packing workflow and quote/inspection when required.'; return `Vehicle range includes ${vehicleOptions.loading.join(', ')}.`; }

function validateBookingForm() {
  const goods = document.querySelector('#goodsInput').value.trim(); const pickup = document.querySelector('#pickupInput').value.trim(); const drop = document.querySelector('#dropInput').value.trim(); if (!goods || !pickup || !drop) return { ok: false, reason: 'Please enter goods, pickup and drop details.' };
  let scheduledAt=null;
  if (state.bookingTime === 'schedule') { const date = document.querySelector('#scheduleDate').value; const time = document.querySelector('#scheduleTime').value; if (!date || !time) return { ok: false, reason: 'Select schedule date and time.' }; scheduledAt = new Date(`${date}T${time}:00`); if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now() + 15 * 60 * 1000) return { ok: false, reason: 'Scheduled booking must be at least 15 minutes from now.' }; }
  return { ok: true, goods, pickup, drop, scheduledAt };
}

function pricedFare(baseFare) { return calculateDynamicFare({ baseFare, demandLevel: state.demand.level, demandScore: state.demand.score, supplyGap: state.demand.supplyGap, avgPickupEtaMin: state.demand.avgPickupEtaMin, pricingConfig: { minMultiplier: 0.95, maxMultiplier: 1.2, maxFareIncreasePct: 20, allowDemandPricing: true } }); }

function showMatches() {
  const validation = validateBookingForm(); if (!validation.ok) return toast(validation.reason); state.lastGoods = validation.goods; if (!state.selectedService) state.selectedService = detectService(validation.goods); const availability = availabilityFor(state.selectedService); if (!availability.enabled) return toast(`${services[state.selectedService].label}: ${availability.badge}.`);
  [...document.querySelectorAll('.service-card')].forEach((item) => item.classList.toggle('selected', item.dataset.service === state.selectedService));
  const rows = buildMatches(services[state.selectedService]); const resultCards = document.querySelector('#resultCards');
  resultCards.innerHTML = rows.map((row, index) => `<article class="result-card ${index === 0 ? 'best' : ''}" style="position:relative"><div><span class="eyebrow dark">${row.label}</span><h3>${row.vehicle}</h3><p>${row.description}</p><div class="result-meta"><span>★ ${row.rating}</span><span>${row.trips} trips</span><span>${row.onTime}% on-time</span><span>ETA ${row.eta}</span></div><div class="pricing-note">Demand ${row.pricing.appliedMultiplier}× • Max fare protection active</div></div><div class="result-price"><div><strong>${money(row.fare)}</strong><small>Fare Locked</small><span class="price-meta">Base ${money(row.pricing.baseFare)}</span></div><button type="button" data-book-option="${index}">Book Now</button></div></article>`).join('');
  document.querySelector('#resultsSection').classList.remove('hidden'); document.querySelector('#resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' }); document.querySelectorAll('[data-book-option]').forEach((button) => button.addEventListener('click', () => confirmBooking(rows[Number(button.dataset.bookOption)], validation)));
}

function buildMatches(service) {
  const aiPricing = pricedFare(service.baseFare); const valuePricing = pricedFare(Math.max(99, service.baseFare - 35)); const fastPricing = pricedFare(service.baseFare + 45);
  if (state.selectedService === 'shifting') { const compact = pricedFare(1849); const priority = pricedFare(2499); return [ { label: 'AI BEST MATCH', vehicle: 'Verified Shifting Team', fare: aiPricing.finalFare, pricing: aiPricing, eta: 'Quote in 10 min', rating: '4.9', trips: '1.8k', onTime: 96, description: 'Skilled packing team, inventory checklist, condition proof and locked quote.' }, { label: 'BEST VALUE', vehicle: 'Compact Shifting Team', fare: compact.finalFare, pricing: compact, eta: 'Quote in 15 min', rating: '4.7', trips: '920', onTime: 94, description: 'Suitable for smaller home/office moves with packing and loading support.' }, { label: 'FASTEST ARRIVAL', vehicle: 'Priority Shifting Team', fare: priority.finalFare, pricing: priority, eta: 'Quote in 6 min', rating: '4.8', trips: '1.2k', onTime: 97, description: 'Priority inspection and faster team allocation.' } ]; }
  return [ { label: 'AI BEST MATCH', vehicle: service.vehicle, fare: aiPricing.finalFare, pricing: aiPricing, eta: service.eta, rating: '4.9', trips: '2.4k', onTime: 97, description: 'Best balance of suitability, ETA, partner quality, reliability and price.' }, { label: 'BEST VALUE', vehicle: service.vehicle, fare: valuePricing.finalFare, pricing: valuePricing, eta: addMinutes(service.eta, 5), rating: '4.7', trips: '1.6k', onTime: 94, description: 'Lower fare with a verified partner and strong completion history.' }, { label: 'FASTEST ARRIVAL', vehicle: service.vehicle, fare: fastPricing.finalFare, pricing: fastPricing, eta: shortenEta(service.eta), rating: '4.8', trips: '1.9k', onTime: 96, description: 'Nearest suitable verified partner for the fastest pickup.' } ];
}
function addMinutes(eta, extra) { const match = eta.match(/(\d+)/); return match ? `${Number(match[1]) + extra} min` : eta; }
function shortenEta(eta) { const match = eta.match(/(\d+)/); return match ? `${Math.max(3, Number(match[1]) - 3)} min` : eta; }

async function confirmBooking(option, form) {
  const service=services[state.selectedService];
  try{
    const saved=await loadinData.createBooking({cityCode:cityConfig.code,serviceCode:service.code,bookingMode:state.bookingTime==='schedule'?'SCHEDULED':'NOW',scheduledAt:form.scheduledAt,goodsDescription:form.goods,pickupAddress:form.pickup,dropAddress:form.drop,vehicleClass:service.vehicleType,lockedFare:option.fare,paymentMode:loadinData.mode==='LIVE'?'ONLINE':'CASH'});
    state.activeBooking = { id:saved.id, goods:form.goods, pickup:form.pickup, drop:form.drop, service:service.label, option, lockedFare:option.fare, status:saved.status, scheduled:state.bookingTime==='schedule' };
    const results=document.querySelector('#resultsSection');results.querySelector('.status-strip')?.remove();const status=document.createElement('div');status.className='status-strip';status.innerHTML=`<strong>${state.activeBooking.status}</strong><br><span class="muted">${state.activeBooking.id} • ${option.vehicle} • ${money(option.fare)} Fare Locked • ${loadinData.mode==='LIVE'?'Saved to live backend':'Shared demo booking sent to Partner/Admin'}.</span>`;results.prepend(status);toast(loadinData.mode==='LIVE'?'Live booking created successfully.':'Demo booking created — open Partner App to accept it.');
  }catch(error){toast(error.message==='login_required'?'Login is required before a live booking can be created.':`Booking failed: ${error.message}`)}
}

async function renderBookings() {
  try{state.liveBookings=await loadinData.myBookings()}catch(error){toast(`Could not load bookings: ${error.message}`)}
  const live=state.liveBookings.map(b=>`<div class="booking-row"><div><strong>${b.goods_description||b.service_code}</strong><small>${b.pickup_address} → ${b.drop_address} • ${money(Number(b.locked_fare||0))}</small></div><span class="tag">${b.status}</span></div>`).join('');
  screen.innerHTML = `<span class="eyebrow dark">MY BOOKINGS</span><h1 class="screen-title">Your moves</h1><p class="muted">${loadinData.mode==='LIVE'?'Live Supabase data':'Shared demo data — Customer, Partner, Admin and Fleet stay in sync'}.</p><section class="empty-card">${live||'<div class="booking-row"><div><strong>No bookings yet</strong><small>Create a booking from Home.</small></div></div>'}</section>`;
}

function renderSupport() { screen.innerHTML = `<span class="eyebrow dark">SUPPORT</span><h1 class="screen-title">We stay with the trip.</h1><p class="muted">One trip, one support case, one owner — with active-trip priority.</p><section class="support-card"><h3>Need help?</h3><p class="muted">Safety and active-trip issues are prioritized automatically.</p><div class="support-actions"><button type="button" data-support="active">Active Trip Help</button><button type="button" data-support="payment">Payment / Fare</button><button type="button" data-support="damage">Damage / Proof</button><button type="button" data-support="sos">SOS / Safety</button></div></section>`; document.querySelectorAll('[data-support]').forEach((button) => button.addEventListener('click', () => toast(`${button.textContent} flow selected.`))); }
function renderAccount() { const session=loadinData.session(); screen.innerHTML = `<span class="eyebrow dark">ACCOUNT</span><h1 class="screen-title">Your LOADIN account</h1><p class="muted">Mode: ${loadinData.mode} • ${loadinData.mode==='DEMO'?'Test login active without OTP subscription':session?'Signed in':'Login required'}</p><section class="profile-card"><div class="profile-line"><span>Profile</span><strong>${loadinData.mode==='DEMO'?'Demo Customer':session?'Connected':'Login required'}</strong></div><div class="profile-line"><span>Favourite Partners</span><strong>—</strong></div><div class="profile-line"><span>Reliability</span><strong>Excellent</strong></div><div class="profile-line"><span>Business Account</span><strong>—</strong></div><div class="profile-line"><span>Saved Addresses</span><strong>—</strong></div></section>`; }

loadinData.subscribe(()=>{if(state.route==='bookings')renderBookings()});
render();