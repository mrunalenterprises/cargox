# PIP PIP staging migration provenance and CLI safety

Approved isolated project: `ifnpbeozmbdofyczbvme` (Mumbai, Free plan). This is **not** a production launch and is not affiliated with the other Supabase projects.

Four additive SQL migrations were applied successfully through the connected Supabase tool, which assigns **its own remote migration timestamps**. Repository filenames and remote-applied versions are therefore intentionally different right now:

| Repository source | Connected-tool migration name | Recorded remote version |
|---|---|---|
| `20260928000100_cargox_phase1_schema.sql` | `cargox_phase1_schema` | `20260929052356` |
| `20260929000100_staging_identity_onboarding.sql` | `staging_identity_onboarding` | `20260929052410` |
| `20260929000200_mobile_public_catalog.sql` | `mobile_public_catalog` | `20260929143629` |
| `20260929000300_pippip_disabled_pilot_city.sql` | `pippip_disabled_pilot_city` | `20260929144732` |
| `20260929000400_staging_fk_indexes.sql` | `staging_fk_indexes` | `20260929150837` |

**Important:** Never run an unchecked `supabase db push` on a freshly linked local checkout. CLI migration history may see the repository filenames as pending because the connected tool generated different version numbers. Inspect `supabase migration list` on the correct isolated project and perform a carefully reviewed migration-history reconciliation / schema diff before any CLI push. Do not apply the base schema twice, truncate data or mark migrations as applied without comparing actual database objects first.

Currently deployed staging behavior:
- One inactive pilot city, five OFF / legally-not-ready services.
- Public catalog uses RLS and a `security_invoker` view; anonymous API users can see only approved active services. Zero results is the current expected response.
- Onboarding RPCs and staff memberships are still test foundations; no trusted identity provider, SMS/captcha configuration, real user enrollment, document verification service, production ride dispatch or billing is live.
- Always check Supabase security advisors and repeat negative authorized/unauthorized API tests before any access widening.

The fifth migration adds 14 non-destructive foreign-key indexes. Supabase's unindexed-FK advisory cleared on the small empty staging dataset; unused-index info notices are expected until actual test load. The remaining RLS-initplan performance warnings require a separately tested policy review, not an automatic grant widening.
