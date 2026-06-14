# Work Order Timeline Architecture

## Purpose

The work order timeline foundation provides a reusable operational history view for SPMS work orders. It summarizes lifecycle, reassignment, delegation, technician execution, approval, rejection, closure, and audit activity in a compact component suitable for future detail pages and mobile technician views.

## Files

- `src/lib/work-order-timeline.ts`
  - Builds normalized timeline entries from a work order and optional audit logs.
  - Keeps timeline generation pure and testable.
- `src/components/work-orders/work-order-timeline.tsx`
  - Renders timeline entries with minimal visual treatment.
  - Supports Arabic/English labels and RTL/LTR direction.
- `src/pages/spms/work-orders/work-order-detail-page.tsx`
  - Embeds the timeline without restructuring the page.

## Supported Events

- Work order creation and current status.
- Reassignment history.
- Delegation history.
- Technician execution start and completion.
- Approval and rejection.
- Closure.
- Matching audit log records when the viewer can access audit logs.

## Audit Log Behavior

Audit records are optional input. Managers and admins can enrich the timeline with activity logs through the existing `useActivityLogsQuery` hook. Technician or requester views still show work order-native events when audit access is unavailable.

## Non-Goals

- No separate timeline collection.
- No expensive cross-collection query per work order.
- No replacement for the activity log page.
- No visual redesign of work order detail pages.
