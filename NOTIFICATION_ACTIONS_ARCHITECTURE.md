# Notification Actions Architecture

## Purpose

This foundation turns SPMS operational notifications into actionable records while keeping notifications as operational events, not social messages. It adds read/unread, archive, and linked-record navigation without redesigning the notifications inbox.

## Components and Utilities

- `src/components/notifications/notification-actions.tsx`
  - Marks notifications as read or unread.
  - Archives notifications.
  - Opens linked records when `refPath` can be resolved.
- `src/lib/notification-actions.ts`
  - Converts supported Firestore `refPath` values into app routes.

## Service Discipline

Notification actions call existing exports in `src/services/firestore/spms-service.ts`:

- `markOperationalNotificationRead`
- `archiveOperationalNotification`

The underlying notification engine service now writes audit records for:

- `notification.mark_read`
- `notification.mark_unread`
- `notification.archive`

## Linked Records

Supported `refPath` mappings:

- `workOrders/{id}` -> `/dashboard/work-orders/{id}`
- `assets/{id}` -> `/dashboard/assets/{id}`
- `pmSchedules/{id}` -> `/dashboard/pm`
- `notifications/{id}` -> `/dashboard/notifications`

Unsupported paths intentionally return `null` so the UI can show a disabled action instead of guessing.

## Non-Goals

- No inbox redesign.
- No push/email/WhatsApp delivery implementation.
- No replacement of existing notification generation logic.
