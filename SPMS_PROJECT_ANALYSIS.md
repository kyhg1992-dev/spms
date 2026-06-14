# SPMS Project Analysis

## Scope

This document records the current state of SPMS after a source-only review. No application code, architecture, package setup, or Firebase business logic was changed during this analysis.

## Application Summary

SPMS is a React + TypeScript + Firebase preventive maintenance application built with Vite. The app is organized as a protected dashboard experience with Arabic UI copy, Firestore-backed operational data, Firebase Auth profiles, Firebase Storage for asset images, and Firestore security rules aligned to SPMS roles.

The strongest implemented area is asset management: assets can be listed, filtered, created, edited, deleted, assigned, imaged, viewed in detail, linked by QR code, and extended with meter readings. The dashboard, PM schedule table, work order read views, notifications inbox, users list, reports preview, activity log, and settings pages are present but vary in functional depth.

## Runtime And Tooling

- Frontend: React 19, React DOM 19, Vite 8, TypeScript 6.
- Routing: React Router 7 with route-level protected layout.
- Data fetching: TanStack React Query plus Firestore snapshot subscriptions for core collections.
- UI: Radix primitives, local `components/ui`, lucide-react icons, Recharts, qrcode.react, sonner.
- Forms and validation: react-hook-form, Zod, @hookform/resolvers.
- Backend services: Firebase Auth, Cloud Firestore, Firebase Storage.
- Dev/admin tooling: Firebase CLI, firebase-admin, tsx seed script.

## Source Structure

- `src/router.tsx` defines public routes, protected dashboard routes, and the admin redirect.
- `src/contexts/auth-context.tsx` owns Firebase Auth state and ensures a user profile document exists.
- `src/models/firestore.ts` defines the current Firestore domain model.
- `src/api/spms-firestore.ts` contains direct read/subscription queries used by hooks.
- `src/hooks/use-spms-data.ts` wraps reads with React Query and live snapshot updates.
- `src/services/firestore/*` contains generic CRUD, role permission checks, higher-level SPMS service functions, and seed data.
- `src/pages/spms/*` contains dashboard modules.
- `src/components/assets/*` contains asset create/edit/delete and meter-reading components.
- `firestore.rules`, `firestore.indexes.json`, `storage.rules`, and `firebase.json` define Firebase deployment/runtime policy.

## Data Model

The canonical domain entities are:

- `users`
- `assets`
- `workOrders`
- `pmSchedules`
- `notifications`
- `meterReadings`
- `activityLogs`
- `attachments`
- `companySettings`

The model already anticipates enterprise SPMS needs such as work order priorities, downtime, labor hours, estimated/actual cost, approval metadata, PM service types, time/hour/km triggers, QR payloads, asset warranty/vendor fields, meter anomalies, attachments, and company-level settings.

## Authentication And Roles

Firebase Auth is the login provider. On sign-in, the app ensures a matching Firestore `users/{uid}` profile exists. Role inference is available for newly created profiles, then Firestore profile data becomes the role source.

Supported roles:

- `admin`
- `manager`
- `technician`
- `requester`

Role access is enforced in two places:

- Client-side `canAccess()` matrix in `src/services/firestore/permissions.ts`.
- Firestore security rules in `firestore.rules`.

This gives a useful defense-in-depth baseline, although the client matrix and Firestore rules are not perfectly identical in every collection/action.

## Implemented Functional Strengths

- Protected dashboard shell with role-filtered navigation.
- Live Firestore reads for assets, work orders, PM schedules, and notifications.
- Asset CRUD with validation and image upload/delete support.
- Asset detail page with QR code generation.
- Meter reading capture with non-negative delta validation.
- Dashboard KPIs and charts from live snapshots.
- PM schedule list with overdue detection.
- Work order list and detail read views.
- Notification inbox filtered by role/user.
- Company settings read/update flow.
- Activity log viewer and non-blocking audit writes for some asset/meter actions.
- Seed flow for realistic initial Firestore data.
- Firestore rules covering the current collection set.

## Current Implementation Pattern

The app uses two overlapping data access styles:

- `src/api/spms-firestore.ts` for page-level query reads and subscriptions.
- `src/services/firestore/spms-service.ts` for permission-checked writes and generic CRUD operations.

This is workable today, but future feature work should be careful to avoid splitting business rules further across page code, hook code, service code, and Firestore rules.

## Key Risks

- Several domain models are defined more fully than the UI currently supports.
- Work orders and PM schedules are mostly read/display modules, not full operational workflows.
- Notifications are displayed but cannot be marked read or acted on.
- Attachments exist in model/rules/service but no complete UI flow exists.
- Reports are currently a CSV/status-distribution preview, not a reporting subsystem.
- Some audit logging is best-effort and partial rather than systematic.
- README still appears to be the default Vite template and does not describe SPMS setup.

