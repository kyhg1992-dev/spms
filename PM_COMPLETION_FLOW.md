# PM Completion Flow

## Purpose

The PM completion foundation lets SPMS complete a preventive maintenance schedule through a linked work order and calculate the next due plan using accepted meter context.

## Service

`src/services/firestore/pm-work-order-service.ts`

Primary function:

- `completePMThroughWorkOrder`

Exported through:

- `completePMFromWorkOrder` in `src/services/firestore/spms-service.ts`

## Completion Inputs

The service requires:

- `pmScheduleId`
- linked `workOrderId`
- `actorUid`
- user role with PM schedule update permission

The service validates:

- Work order exists.
- PM schedule exists.
- Work order asset matches schedule asset.
- If the work order has `pmScheduleId`, it must match the requested schedule.

## Meter Basis

Completion recalculation uses the strongest available meter context:

- Current asset meter snapshot.
- Latest meter reading for operating hours.
- Latest meter reading for odometer.
- Work order `meterReadingAtExecution` when present.

## Recalculated Fields

On completion, the PM schedule updates:

- `lastRunAt`
- `lastCompletedWorkOrderId`
- `nextRunAt`
- `nextDueHours`
- `nextDueKm`
- `overdueStatus`
- `dueSoonStatus`
- `pmStatus`

The completion patch resets the completed schedule to operationally healthy status and schedules the next run from the completion date.

## Audit and Notifications

On completion:

- Audit action: `pm.completed_from_work_order`
- Notification event: `PM_COMPLETED_NEXT_SCHEDULED`
- Target roles: manager and admin

## Non-Goals

- No automatic closure of the linked work order.
- No replacement of technician execution validation.
- No new PM history collection yet.
