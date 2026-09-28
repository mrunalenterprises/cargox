# CargoX screen inventory and visual rules
Design reference: primary #59BAA1, surface #B4DACF, card #ECEDED, action #0E885A, complementary accessible pink. Original glossy vehicle cards, subtle highlight, meaningful motion <240ms and OS reduced-motion support; never clone competitor assets.

## Customer
Language/OTP -> City -> Home: Bike | Auto | Car | Outstation | Shared Car -> pickup/drop/map -> estimate & transparently itemised fees -> optional Pink Rider Only -> Book Now / Schedule -> matching -> assigned driver -> customer 4-digit code -> live GPS/share/SOS -> trip completion -> payment & history/support.
Home secondary: Daily Services -> Office / School (launch gate) / College / Classes / Other / Outstation Daily Car -> weekdays -> pickup and optional return -> fixed route -> Schedule Once / Recurring / Monthly Pack -> fare, calendar, quote and consent -> purchase (only when production ready) -> occurrence calendar and driver assignment notifications.

## Partner
Language/OTP -> Partner role -> minimal identity/docs -> Staff review -> Admin approval -> online selfie -> matching preferences incl Pink Rider opt-in + Women Only / Women+Men -> ride offers -> accept -> navigation -> trip-start OTP -> complete -> earnings/payout -> help and own SOS. Daily recurring shift/route calendar and replacement preference.

## Admin
Staff login/RBAC -> City and service legal gates -> partner documents approvals -> service pricing and configurable commission -> active dispatch -> safety/incident desk -> Daily routes/Monthly Packs -> child guardian compliance (gated) -> refunds and settlement -> GM/FO scope reports -> audit.

## Implemented vs planned
Current local Node demo: customer vehicle cards/quote/request + daily pack unpaid preview; partner eligible offer acceptance/start/complete; admin status metrics. Static visuals and mock test partners only. No real map, OTP SMS, auth, guardian enrollment, payments, GPS, permits, staffed support, production Next API or production deployment.

## Flutter navigation delivered in batch E2

- Customer: language/fallback, fictional login, manual permissions and city; all five service entries; Auto/Car route, server quote, Pink eligibility and explicit unpaid confirmation; schedule; matching/status, server customer code, tracking limitation, sharing/SOS gates, unpaid receipt/history; Daily purpose picker; Monthly quote/calendar and unpaid draft library; guardian gate.
- Partner: fictional login and all four role previews; registration/review, fleet/service, Pink opt-in, rate settings and selfie gates; real local eligible offers, accept, server OTP start/completion, scheduled workload, trip history/unpaid earnings and navigation/SOS gates.
- Original vector vehicles and reusable accessible glossy cards. Route transitions 170/210ms, spring tap 170ms, one-shot reflection 220ms. No perpetual animation; OS disableAnimations and accessibleNavigation remove motion.
- Not delivered as live features: real authentication, maps, notifications, legal eligibility clearance, child transport, pooled seats, intercity dispatch, paid packs, entitlements, driver replacements, real pricing/payouts and staffed emergency response. Mini/Sedan/SUV are described as pending Admin configuration; the API has a single Car demo class.
