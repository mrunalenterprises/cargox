const screen = document.querySelector('#screen');
const homeTemplate = document.querySelector('#homeTemplate');
const navItems = [...document.querySelectorAll('.nav-item')];

const state = {
  route: 'home',
  bookingTime: 'now',
  selectedService: null,
  lastGoods: '',
};

const services = {
  parcel: { label: '2-Wheeler Parcel', vehicle: 'Bike', baseFare: 149, eta: '7 min' },
  loading: { label: 'Loading Vehicle', vehicle: 'Tata Ace', baseFare: 489, eta: '11 min' },
  helper: { label: 'Helper', vehicle: '1 Helper', baseFare: 299, eta: '18 min' },
  shifting: { label: 'Full Shifting', vehicle: 'Verified Team + Vehicle', baseFare: 2199, eta: 'Inspection/quote' },
};

function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function toast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

function setRoute(route) {
  state.route = route;
  navItems.forEach((item) => item.classList.toggle('active', item.dataset.route === route));
  render();
}

navItems.forEach((item) => item.addEventListener('click', () => setRoute(item.dataset.route)));

function render() {
  if (state.route === 'home') return renderHome();
  if (state.route === 'bookings') return renderBookings();
  if (state.route === 'support') return renderSupport();
  return renderAccount();
}

function renderHome() {
  screen.replaceChildren(homeTemplate.content.cloneNode(true));
  wireHome();
}

function wireHome() {
  const serviceCards = [...document.querySelectorAll('.service-card')];
  const segmentButtons = [...document.querySelectorAll('.segment')];
  const scheduleRow = document.querySelector('#scheduleRow');
  const goodsInput = document.querySelector('#goodsInput');

  serviceCards.forEach((card) => {
    card.classList.toggle('selected', card.dataset.service === state.selectedService);
    card.addEventListener('click', () => {
      state.selectedService = card.dataset.service;
      serviceCards.forEach((item) => item.classList.toggle('selected', item === card));
      const selected = services[state.selectedService];
      toast(`${selected.label} selected`);
    });
  });

  segmentButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.time === state.bookingTime);
    button.addEventListener('click', () => {
      state.bookingTime = button.dataset.time;
      segmentButtons.forEach((item) => item.classList.toggle('active', item === button));
      scheduleRow.classList.toggle('hidden', state.bookingTime !== 'schedule');
    });
  });
  scheduleRow.classList.toggle('hidden', state.bookingTime !== 'schedule');

  document.querySelector('#voiceButton').addEventListener('click', () => toast('Voice booking UI is ready for speech integration.'));
  document.querySelector('#photoButton').addEventListener('click', () => toast('Photo-assisted vehicle recommendation will connect to AI upload flow.'));
  document.querySelector('#bookAgainButton').addEventListener('click', () => {
    state.selectedService = 'loading';
    goodsInput.value = 'Office material';
    document.querySelector('#pickupInput').value = 'Cidco, Sambhaji Nagar';
    document.querySelector('#dropInput').value = 'Waluj MIDC';
    serviceCards.forEach((item) => item.classList.toggle('selected', item.dataset.service === 'loading'));
    showMatches();
  });
  document.querySelector('#findButton').addEventListener('click', showMatches);
}

function detectService(goods) {
  const text = goods.toLowerCase();
  if (/house|home|flat|office shifting|shifting|furniture/.test(text)) return 'shifting';
  if (/helper|labour|labor|loading only|unloading/.test(text)) return 'helper';
  if (/document|parcel|small box|medicine|envelope/.test(text)) return 'parcel';
  if (/fridge|washing|box|material|machine|goods|stock/.test(text)) return 'loading';
  return 'loading';
}

function showMatches() {
  const goodsInput = document.querySelector('#goodsInput');
  const pickup = document.querySelector('#pickupInput').value.trim();
  const drop = document.querySelector('#dropInput').value.trim();
  const goods = goodsInput.value.trim();

  if (!goods || !pickup || !drop) {
    toast('Please enter goods, pickup and drop details.');
    return;
  }

  state.lastGoods = goods;
  if (!state.selectedService) state.selectedService = detectService(goods);

  [...document.querySelectorAll('.service-card')].forEach((item) => {
    item.classList.toggle('selected', item.dataset.service === state.selectedService);
  });

  const service = services[state.selectedService];
  const rows = buildMatches(service);
  const resultCards = document.querySelector('#resultCards');
  resultCards.innerHTML = rows.map((row, index) => `
    <article class="result-card ${index === 0 ? 'best' : ''}">
      <div>
        <span class="eyebrow dark">${row.label}</span>
        <h3>${row.vehicle}</h3>
        <p>${row.description}</p>
        <div class="result-meta">
          <span>★ ${row.rating}</span>
          <span>${row.trips} trips</span>
          <span>${row.onTime}% on-time</span>
          <span>ETA ${row.eta}</span>
        </div>
      </div>
      <div class="result-price">
        <div><strong>${money(row.fare)}</strong><small>Fare Locked</small></div>
        <button type="button" data-book-option="${index}">Book Now</button>
      </div>
    </article>
  `).join('');

  document.querySelector('#resultsSection').classList.remove('hidden');
  document.querySelector('#resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.querySelectorAll('[data-book-option]').forEach((button) => {
    button.addEventListener('click', () => confirmBooking(rows[Number(button.dataset.bookOption)]));
  });
}

function buildMatches(service) {
  if (state.selectedService === 'shifting') {
    return [
      { label: 'AI BEST MATCH', vehicle: 'Verified Shifting Team', fare: service.baseFare, eta: 'Quote in 10 min', rating: '4.9', trips: '1.8k', onTime: 96, description: 'Skilled packing team, inventory checklist, condition proof and locked quote.' },
      { label: 'BEST VALUE', vehicle: 'Compact Shifting Team', fare: 1849, eta: 'Quote in 15 min', rating: '4.7', trips: '920', onTime: 94, description: 'Suitable for smaller home/office moves with packing and loading support.' },
      { label: 'FASTEST ARRIVAL', vehicle: 'Priority Shifting Team', fare: 2499, eta: 'Quote in 6 min', rating: '4.8', trips: '1.2k', onTime: 97, description: 'Priority inspection and faster team allocation.' },
    ];
  }

  return [
    { label: 'AI BEST MATCH', vehicle: service.vehicle, fare: service.baseFare, eta: service.eta, rating: '4.9', trips: '2.4k', onTime: 97, description: 'Best balance of suitability, ETA, partner quality and price.' },
    { label: 'BEST VALUE', vehicle: service.vehicle, fare: Math.max(99, service.baseFare - 35), eta: addMinutes(service.eta, 5), rating: '4.7', trips: '1.6k', onTime: 94, description: 'Lower fare with a verified partner and strong completion history.' },
    { label: 'FASTEST ARRIVAL', vehicle: service.vehicle, fare: service.baseFare + 45, eta: shortenEta(service.eta), rating: '4.8', trips: '1.9k', onTime: 96, description: 'Nearest suitable partner for the fastest pickup.' },
  ];
}

function addMinutes(eta, extra) {
  const match = eta.match(/(\d+)/);
  return match ? `${Number(match[1]) + extra} min` : eta;
}

function shortenEta(eta) {
  const match = eta.match(/(\d+)/);
  return match ? `${Math.max(3, Number(match[1]) - 3)} min` : eta;
}

function confirmBooking(option) {
  const screenCard = document.querySelector('#resultsSection');
  const status = document.createElement('div');
  status.className = 'status-strip';
  status.innerHTML = `<strong>Booking request created</strong><br><span class="muted">${option.vehicle} • ${money(option.fare)} Fare Locked • Partner matching started.</span>`;
  screenCard.prepend(status);
  toast('LOADIN is matching the best verified partner.');
}

function renderBookings() {
  screen.innerHTML = `
    <span class="eyebrow dark">MY BOOKINGS</span>
    <h1 class="screen-title">Your moves</h1>
    <p class="muted">Track current, scheduled and completed bookings.</p>
    <section class="empty-card">
      <div class="booking-row"><div><strong>Office Material</strong><small>Cidco → Waluj MIDC • Loading Vehicle</small></div><span class="tag">COMPLETED</span></div>
      <div class="booking-row"><div><strong>12 Cartons</strong><small>Jalna Road → Shendra • Tata Ace</small></div><span class="tag">COMPLETED</span></div>
      <div class="booking-row"><div><strong>Home Shifting</strong><small>Inspection requested • Full Shifting</small></div><span class="tag">QUOTE</span></div>
    </section>`;
}

function renderSupport() {
  screen.innerHTML = `
    <span class="eyebrow dark">SUPPORT</span>
    <h1 class="screen-title">We stay with the trip.</h1>
    <p class="muted">One trip, one support case, one owner — with active-trip priority.</p>
    <section class="support-card">
      <h3>Need help?</h3>
      <p class="muted">Safety and active-trip issues are prioritized automatically.</p>
      <div class="support-actions">
        <button type="button" data-support="active">Active Trip Help</button>
        <button type="button" data-support="payment">Payment / Fare</button>
        <button type="button" data-support="damage">Damage / Proof</button>
        <button type="button" data-support="sos">SOS / Safety</button>
      </div>
    </section>`;
  document.querySelectorAll('[data-support]').forEach((button) => button.addEventListener('click', () => toast(`${button.textContent} flow selected.`)));
}

function renderAccount() {
  screen.innerHTML = `
    <span class="eyebrow dark">ACCOUNT</span>
    <h1 class="screen-title">Your LOADIN account</h1>
    <p class="muted">Profile, business settings, payments, favourites and safety.</p>
    <section class="profile-card">
      <div class="profile-line"><span>Profile</span><strong>Verified</strong></div>
      <div class="profile-line"><span>Favourite Partners</span><strong>2</strong></div>
      <div class="profile-line"><span>Reliability</span><strong>Excellent</strong></div>
      <div class="profile-line"><span>Business Account</span><strong>Not linked</strong></div>
      <div class="profile-line"><span>Saved Addresses</span><strong>3</strong></div>
    </section>`;
}

render();
