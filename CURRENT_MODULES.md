# Current Modules

## Application Shell

### Root App

- Files: `src/main.tsx`, `src/App.tsx`, `src/router.tsx`, `src/router/root-redirect.tsx`.
- Purpose: initializes React, providers, router, and default redirects.
- Status: implemented.

### Dashboard Layout

- File: `src/components/dashboard/dashboard-layout.tsx`.
- Features: sidebar navigation, mobile sheet navigation, user menu, logout, theme toggle, breadcrumbs, command palette trigger.
- Role behavior: hides activity and users routes unless role is `admin` or `manager`.
- Status: implemented.

### Global Command Palette

- File: `src/components/layout/global-command.tsx`.
- Features: navigates to known dashboard sections and filters role-specific links.
- Status: implemented as navigation only.

## Authentication And Access

### Auth Context

- File: `src/contexts/auth-context.tsx`.
- Features: email/password login, logout, auth-state listener, profile loading, profile auto-create.
- Status: implemented.

### Protected Routes

- Files: `src/components/auth/protected-route.tsx`, `src/components/auth/role-gate.tsx`.
- Features: route-level and component-level role gates.
- Status: implemented.

### Permissions Matrix

- File: `src/services/firestore/permissions.ts`.
- Features: client-side CRUD matrix for all modeled collections.
- Status: implemented.

## Firebase And Data Access

### Firebase Client

- File: `src/lib/firebase.ts`.
- Features: Firebase app/Auth/Firestore/Storage initialization, optional browser emulator wiring, Node-safe env reads for seed scripts.
- Status: implemented.

### Firestore Read API

- File: `src/api/spms-firestore.ts`.
- Features: fetch and subscribe for assets, work orders, PM schedules, notifications; fetch users, meter readings, settings, activity logs.
- Status: implemented for current read needs.

### React Query Hooks

- File: `src/hooks/use-spms-data.ts`.
- Features: query wrappers and live cache updates for selected collections.
- Status: implemented.

### Firestore CRUD Service

- Files: `src/services/firestore/crud.ts`, `src/services/firestore/spms-service.ts`.
- Features: generic create/read/update/delete, timestamp stamping, permission-checked domain service functions.
- Status: implemented, though not all service functions have UI consumers.

### Audit Service

- File: `src/services/audit.ts`.
- Features: best-effort activity log append.
- Status: partially used by asset and meter flows.

## Domain Model And Utilities

### Firestore Types

- File: `src/models/firestore.ts`.
- Entities: users, assets, work orders, PM schedules, notifications, meter readings, activity logs, attachments, company settings.
- Status: implemented.

### Normalizers

- Files: `src/lib/asset-normalize.ts`, `src/lib/work-order-normalize.ts`, `src/lib/pm-schedule-normalize.ts`, `src/lib/notification-normalize.ts`.
- Features: Firestore document normalization and legacy field/status handling.
- Status: implemented.

### Labels And Formatting

- Files: `src/lib/labels-ar.ts`, `src/lib/format.ts`, `src/lib/asset-categories.ts`, `src/lib/csv-filename.ts`.
- Features: Arabic labels, Arabic date formatting, category labels, CSV filename generation.
- Status: implemented.

## Dashboard Modules

### Home Dashboard

- File: `src/pages/spms/dashboard-home-page.tsx`.
- Features: KPI tiles, availability/MTBF/MTTR/cost calculations, active work orders, overdue PM, unread alerts, technician workload, upcoming PM, Recharts charts.
- Data source: assets, work orders, PM schedules, notifications.
- Status: implemented as snapshot-derived analytics.

### Asset Management

- Files: `src/pages/spms/assets/assets-list-page.tsx`, `src/pages/spms/assets/asset-detail-page.tsx`, `src/components/assets/asset-form-dialog.tsx`, `src/components/assets/asset-delete-dialog.tsx`, `src/components/assets/asset-meter-panel.tsx`.
- Features: list, search, filter, pagination, create, edit, delete, image upload/delete, detail view, QR code, meter reading capture/history.
- Status: strongest and most complete operational module.

### Work Orders

- Files: `src/pages/spms/work-orders/work-orders-list-page.tsx`, `src/pages/spms/work-orders/work-order-detail-page.tsx`.
- Features: list, detail view, print action, status/priority display, asset name lookup, cost/downtime/labor display.
- Status: read/display only. Create button is disabled and labeled as coming soon.

### Preventive Maintenance Schedules

- File: `src/pages/spms/pm-schedules-page.tsx`.
- Features: list PM schedules, show service type/trigger mode, overdue detection, active/paused badges, asset name lookup.
- Status: read/display only.

### Notifications

- File: `src/pages/spms/notifications-page.tsx`.
- Features: inbox list, role/user filtering through query hook, unread badge display, reference path display.
- Status: read/display only.

### Reports

- File: `src/pages/spms/reports-page.tsx`.
- Features: report cards, work order status distribution table, CSV preview export.
- Status: preview-level reporting.

### Users

- File: `src/pages/spms/users-page.tsx`.
- Features: admin/manager gated table of users, role and active status display.
- Status: read-only user management.

### Activity Log

- File: `src/pages/spms/activity-log-page.tsx`.
- Features: admin/manager gated activity log table.
- Status: read-only viewer. Audit writes are partial across the app.

### Settings

- File: `src/pages/spms/settings-page.tsx`.
- Features: company profile/settings form, PM reminder days, meter anomaly percentage, maintenance annual budget.
- Status: implemented for `companySettings/main`.

## Public Pages

- `src/pages/home-page.tsx`: public home/landing route.
- `src/pages/login-page.tsx`: login form.
- `src/pages/about-page.tsx`: protected about page.
- `src/pages/admin-page.tsx`: present but current router redirects `/admin` to `/dashboard/users`.

## Firebase Rules And Deployment Config

- `firestore.rules`: role-based collection access rules with temporary seed bypass for `admin@spms.test`.
- `firestore.indexes.json`: Firestore indexes for current queries.
- `storage.rules`: Storage access policy.
- `firebase.json`: Firebase hosting/emulator config.
- Status: present and aligned with current Firebase structure.

## Seed Module

- Files: `scripts/seed-cli.ts`, `src/services/firestore/seed.ts`.
- Features: signs in using environment credentials, seeds company settings, assets, work orders, PM schedules, meter readings, and notifications.
- Status: implemented for development/demo data.

