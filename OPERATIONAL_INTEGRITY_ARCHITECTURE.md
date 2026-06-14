# Operational Integrity Architecture

## Purpose

SPMS must prevent operational drift between PM planning, work orders, technician execution, approvals, notifications, and meter readings. This foundation adds defensive checks without turning the MVP into a heavy ERP.

## Implemented Foundation

- `src/lib/operational-integrity.ts`
  - Duplicate PM work order check.
  - PM schedule/work order link validation.
  - Duplicate execution completion check.
  - Orphan approval/rejection check.
  - Delegation consistency check.
  - Meter progression check.
- `src/services/firestore/pm-work-order-service.ts`
  - Reuses PM/work-order link validation before PM completion.
  - Keeps duplicate PM-generated work order prevention.
- `src/lib/operational-health.ts`
  - Provides lightweight health checks for orphan PM work orders, overdue PMs, and work orders with missing assets.

## Protected Edge Cases

- Duplicate PM-generated work orders.
- PM completion against the wrong asset or schedule.
- Duplicate execution completion.
- Orphan approvals/rejections.
- Incomplete delegation state.
- Meter rollback corruption.

## Future Hardening

The strongest integrity model is to enforce lifecycle transitions, PM recalculation, audit writing, and notification generation in Cloud Functions or another trusted backend.
