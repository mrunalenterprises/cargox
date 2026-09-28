# PIP PIP brand policy

The product display name is **PIP PIP** and the company name is **Mrunal Technologies**. All current customer, partner, Admin and local-demo surfaces read their display names from platform branding constants where code supports it:

- Flutter: `PipPipBrand` in `packages/cargox_ui/lib/cargox_ui.dart`.
- Admin: `apps/admin/lib/brand.ts`.
- Static local-demo metadata and Android resources use the same approved values because those platforms have no shared runtime configuration.

The Mint Teal glossy theme, accessibility-aware animation behavior, service flows, legal gates and Pink Rider safeguards remain unchanged.

## Pink Rider wording

The selected internal tagline is retained verbatim for approved future use: “Pink Rider — World’s 1st Women Safety Rider, crafted in Chhatrapati Sambhajinagar, MH.” It remains unpublished because the claim has not been substantiated. The local demo continues to use its existing safer public wording and safety limitations.

## Retained technical identifiers

The following identifiers intentionally remain `cargox`/`CARGOX` to avoid breaking imports, application IDs, API compatibility, migrations, CI, local setup or the Git remote: Dart package and symbol names (`cargox_*`, `CargoXPage`, `CargoXColors`), Android namespace/application IDs and Kotlin paths, `CARGOX_DEMO_API` and `CARGOX_ENV`, local API paths, database/migration names, npm package names, script names, historical document filename `docs/CARGOX_MASTER_BUILD_PROMPT.md`, repository folder/remote, and the staging test issuer. These are implementation identifiers only and are not product display names. Migrate them only through a separately reviewed compatibility plan.

There is no enabled notification delivery system in this local demo. Existing notification-access copy remains a truthful permission statement and does not expose the retired product name.
