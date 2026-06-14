# Firebase Hardening Architecture

## Purpose

This phase strengthens SPMS Firebase posture while preserving the current React + Firebase architecture. The focus is operational trust: least privilege where feasible, immutable audit records, safer query shapes, and documented production boundaries.

## Firestore Rules Changes

- Work order reads are role scoped:
  - Admin/manager can read all.
  - Technician/requester reads are limited to assigned or requested records.
- Technician work order updates are limited to execution fields and safe execution status movement.
- Reassignment, delegation, approval, closure, PM linkage, and source fields are manager/admin controlled.
- PM schedule writes are manager/admin controlled.
- Technician PM recalculation writes are limited to PM engine-calculated fields.
- Meter readings are immutable after create.
- Activity logs are create-only and cannot be updated or deleted.
- Notification updates are limited to read/archive style user actions.

## Client Query Alignment

`useWorkOrdersQuery` and `spms-firestore` now use role-aware work order queries so technician/requester views do not request unauthorized collection-wide data.

## Query and Index Safeguards

Production indexes cover notification inbox reads, scoped work order reads, PM-generated work order duplicate checks, meter readings by asset/kind, and PM schedules by asset. Manager dashboard/report reads remain intentionally simple collection reads for MVP scale and should move to paginated or server-aggregated reads as data volume grows.

## Known Production Boundary

Some operational services still write audit logs and notifications directly from the client. Rules now constrain shape and fields, but the strongest production pattern is to move notification generation, audit writing, PM recalculation, and lifecycle transition enforcement into Cloud Functions or a trusted backend.

## Non-Goals

- No architecture rebuild.
- No package installation.
- No Cloud Functions implementation in this phase.
- No production build.
