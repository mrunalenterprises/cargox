# CargoX V1 — Master Assets and Interactive Vehicle 3D Specification
Status: product specification, **NOT** claim that commercial-quality 3D assets have already been produced or licensed.
Clean-start project. Every asset must have stable logical ID, version, owner, usage licence and export records.

## 1. UI design / branding masters
- brand/logo primary, one-colour, dark/light, app icon, splash, safe-area and logo spacing
- design tokens: theme colours incl Pink Rider accent, typography Marathi/Hindi/English, focus rings, touch targets, shadows, cards, navigation, breakpoints, 3D stage background and reduced-motion behaviour
- status icons: pickup/drop, routes, OTP, safety, SOS, location share, calendar, wallet, fleet, document verification, offers, driver hiring, sponsored and reporting. Icon library licence checked.
- message/localisation masters: screen labels, errors, success, wait, SOS, notifications, campaign disclosure, alt-text for vehicle models
- reusable card registry: Bike, Auto, Car Mini/Sedan/SUV, Outstation One Way/Round Trip/Daily, Shared Car per seat, Daily Office/School/College/Classes/Custom/Intercity, Monthly Pack, Pink Rider, Vacancy, Home Promotional Carousel, Home Sponsored Banner
- no user or regulated identity data embedded in reusable marketing art

## 2. Required **real 3D models**, not flat images
Each vehicle class is a 3D asset with real geometry/materials in portable GLB/glTF. First delivery targets: `bike_commuter_v1`, `auto_indian_v1`, `car_mini_v1`, `car_sedan_v1`, `car_suv_v1`, `car_outstation_suv_v1`, `car_shared_v1`. Reuse the approved SUV/Car asset when the visual class is identical; avoid duplicate mesh delivery.
- Accurate unbranded Indian passenger vehicle proportions, multiple requested exterior colours via approved materials where safely supported. Do **not** imply the displayed generic car is a guaranteed make/model.
- Design quality: physically based metallic-roughness materials, clean quads/triangles, convincing wheels and lights, intact normals, neutral lighting environment and smooth 360-degree orbit. No trademarked automaker logo or proprietary copying.
- Master production file may be Blender `.blend`; app export: GLB `.glb` with baked textures, no external URL at runtime for base assets.
- Per class outputs: `*_lod0.glb` for details, `*_lod1.glb` for home cards, `*_poster.webp` a **render of the same 3D mesh** for accessible/offline fallback, `*_thumb.webp` same mesh, preview turntable for QA (not shipped if costly), `*_licence.md`, `*_meta.json`.
- Initial performance **budgets (targets, measured on test devices before final freeze)**: homepage interactive LOD ~50k triangles or less and <=1.5 MB compressed per mesh including shared compressed textures where feasible; detail LOD <=150k triangles and <=4 MB; textures <=1024px on cards and <=2048px on details; lazy-load models only after first screen becomes interactive. These are targets, not a promise; tune for entry-level Android and memory limits with actual profiling. Shared GPU/material resources and explicit disposal when leaving scene.
- Implement user drag to rotate model 360 degrees on *detail* view; homepage card model may have subtle low-cost single turntable animation, **disabled with Reduced Motion/low-power preferences**. Disable animation when offscreen, on poor connection, low memory or when screen-reader interaction is active.
- The booking and pricing UI must never depend on loading a 3D model. Use deterministic same-model rendered fallback for offline/low-end devices. Do not use unrelated internet stock photos. No forced 3D download before quote or emergency actions.
- Accessibility: readable text labels, non-motion alternative, tap to select, keyboard/screen reader labels, minimum contrast, independent non-3D service card control.
- Need an explicit engineering compatibility spike: choose and test Flutter Android/iOS 3D GLB viewer/renderer with interaction, crash recovery, texture decoding, offline caching and 3D/web performance before binding project to a particular package.

## 3. Vehicle configuration/data masters
Country, region, city, licence/operational readiness, zones/route allowlist; vehicle classes, capacity, permit requirements, document list, supported passenger booking modes, compatible Pink preference, eligibility/availability; service card -> linked approved 3D asset ID from manifest. Car subtype models must align with actual category and owner uploaded actual-vehicle photos should remain separate restricted verification data and may be shown on assigned-driver info **with user privacy controls**; requirement to avoid photographic *illustration art* does not eliminate operational vehicle verification photos.

## 4. Booking, fare, safety, driver and vacancy masters
Booking type/status/route/schedule, recurrence/monthly entitlements and holidays; price settings versioned by city/service/vehicle and regulation profile; commission and payout breakdown; Pink Rider preferences and no-fallback; verification and expiry requirements; vacancy roles/shift/pay/vehicle-category/application stages; error and SOS escalation codes; notifications/localisations. Admin editable values do not create new app releases.

## 5. Marketing and sponsored ad assets
- Banner slot `customer_home_promo_carousel`: CargoX-owned campaigns including new city, daily/monthly rides, Pink Rider awareness, outstation and verified driver recruitment.
- Dedicated `customer_home_sponsored_inline` after the main booking options, labelled **Sponsored / जाहिरात**; a visually distinct paid card that cannot impersonate an official safety/service status card. No ad overlays or forced full-screen interruptions in core trip flows.
- Creative aspect-ratio master: 16:9 source plus tested flexible crop to UI aspect, mobile safe zones, WebP/AVIF export, readable overlay text in locale rather than baked text where translation matters, alt-text, campaign destination allowlist, brand logo rights. Determine actual px sizes after device breakpoint review.
- Campaign model: advertiser verified identity -> creative moderation -> city/language/device targeting -> active window and caps -> placement -> impression/click validity events -> billing/invoice/settlement -> report/dispute. Paid status clearly labelled; track attribution only with applicable consent; no targeting from sensitive driver/child/Pink data.
- Pricing for advertising (flat sponsored period, CPM/CPC if eventually supported) is admin-configurable; billable event rules, fraud limits, returns and tax treatment must be approved before charging.
- Owner/promotional content and sponsored third-party content have separate review flows and cannot alter pricing/commission.
- Disable all third-party ads by central feature flag; remove ads from child/guardian flows, SOS, OTP, checkout, active trip tracking and critical safety screens.

## 6. Release asset acceptance gates
1. Every required service card has correct approved 3D model and consistent same-asset fallback render.
2. Verify 360 rotation, device performance, accessibility and offline behaviour, with no booking flow block.
3. Asset metadata and commercial reuse rights recorded. No copied Ola/Uber/Rapido artwork or unlicensed vehicle meshes.
4. All campaign banners localise and show clear Sponsored labelling in customer app when paid.
5. Promotion click never changes a confirmed ride/contract fare without new quote and explicit acceptance.
6. Correct document-photo privacy: KYC/real-vehicle verification images are not part of public promotional art.
7. Asset manifest schema validation in CI for ids, paths, types, licences, references and app-size budgets.

## 7. Implementation directory proposal
- `assets/3d/`: manifest, vehicle GLBs once modelled, generated fallback renders and rights documentation.
- `assets/brand/`: originals and light/dark app export files.
- `assets/icons/`: purchased/licensed originals or source vectors.
- `assets/marketing/`: source campaign templates, locale copy and creative exports.
- `config/`: versioned seed catalogs for cities, service categories, ride modes, statuses and permission taxonomy; actual lawful tariff and commission set in approved Admin database configuration, **not hardcoded in seed defaults**.
- `docs/screens/`: fixed screen ids, fields, card actions, transitions and empty/error/loading states.
