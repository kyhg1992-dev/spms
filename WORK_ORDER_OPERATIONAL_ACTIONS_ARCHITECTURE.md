# Work Order Operational Actions Architecture

## Purpose

This package exposes the existing SPMS work order lifecycle, technician execution, approval, closure, and reassignment foundations through minimal reusable UI actions. It is an integration layer only; it does not redesign the work order module or replace the React + Firebase service architecture.

## Scope

- `WorkOrderOperationalActions` renders action buttons for execution, approval, closure, and reassignment.
- Actions call existing services from `src/services/firestore/spms-service.ts`.
- Lifecycle eligibility is evaluated with existing utilities from `src/lib/work-order-lifecycle.ts` and `src/lib/technician-execution.ts`.
- The component is embedded on the work order detail page as an operational action strip.

## Operational Rules

- Start execution is allowed only when technician execution validation permits it.
- Draft saving is allowed only for active operational states.
- Completion uses technician execution service validation and completion data.
- Send to approval uses lifecycle transition validation to `WAITING_APPROVAL`.
- Approve, reject, close, and reassign are manager/admin operational actions.
- Reassignment reuses `WorkOrderReassignmentDialog` and `adminReassignWorkOrderControlled`.

## Bilingual and Direction Support

The action component accepts `language` and `dir` props. Arabic/RTL is the default to preserve the current application posture, while English/LTR labels are available for future bilingual switching.

## Non-Goals

- No full page redesign.
- No new workflow engine.
- No package installation.
- No duplicate reassignment, lifecycle, notification, or execution business logic.
