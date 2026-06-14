# Notification Engine Architecture

## Purpose

The SPMS notification engine is the operational event foundation for maintenance alerts. Notifications in SPMS are not social messages; they are controlled maintenance events that support technicians, workshops, supervisors, admins, requesters, future mobile execution, and escalation workflows.

This phase is service-oriented only. It does not redesign pages.

## Core Files

- `src/lib/notification-engine.ts`
  - Pure event and notification generation utilities.
  - Defines operational event payloads.
  - Maps operational priorities to existing notification priorities.
  - Provides reusable event builders for PM, work orders, approvals, and meter anomalies.

- `src/services/firestore/notification-engine-service.ts`
  - Central Firestore notification/event service.
  - Resolves target users by role and explicit UID.
  - Writes notification documents.
  - Writes audit hooks for notification generation, escalation triggers, and anomaly alerts.
  - Provides read/unread and archive foundations.

- `src/models/firestore.ts`
  - Extends `Notification` with event metadata, target role, archive fields, and future delivery payload.

- `src/lib/notification-normalize.ts`
  - Normalizes operational notification metadata while preserving existing notification reads.

- `src/services/firestore/spms-service.ts`
  - Exposes notification engine functions through the existing SPMS service boundary.

## Operational Event Types

Supported event types:

- `PM_DUE_SOON`
- `PM_OVERDUE`
- `WORK_ORDER_ASSIGNED`
- `WORK_ORDER_REASSIGNED`
- `WORK_ORDER_COMPLETED`
- `WORK_ORDER_WAITING_APPROVAL`
- `APPROVAL_ACCEPTED`
- `APPROVAL_REJECTED`
- `METER_ANOMALY_DETECTED`

## Priority Model

The notification engine uses operational priorities:

- `INFO`
- `WARNING`
- `CRITICAL`

For compatibility with existing notification UI and Firestore records, these map to the existing values:

- `INFO` -> `normal`
- `WARNING` -> `high`
- `CRITICAL` -> `critical`

Both values can be stored:

- `priority`: existing UI-compatible value.
- `eventPriority`: operational engine value.

## Targeting Model

Notifications can target:

- explicit users through `targetUserIds`,
- roles through `targetRoles`,
- combined user and role audiences.

Supported operational roles:

- `technician`
- `manager`
- `admin`
- `requester`

The service resolves active users from the `users` collection and deduplicates targets before writing notifications.

## Notification Document Fields

The engine extends notification documents with:

- `targetRole`
- `eventPriority`
- `eventType`
- `eventKey`
- `isRead`
- `readAt`
- `isArchived`
- `archivedAt`
- `archiveReason`
- `deliveryPayload`

The existing fields remain:

- `userId`
- `type`
- `channel`
- `priority`
- `title`
- `body`
- `refPath`
- `createdAt`
- `updatedAt`

## Read/Unread Foundation

The service provides:

- `markNotificationRead(notificationId, true)`
- `markNotificationRead(notificationId, false)`

When marked read, `readAt` is stamped. When marked unread, `readAt` is cleared.

## Archive Foundation

The service provides:

- `archiveNotification({ notificationId, archiveReason })`

Archiving sets:

- `isArchived=true`
- `archivedAt`
- optional `archiveReason`

Archive behavior is separate from delete behavior. Operational records should generally be archived, not destroyed.

## Event Payload For Future Channels

The event payload is designed for future delivery channels:

- mobile push notifications,
- email,
- WhatsApp,
- escalation engine.

The `deliveryPayload` records:

- event type,
- priority,
- entity type,
- entity ID,
- requested channels,
- escalation key,
- metadata,
- future delivery flags.

This keeps current Firestore notifications compatible while preserving a clean path to future channel workers.

## Current Event Producers

The PM engine emits:

- `PM_DUE_SOON`
- `PM_OVERDUE`
- `METER_ANOMALY_DETECTED`

The work order lifecycle engine emits:

- `WORK_ORDER_ASSIGNED`
- `WORK_ORDER_REASSIGNED`
- `WORK_ORDER_COMPLETED`
- `WORK_ORDER_WAITING_APPROVAL`
- `APPROVAL_ACCEPTED`
- `APPROVAL_REJECTED`

## Audit Hooks

The notification engine writes audit events for:

- `notification.generate`
- `notification.escalation_trigger`
- `notification.anomaly_alert`

These are stored in `activityLogs` and include:

- `actorUid`
- `actionKey`
- `entityType`
- `entityId`
- `labelAr`
- `createdAt`
- `updatedAt`

## Escalation Philosophy

Critical operational events should be escalation-ready, but this phase does not implement a full escalation engine. Instead, it records `eventPriority=CRITICAL`, `eventKey`, `escalationKey`, and channel intent in `deliveryPayload`.

Future escalation can use these fields to route alerts by:

- site,
- workshop,
- asset category,
- technician team,
- department,
- SLA age,
- repeated overdue events.

## Scalability Notes

- Event generation is centralized.
- Target resolution is role and UID based.
- Notification documents remain per-user for simple inbox reads.
- Future multi-site filtering can be added through metadata and user profile fields.
- Future deduplication can use `eventKey` and time windows.
- Future delivery workers can consume `deliveryPayload`.

## Non-Goals In This Phase

- No UI redesign.
- No push/email/WhatsApp delivery implementation.
- No escalation scheduler.
- No notification preferences UI.
- No package installation.
- No replacement of existing notification pages.

