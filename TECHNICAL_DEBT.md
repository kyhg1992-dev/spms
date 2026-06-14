# Technical Debt

## Documentation Debt

- `README.md` still contains the default React + Vite template content.
- There is no project-specific setup guide for Firebase config, emulators, seed credentials, roles, or deployment.
- There is no documented Firestore collection contract beyond TypeScript models.
- There is no operator/admin guide for the Arabic dashboard workflows.

## Data Access Duplication

The project currently has two active data access layers:

- Page-facing reads in `src/api/spms-firestore.ts`.
- Permission-checked CRUD in `src/services/firestore/spms-service.ts`.

This is not broken, but it creates a risk that future features will bypass permission checks, normalization, query invalidation, or audit logging inconsistently.

## Client Permissions Vs Firestore Rules

Role behavior is defined in both:

- `src/services/firestore/permissions.ts`
- `firestore.rules`

The broad intent matches, but they are maintained separately. Any future change to roles, collection access, or workflow transitions must update both places.

## Temporary Seed Bypass

`firestore.rules` contains a temporary authenticated seed bypass for `admin@spms.test`. The comment says it should be removed after stable seed UX. Keeping it long-term increases policy complexity and makes production hardening easier to miss.

## Partial Audit Coverage

`appendActivityLog()` is non-blocking and currently used in asset create/update and meter capture flows. Many important actions are not systematically audited yet, including settings updates, notification state changes, work order updates, PM schedule changes, user role changes, attachment changes, and deletes in all modules.

## Incomplete Workflow Enforcement

The model defines rich work order fields and statuses, but there is no central workflow engine for legal status transitions, required fields by transition, approval gates, assignee rules, or close-out validation. Today, service functions can update work orders generically if role permissions allow it.

## Incomplete Query/Error Handling Pattern

Several live subscription hooks pass `undefined` as the snapshot error handler. This means some realtime errors may not surface cleanly to the UI or logs after initial query success.

## Denormalized And Derived Metrics

Dashboard KPIs are useful but heuristic:

- Availability is derived from asset status rather than downtime intervals.
- MTBF uses total operating hours divided by completed work order count.
- MTTR uses created/closed or updated timestamps rather than explicit repair windows.
- Maintenance cost rolls from completed work orders only.

These are acceptable for a dashboard preview, but should not be treated as authoritative maintenance analytics.

## Asset Meter Consistency

Meter readings are recorded in `meterReadings`, but the asset's own `operatingHours` and `odometer` fields are not automatically updated by the meter capture flow. This can cause dashboard and asset detail values to drift from latest meter history unless a user also edits the asset.

## Attachments Are Modeled But Not Complete

The Firestore model, permissions, and rules include `attachments`, but there is no full attachment UI or Storage workflow for work orders, PM schedules, or asset supporting documents. Asset primary image upload is implemented separately.

## User Management Is Read-Only

The users module displays user profiles, roles, and status, but does not provide admin create/invite, role edit, activation/deactivation, department, phone, or specialization management.

## Reports Are Preview-Level

Reports currently export a work order status distribution CSV preview. There is no parameterized report builder, date range selection, asset/department filters, PDF output, scheduled reports, or authoritative analytics layer.

## Notification Lifecycle Is Missing

Notifications can be listed and created through services/seed, but the UI does not mark notifications read/unread, open referenced records, delete/archive notifications, or manage email delivery despite the `channel` field supporting `email`.

## Encoding/Console Readability Risk

Arabic source strings appear as mojibake in the current PowerShell command output. The files may still be UTF-8, but developer tooling should be standardized around UTF-8 to avoid accidental corruption during future edits.

## Generated Artifacts In Workspace

`dist/`, `node_modules/`, and `debug.log` are present in the workspace. This is normal locally, but analysis and source searches should continue excluding generated/dependency directories to avoid noise and accidental edits.

## Testing Gaps

No test suite was found for:

- Firestore service functions.
- Permission matrix behavior.
- Normalizers and legacy migration behavior.
- Asset form validation.
- Dashboard KPI calculations.
- Role-gated routes.
- Firestore rule validation with emulators.

The current app relies heavily on manual verification.

