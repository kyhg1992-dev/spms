# PM-to-Work-Order Integration

## Purpose

The PM-to-work-order foundation connects preventive maintenance planning to real execution while preventing duplicate operational orders for the same PM schedule and asset.

## Service

`src/services/firestore/pm-work-order-service.ts`

Primary function:

- `generateWorkOrderFromPMSchedule`

Exported through:

- `generatePMWorkOrder` in `src/services/firestore/spms-service.ts`

## Duplicate Prevention

Before creating a PM work order, the service queries `workOrders` for the same:

- `assetId`
- `pmScheduleId`
- active work order status:
  - `open`
  - `assigned`
  - `in_progress`
  - `waiting_parts`
  - `waiting_approval`

If a matching open work order exists, the service returns that work order id and marks `duplicatePrevented=true`.

## Work Order Linkage

Generated work orders include:

- `pmScheduleId`
- `sourceType: "PM"`
- `sourceRef: "pmSchedules/{id}"`
- `lifecycleStatus: "OPEN"`
- `status: "open"`
- `approvalRequired: true`

The PM schedule stores:

- `lastGeneratedWorkOrderId`

## Audit and Notifications

On successful generation:

- Audit action: `pm.work_order_generated`
- Notification event: `PM_WORK_ORDER_GENERATED`
- Target roles: manager and admin
- Notification links to the generated work order.

## Non-Goals

- No automatic background scheduler.
- No assignment automation.
- No ERP-style planning board.
- No duplicate lifecycle engine.
