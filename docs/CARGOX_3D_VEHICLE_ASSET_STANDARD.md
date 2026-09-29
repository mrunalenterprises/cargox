# CargoX 3D Vehicle Master Asset Standard — Design Lock Proposal
Date: 2026-09-28 · Clean-start Phase 1
Approved user direction: **Use matching 3D vehicle visualisations throughout the CargoX app. Do NOT use photographs of real bikes, auto rickshaws or cars as vehicle-class cards.** Use original generic/unbranded vehicle 3D assets instead.

## Scope
Vehicle cards: Bike, Auto Rickshaw, Car Mini, Sedan, SUV, Outstation Sedan/SUV, Shared Car. Reuse these same canonical icons/renders throughout Customer selection, Partner onboarding, My Vehicles placeholder, Admin class catalog, Daily/Monthly Packs, first-party promotion banners and city-specific Coming Soon screens. Pink Rider uses an eligible approved vehicle type with a consistent pink 3D accent/badge (not a misleading separate vehicle class). Real vehicle registration photos remain mandatory for actual vehicle KYC and driver/vehicle confirmation: this design direction only affects illustrative **vehicle class graphics**, not trust/identity evidence.

## Consistent art direction (original asset IP)
- Clean high-quality, softly lit **stylised premium 3D** models, India-relevant vehicle silhouettes. Generic unbranded cars (Mini hatchback, Sedan and roomy SUV), commuter two-wheeler and black/yellow three-wheeler. Do not replicate exact current commercial 3D files, competitor branding or protected logos.
- 3/4 front view facing screen right for all class cards; same virtual studio camera, focal length, ground-contact shadow, scale logic and surface finish. Additional front, side, rear and interior views only when truly needed for vehicle details or onboarding educational aids.
- Neutral vehicle base colours compatible with CargoX brand green/teal. Category accents and optional pink on verified Pink Rider service badge, never infer a woman driver only from a pink vehicle.
- Clean transparent background for card exports (PNG/WebP); optional matching light/dark background layers defined in design system. Safe visual occupancy and no baked text because copy supports Marathi, Hindi, English.
- Clearly differentiated category silhouette: bike vs auto vs Mini vs Sedan vs SUV; outstation uses eligible Sedan/SUV plus subtle highway/suitcase icon; Shared Car uses matching Sedan/SUV plus seat/share UI marker. Do not produce photographic renders with identifiable real licence plates.

## Master asset inventory and names
`asset_vehicle_bike_3d`, `asset_vehicle_auto_3d`, `asset_vehicle_car_mini_3d`, `asset_vehicle_car_sedan_3d`, `asset_vehicle_car_suv_3d`, `asset_vehicle_outstation_3d`, `asset_vehicle_shared_3d`, `asset_vehicle_pink_rider_badge_3d`, `asset_vehicle_generic_placeholder_3d`.
Single asset registry record for each: stable ID, service IDs, default renders for light/dark, original source location, license/ownership, visual version, alt text and fallback icon. Admin-configurable service switch refers to registry IDs rather than ad hoc URLs.
Exports: original editable 3D scene/model when commissioned (e.g. Blender .blend plus glTF/GLB if interactive rotation genuinely used) and compressed static WebP @1x/@2x for home screens; transparent PNG master high resolution (target 2048px canvas); optional GLB with strict triangle/texture budget only for a dedicated interactive detail experience. A generated 3D-style *image* is a render reference and not an actual mesh/model; actual interactive 3D requires separate 3D modelling. Avoid downloading fonts as distributable assets.

## Placement & performance
- Customer home: identical 3/4 3D style class cards; lazy-load with compressed/responsive WebP, accessible generic silhouette fallback; no rotating WebGL on home page.
- Vehicle detail class selector: optional extra views; only optional real GLB on capable devices and behind feature flag, not a booking blocker.
- Partner onboarding: 3D category illustration on type-selection step; real uploaded RC/vehicle photographs on verification step. Distinguish clearly.
- CargoX first-party promotion banners and ads: create **separate layered compositions** built on this same visual language. Ads are clearly labeled Sponsored; third-party advertiser images/logos are not forced to use CargoX 3D vehicle renders.
- Never put marketing/paid ads on active navigation, booking OTP, SOS, guardian-child route screens or active driver ride interfaces. One reserved responsive Sponsored Home banner below essential booking/recurring cards, separate from first-party promotions.

## Acceptance
1. Bike, Auto, Car, Outstation and Shared cards use cohesive unbranded 3D renders (no real vehicle photo as class illustration).
2. Assets share camera, lighting, proportions, compressed exports and transparent background.
3. Pink Rider remains a verified driver eligibility/preference (badge and theme accent), no separate vehicle SKU.
4. Actual verified vehicle photos still required for Driver/Owner verification and real vehicle display where policy requires.
5. No heavy 3D mesh load on customer home; correct offline/fallback/performance/accessibility behavior.
6. Marketing owns promo templates with same 3D style and separate clearly labelled paid-ad slots.
