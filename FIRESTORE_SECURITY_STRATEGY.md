# Firestore Security Strategy

## Principles

- Preserve industrial operational safety over convenience.
- Keep audit records immutable.
- Keep technician writes narrow and execution-focused.
- Keep manager/admin controls around approvals, reassignment, delegation, PM planning, and closures.
- Align client queries with rule scope to avoid denied broad scans.

## Access Model

- Admin: full operational administration, including deletes where explicitly allowed.
- Manager: operational control of work orders, PM schedules, approvals, and reports.
- Technician: assigned work execution, meter readings, attachments, and personal notifications.
- Requester: request creation and own notification/work order visibility.

## Protected Areas

- Work order status transitions are constrained for technicians at rules level.
- Manager-only fields cannot be changed by technicians.
- PM engine recalculation fields are the only PM fields technicians can update.
- Meter readings cannot be edited after creation.
- Audit logs cannot be modified or deleted.

## Query Safety

Added indexes support:

- Notification inbox by user.
- Meter readings by asset and meter kind.
- PM-generated work order duplicate checks.
- Scoped work order reads by assignee/requester.
- PM schedules by asset.

## Recommendations

- Remove `devSeedAdminEmail` before production.
- Move audit and notification writes to trusted backend execution.
- Add Firebase Emulator Suite rules tests before first production deploy.
- Add App Check enforcement for web clients.
- Review collection-wide manager dashboard reads as dataset size grows.
