# Admin Reassignment and Delegation Architecture

## Purpose

The Admin Reassignment and Delegation foundation gives SPMS a controlled way for system admins and managers to move work between technicians, supervisors, and temporary replacements. In an industrial maintenance platform, reassignment and delegation must be auditable, operationally realistic, and safe for future escalation workflows.

This phase does not redesign pages. It adds service, model, notification, audit, and minimal reusable UI foundations.

## Core Files

- `src/services/firestore/admin-delegation-service.ts`
  - Admin/manager-controlled reassignment wrapper.
  - Delegation create/cancel/accept service functions.
  - Active user validation.
  - Terminal work order validation.
  - Audit and notification hooks.

- `src/services/firestore/work-order-lifecycle-service.ts`
  - Existing lifecycle reassignment service.
  - Reused by admin reassignment instead of duplicating reassignment mutation logic.

- `src/components/work-orders/work-order-reassignment-dialog.tsx`
  - Minimal reusable reassignment dialog component.
  - Bilingual-ready Arabic labels.
  - RTL/LTR prop support.
  - No page redesign or route integration in this phase.

- `src/models/firestore.ts`
  - Adds delegation status and delegation history fields.

- `src/lib/work-order-normalize.ts`
  - Normalizes delegation fields and history.

- `src/lib/notification-engine.ts`
  - Adds delegation event notification support.

## Reassignment Model

Supported fields:

- `assignedTo`
- `assignedBy`
- `reassignedAt`
- `reassignmentReason`
- `reassignmentHistory[]`

History entries include:

- previous assignee
- new assignee
- reassigned by
- reassigned at
- reassignment reason

The compatibility field `assigneeId` is also updated so existing pages and dashboard logic continue to work.

## Delegation Model

Supported fields:

- `delegatedFrom`
- `delegatedTo`
- `delegatedBy`
- `delegatedAt`
- `delegationReason`
- `delegationExpiresAt`
- `delegationStatus`
- `delegationHistory[]`

Delegation statuses:

- `ACTIVE`
- `EXPIRED`
- `CANCELLED`

Delegation history supports future vacation coverage, temporary replacement users, workshop supervisor handoff, and multi-site delegation rules.

## Validation Rules

Admin reassignment:

- Only `admin` or `manager` can reassign through this service.
- Technician reassignment is blocked unless explicitly supported in a future phase.
- `CLOSED` and `CANCELLED` work orders cannot be reassigned.
- Reassignment reason is required.
- New assignee must be an active user.
- New assignee must be a technician or manager.

Delegation:

- Only `admin` or `manager` can create or cancel delegation.
- Source and target users must be active.
- Source and target users must be technicians or managers.
- `CLOSED` and `CANCELLED` work orders cannot be delegated.
- Delegation reason is required.
- Delegated user can accept an active delegation.

## Audit Hooks

Audit events:

- `work_order.reassign`
- `work_order.delegation_created`
- `work_order.delegation_cancelled`
- `work_order.delegated_task_accepted`

The existing lifecycle reassignment audit is reused for reassignment. Delegation adds dedicated audit records.

## Notification Hooks

Notifications are emitted for:

- old assignee on reassignment,
- new assignee on reassignment,
- manager/admin operational awareness,
- requester when applicable,
- delegated-from and delegated-to users,
- delegation cancellation,
- delegated task acceptance.

Notification generation uses the centralized notification engine and remains ready for future mobile push, email, WhatsApp, and escalation delivery.

## Minimal UI Foundation

The reusable `WorkOrderReassignmentDialog` provides:

- current assignee display,
- new assignee select,
- reassignment reason input,
- admin/manager role guard,
- RTL/LTR support through `dir`,
- no dashboard or work order page redesign.

Future pages can mount this component inside existing actions menus or detail screens.

## Future Scalability

The foundation supports future:

- multi-site delegation,
- vacation/absence replacement,
- temporary workshop supervisor handoff,
- escalation-driven reassignment,
- skill-based technician assignment,
- delegation expiry automation,
- delegation acceptance/decline mobile flow,
- audit and compliance reports.

## Non-Goals In This Phase

- No full work order UI redesign.
- No dashboard redesign.
- No new package installation.
- No new backend architecture.
- No automatic delegation expiry scheduler.
- No technician self-reassignment.

