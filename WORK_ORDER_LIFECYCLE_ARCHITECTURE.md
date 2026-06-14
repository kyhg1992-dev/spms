# Work Order Lifecycle Architecture

## Purpose

The SPMS work order lifecycle engine is the foundation for controlled maintenance execution. It centralizes state transitions, reassignment, approvals, completion validation, closure, and audit hooks without redesigning the current UI.

SPMS is an industrial maintenance operations platform. Work orders must support workshops, technicians, supervisors, operational approvals, future mobile execution, future notifications, and enterprise audit requirements.

## Core Files

- `src/lib/work-order-lifecycle.ts`
  - Pure lifecycle utility layer.
  - Defines strict lifecycle states.
  - Validates allowed transitions.
  - Validates completion and reassignment data.
  - Maps lifecycle states to existing Firestore `status` values.

- `src/services/firestore/work-order-lifecycle-service.ts`
  - Firestore orchestration layer.
  - Loads and normalizes work orders.
  - Applies lifecycle transitions through batched writes.
  - Writes audit records for status changes, reassignment, approvals, rejections, and closures.

- `src/services/firestore/spms-service.ts`
  - Exposes lifecycle operations through the existing SPMS service boundary.

- `src/models/firestore.ts`
  - Extends `WorkOrder` with lifecycle, reassignment, approval, completion, and closure fields.

- `src/lib/work-order-normalize.ts`
  - Preserves compatibility with existing lowercase `status` values while normalizing the uppercase lifecycle state.

## Strict Lifecycle States

The lifecycle engine uses uppercase controlled states:

- `OPEN`
- `ASSIGNED`
- `IN_PROGRESS`
- `WAITING_PARTS`
- `WAITING_APPROVAL`
- `COMPLETED`
- `CLOSED`
- `CANCELLED`

The existing Firestore `status` field remains compatible with current pages:

- `open`
- `assigned`
- `in_progress`
- `waiting_parts`
- `waiting_approval`
- `completed`
- `closed`
- `cancelled`

The new `lifecycleStatus` field is the engine-authoritative state for future workflows.

## Transition Rules

Allowed transitions:

- `OPEN` -> `ASSIGNED`, `CANCELLED`
- `ASSIGNED` -> `OPEN`, `IN_PROGRESS`, `CANCELLED`
- `IN_PROGRESS` -> `WAITING_PARTS`, `WAITING_APPROVAL`, `COMPLETED`, `CANCELLED`
- `WAITING_PARTS` -> `IN_PROGRESS`, `CANCELLED`
- `WAITING_APPROVAL` -> `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
- `COMPLETED` -> `CLOSED`
- `CLOSED` -> no transitions
- `CANCELLED` -> no transitions

Important guarantees:

- `CLOSED` cannot move back to `OPEN`.
- `CANCELLED` cannot be reopened by the lifecycle engine.
- `IN_PROGRESS` requires an assigned technician.
- `ASSIGNED` requires an assigned technician.
- `WAITING_APPROVAL` requires `approvalRequired=true`.
- `COMPLETED` requires completion notes, labor hours, and downtime data.
- `CLOSED` requires the work order to be `COMPLETED` first.

## Reassignment Foundation

Supported fields:

- `assignedTo`
- `assignedBy`
- `reassignedAt`
- `reassignmentReason`
- `reassignmentHistory[]`

Compatibility field:

- `assigneeId` is still updated for current pages and existing dashboard logic.

Every reassignment appends a history entry and writes an audit event.

## Approval Foundation

Supported fields:

- `approvalRequired`
- `approvedByUid`
- `approvedAt`
- `rejectedAt`
- `rejectedByUid`
- `rejectionReason`

Approval and rejection actions are restricted to admin/manager roles in the service layer. Rejection returns the work order to `IN_PROGRESS` so technicians can correct or continue work.

## Technician Execution Validation

Completion requires:

- `completionNotes`
- `laborHours`
- `downtimeHours` or `downtimeMinutes`

Optional execution fields:

- `completionMeterReadingId`
- `attachmentsPlaceholder[]`

The attachment placeholder preserves a future path for photos, reports, invoices, and inspection documents without implementing the full attachment UI in this phase.

## Audit Events

The lifecycle service writes `activityLogs` records for:

- `work_order.status_change`
- `work_order.reassign`
- `work_order.approve`
- `work_order.reject`

Closure uses the status-change path and records:

- `closedAt`
- `closedByUid`
- `lifecycleStatus=CLOSED`
- `status=closed`

Audit records include:

- `actorUid`
- `actionKey`
- `entityType`
- `entityId`
- `labelAr`
- `createdAt`
- `updatedAt`

## Service Entry Points

Exposed from `src/services/firestore/spms-service.ts`:

- `transitionWorkOrder(...)`
- `reassignWorkOrder(...)`
- `approveWorkOrder(...)`
- `rejectWorkOrder(...)`
- `closeWorkOrder(...)`

These functions keep future UI and mobile screens service-oriented and avoid duplicating lifecycle rules in components.

## Compatibility Strategy

The lifecycle engine does not remove existing fields or behavior. It adds:

- uppercase `lifecycleStatus` for strict workflow control,
- lowercase `status` updates for current pages,
- `assignedTo` while preserving `assigneeId`,
- completion and approval fields for future execution screens.

This allows current work order list/detail pages to continue functioning while the platform moves toward controlled industrial workflows.

## Future Extension Points

Recommended next phases:

- Work order create/edit UI using lifecycle service functions.
- Technician mobile execution screen.
- Supervisor approval queue.
- Automatic notifications for assignment, approval, rejection, completion, and closure.
- Attachment upload integration.
- Spare parts reservation and consumption.
- Rule/emulator tests for lifecycle permissions.
- Reporting around reassignment, downtime, labor, and closure performance.

## Non-Goals In This Phase

- No UI redesign.
- No full work order page rebuild.
- No package installation.
- No replacement of Firebase, React Query, routing, or existing service patterns.
- No notification implementation yet.

