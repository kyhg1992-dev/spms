# Demo Data Setup

## Purpose

This document explains how to prepare realistic SPMS pilot data without changing production architecture. Demo data is intended for controlled workshop validation only and should be reviewed before any real operational pilot.

## What the Pilot Seed Creates

The pilot seed utility can create:

- Company settings for a Riyadh-based workshop pilot.
- Admin, manager, and technician user profile documents when real Firebase Auth UIDs are supplied.
- Three realistic workshop assets:
  - Forklift 3 Ton.
  - Standby Generator 800 kVA.
  - Service Truck.
- PM schedules covering time, hour, kilometer, and combined triggers.
- Work orders for PM validation and technician execution validation.
- A manager notification for an overdue PM scenario.

The seed content is bilingual-friendly and includes Arabic/English operational labels where useful.

## Prerequisites

1. Create Firebase Auth users for the pilot team.
2. Ensure each pilot user has a real Firebase Auth UID.
3. Confirm the seeding operator can sign in and has an `admin` or `manager` role profile.
4. Confirm `.env.local` contains all required `VITE_FIREBASE_*` values.
5. Confirm Firestore rules and indexes are ready for the target Firebase project.

## Environment Variables

Set these variables before running the pilot seed:

```powershell
$env:SEED_EMAIL="admin@example.com"
$env:SEED_PASSWORD="replace-with-admin-password"
$env:PILOT_USERS_JSON='[
  {"uid":"firebase-admin-uid","email":"admin@example.com","displayName":"Pilot Admin / مسؤول التجربة","role":"admin"},
  {"uid":"firebase-manager-uid","email":"manager@example.com","displayName":"Workshop Manager / مدير الورشة","role":"manager"},
  {"uid":"firebase-tech-1-uid","email":"tech1@example.com","displayName":"Mechanical Technician / فني ميكانيكا","role":"technician"},
  {"uid":"firebase-tech-2-uid","email":"tech2@example.com","displayName":"Electrical Technician / فني كهرباء","role":"technician"}
]'
```

If `PILOT_USERS_JSON` is omitted, placeholder users are skipped and the seed prints warnings. This is safe for local testing but not sufficient for a realistic pilot.

## Run Seed

```powershell
npm.cmd run seed:pilot
```

Expected output:

- Created Firestore document paths.
- Warnings for skipped placeholder users or recoverable issues.
- A reset order plan listing created document paths in reverse order.

## Reset Discipline

The pilot seed does not delete data automatically. The reset helper only prints an ordered deletion plan so an admin can review it before any destructive operation.

For pilot safety:

- Do not reset real pilot data during active workshop use.
- Export or back up collections before deleting pilot documents.
- Delete generated work orders and notifications before deleting assets or PM schedules.
- Preserve audit logs unless a formal test-data cleanup policy has been approved.

## Validation After Seeding

After running the seed, verify:

- Admin can log in and view all pilot records.
- Manager can see PM schedules, work orders, and notifications.
- Technician can only see assigned work orders.
- The overdue generator PM is visible.
- PM-generated work order duplicate prevention still blocks duplicate open orders.
- Notification read/archive actions work on the seeded notification.

## Pilot Data Boundaries

Demo data should remain visibly identifiable using the `PILOT-` prefix. Do not mix unlabelled demo assets with real customer equipment during a controlled pilot.
