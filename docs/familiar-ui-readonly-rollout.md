# Authenticated familiar Salong UI: read-only rollout

Route: `https://salong-api-production.up.railway.app/crm`.

This release lets a signed-in owner use **Vis Salong-grensesnittet** to see real imported PostgreSQL organizations inside the **existing** Salong UI. It is a preview, not the full production CRM.

## Security and data isolation

- The parent `/crm` page authenticates with Supabase and calls `GET /api/organizations` with the bearer token. An unauthenticated caller cannot load company rows from the API.
- After successful fetch, the parent creates a same-origin iframe at `/crm/workspace#prosp` and sends the already-validated rows via `postMessage`. The iframe requires matching `event.origin` and `event.source`; the token never enters the iframe.
- `/crm/workspace` contains only the **public source-built** Salong UI. It never includes customer data, passwords, tokens or the user's Artifact export. Embedded synthetic demo data are cleared before the app renders, and virtual research profiles are disabled.
- The familiar UI operates with `readOnly=true`. It has no server write credentials and explicitly blocks send/import/edit/sequence buttons. Its status reads `Ekte Supabase-data · lesemodus`. Refreshing the login page loads an updated snapshot.
- CSP only allows the SHA-256 hash of the known inline app script; scripts not matching it cannot run. The iframe is restricted to same-origin parents.
- The public demo service `Salong` is **not** rebuilt or redeployed. Only the `Salong API` Dockerfile builds a distinct copy of the frontend, under `server/public`.

## Limitations

- This is **not yet permanent editing**: contacts, tasks, pipeline, sequences, outreach and calendar still need authenticated server-side CRUD, validation and audit. Do not use the preview for sending or updates.
- The current UI retains some prototype labels and derived scoring logic, and does not load the original Artifact enrichment raw fields into active records. Any fit/evidence gap should display as unknown, not be invented.
- Browser iframe state is an in-memory snapshot; logout destroys it.
- The monthly outreach target of 500 must be addressed in a later dedicated pacing/activities module, not by capping visible daily tasks to seven.

## Release checklist

1. PR tests: full Salong build, API unit/auth security tests, PostgreSQL tests, Docker image.
2. Merge the prerequisite organization bridge PR #80; then this PR.
3. Trigger a fresh build for **Salong API only** from the latest `main` and verify commit SHA, status SUCCESS.
4. Sign in to `/crm` and click **Vis Salong-grensesnittet**. Confirm the new view shows exactly 154 organizations (A=26, B=93, C=35), no demo companies, and that edit/send buttons are hidden or blocked.
5. Keep the old static demo URL untouched. Only after the write APIs are ready should this be presented as a fully operational CRM.
