# PM Engine Architecture

## Purpose

The SPMS PM engine is the foundational logic layer for preventive maintenance calculations. It is designed for an industrial maintenance environment where asset meters, PM schedules, due logic, anomaly detection, and audit history must remain consistent and traceable.

This phase intentionally does not add a full UI. It establishes reusable services and utilities that future screens, automations, and reports can depend on.

## Design Principles

- Preserve the existing React + Firebase architecture.
- Keep PM calculations reusable and testable.
- Keep Firestore writes centralized and auditable.
- Avoid introducing backend frameworks, queues, or unnecessary packages.
- Support time-based, hour-based, kilometer-based, and combined PM schedules.
- Treat meter capture as an operational event, not a simple form write.
- Maintain technician-friendly behavior while preserving enterprise governance.

## Core Files

- `src/lib/pm-engine.ts`
  - Pure PM calculation utilities.
  - No UI dependencies.
  - Calculates PM status, due soon state, overdue state, meter thresholds, and anomaly results.

- `src/services/firestore/pm-engine-service.ts`
  - Firestore orchestration layer for PM engine operations.
  - Records meter readings.
  - Updates asset meter snapshots.
  - Recalculates PM schedules for the affected asset.
  - Writes audit events for meter update, PM recalculation, and anomaly detection.

- `src/models/firestore.ts`
  - Adds PM status fields to `PMSchedule`.

- `src/lib/pm-schedule-normalize.ts`
  - Normalizes persisted PM engine status fields.

- `firestore.rules`
  - Allows narrow PM engine writes for operational roles without granting broad edit permissions.

## PM Status Model

The PM engine uses four status values:

- `OK`: maintenance is not yet near its due threshold.
- `DUE_SOON`: maintenance is approaching its due threshold.
- `OVERDUE`: maintenance is past its scheduled time or meter threshold.
- `CRITICAL`: maintenance is materially past due and should be treated as urgent.

Persisted PM schedule fields:

- `nextDueKm`
- `nextDueHours`
- `nextRunAt`
- `overdueStatus`
- `dueSoonStatus`
- `pmStatus`

## Trigger Types

SPMS supports the existing `PMTriggerMode` values:

- `time`: calendar-based maintenance using `frequencyDays` and `nextRunAt`.
- `hours`: operating-hours maintenance using `meterHoursInterval` and `nextDueHours`.
- `km`: odometer-based maintenance using `meterKmInterval` and `nextDueKm`.
- `both`: combined calendar and meter logic; the highest-severity status wins.

## Meter Capture Flow

The engine flow is:

1. Technician, manager, or admin records a meter value.
2. The service checks role permission for `meterReadings.create`.
3. The current asset is loaded.
4. Latest same-kind meter reading is loaded from recent readings.
5. Company setting `meterAnomalyPct` is loaded.
6. The engine validates rollback safety.
7. The engine detects anomaly conditions.
8. Asset meter snapshot is updated safely.
9. All PM schedules for that asset are recalculated.
10. A Firestore batch writes:
    - new `meterReadings` document,
    - asset meter fields,
    - PM schedule status fields,
    - audit log records.

## Safety Rules

- Negative meter values are rejected.
- Meter rollback is rejected.
- Large forward jumps are accepted but flagged as anomalies.
- Asset meter snapshots are updated only for the submitted meter kind.
- PM recalculation is scoped to schedules for the affected asset.
- Firestore security rules allow only the narrow calculated fields for PM engine updates.

## Anomaly Detection

The anomaly threshold comes from:

- `companySettings/main.meterAnomalyPct`

If not configured, the default threshold is 30%.

Current anomaly categories:

- `METER_ROLLBACK`: rejected because the submitted value is below current/latest value.
- `DELTA_EXCEEDS_THRESHOLD`: accepted but flagged for review.

The `meterReadings.anomalyFlag` field records whether the reading should be reviewed.

## Audit Events

The PM engine writes audit records for:

- `meter.update`
- `pm.recalculate`
- `meter.anomaly`

Audit logs are written to `activityLogs` with:

- `actorUid`
- `actionKey`
- `entityType`
- `entityId`
- `labelAr`
- `createdAt`
- `updatedAt`

## Security Boundary

Firestore rules preserve the existing role model while allowing the engine to function:

- Technicians can create meter readings.
- Operational roles can update only asset meter fields: `operatingHours`, `odometer`, `updatedAt`.
- Operational roles can update only PM engine fields: `nextDueHours`, `nextDueKm`, `nextRunAt`, `overdueStatus`, `dueSoonStatus`, `pmStatus`, `updatedAt`.
- Broad asset and PM schedule edits remain restricted to admin/manager flows.

## Future Extension Points

Recommended next phases:

- PM completion workflow that advances `nextRunAt`, `nextDueHours`, and `nextDueKm`.
- Auto-created work orders for overdue or due PM schedules.
- PM schedule editor using the same calculation utilities.
- Dedicated PM compliance reports.
- Technician mobile close-out flow.
- Scheduled background recalculation for purely time-based PM.
- Notification generation for `DUE_SOON`, `OVERDUE`, and `CRITICAL` status changes.
- Emulator tests for rules and PM engine writes.

## Non-Goals In This Phase

- No UI redesign.
- No full PM schedule CRUD UI.
- No full work order lifecycle implementation.
- No new backend framework.
- No new package installation.
- No replacement of existing services or hooks.

