# Technician Execution Architecture

## Purpose

The Technician Execution foundation defines the service layer for fast, realistic work order execution in industrial workshops. It is designed for future mobile use, field conditions, photo capture, checklists, meter readings, and supervisor approval without redesigning the current UI.

This phase is service-oriented only.

## Core Files

- `src/lib/technician-execution.ts`
  - Pure validation and execution utility functions.
  - Validates start, draft, completion, and notes.
  - Determines whether completion moves to `WAITING_APPROVAL` or `COMPLETED`.

- `src/services/firestore/technician-execution-service.ts`
  - Firestore service for technician actions.
  - Applies execution updates through batched writes.
  - Writes activity audit events.
  - Emits supervisor notifications through the notification engine on completion.

- `src/services/firestore/spms-service.ts`
  - Exposes technician execution actions through the existing service boundary.

- `src/models/firestore.ts`
  - Adds execution fields to the `WorkOrder` model.

- `src/lib/work-order-normalize.ts`
  - Normalizes execution fields from Firestore documents.

## Execution Data Model

Work orders now support:

- `executionStartedAt`
- `executionCompletedAt`
- `technicianNotes`
- `completionNotes`
- `actualLaborHours`
- `actualDowntimeHours`
- `meterReadingAtExecution`
- `executionChecklist[]`
- `executionPhotos`
- `requiredPartsNote`
- `safetyNotes`

Compatibility fields are also maintained:

- `laborHours`
- `downtimeHours`
- `attachmentsPlaceholder`

This keeps existing reporting and lifecycle logic usable while giving future mobile execution screens a cleaner operational shape.

## Technician Actions

Service entry points exposed from `spms-service.ts`:

- `startTechnicianExecution(...)`
- `saveTechnicianExecutionDraft(...)`
- `completeTechnicianExecution(...)`
- `addTechnicianExecutionNote(...)`

These functions are intended for future technician mobile and workshop interfaces.

## Validation Rules

Execution start:

- Work order must be `ASSIGNED` or `IN_PROGRESS`.
- Work order must have an assigned technician.
- Starting execution moves the work order to `IN_PROGRESS`.

Execution draft:

- Can be saved while the work order is operational.
- Draft data can include notes, checklist state, labor/downtime, meter snapshot, photo placeholders, parts notes, and safety notes.

Execution completion:

- Technician cannot complete without completion notes.
- Technician cannot complete without labor hours.
- Technician cannot complete unless the work order is `ASSIGNED` or `IN_PROGRESS`.
- If `approvalRequired=true`, completion moves to `WAITING_APPROVAL`.
- If `approvalRequired=false`, completion moves to `COMPLETED`.

Execution notes:

- Notes are appended to `technicianNotes`.
- Empty notes are rejected.

## Audit Hooks

The execution service writes audit records for:

- `work_order.execution_started`
- `work_order.execution_draft_saved`
- `work_order.execution_completed`
- `work_order.execution_note_added`

Audit records are stored in `activityLogs` and include:

- `actorUid`
- `actionKey`
- `entityType`
- `entityId`
- `labelAr`
- `createdAt`
- `updatedAt`

## Notification Hooks

When execution is completed:

- Supervisor/admin notifications are emitted through the notification engine.
- If approval is required, the event is `WORK_ORDER_WAITING_APPROVAL`.
- If no approval is required, the event is `WORK_ORDER_COMPLETED`.

When a work order is returned or rejected later:

- The existing work order lifecycle approval rejection flow emits `APPROVAL_REJECTED` to the technician/requester targets.

## Mobile-Readiness

The execution model is intentionally mobile-friendly:

- Draft saves are separate from completion.
- Checklist state is stored as an array.
- Photo support starts as `executionPhotos` placeholders.
- Meter data can be captured as a compact object.
- Notes are append-friendly.
- The shape supports offline-first UI later because a mobile screen can collect a draft object and submit it when connectivity is available.

## Future Extension Points

Recommended next phases:

- Mobile technician execution screen.
- Photo upload service integration.
- Execution checklist templates by work order type or PM service type.
- Offline queue for draft execution updates.
- Parts consumption integration.
- Safety checklist enforcement.
- Supervisor approval queue UI.
- Notifications for returned/rejected execution corrections.

## Non-Goals In This Phase

- No UI redesign.
- No attachment upload implementation.
- No offline queue implementation.
- No new packages.
- No replacement of work order lifecycle or notification architecture.

