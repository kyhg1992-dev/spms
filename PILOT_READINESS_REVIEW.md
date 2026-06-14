# Pilot Readiness Review

## Recommended Pilot Scope

- 8 to 12 active users.
- 2 admins or managers.
- 4 to 8 technicians.
- 25 to 75 assets.
- 15 to 40 active PM schedules.
- One workshop or one operating site.

## Workflows to Validate

- Login and role-specific access.
- PM schedule creation and editing.
- PM-to-work-order generation with duplicate prevention.
- Technician start, draft, and complete execution.
- Manager approval and rejection.
- Reassignment and delegation.
- Notification read/archive/open-linked-record flow.
- Dashboard and report KPI sanity.

## Known MVP Limitations

- Audit and notification writes are still client-originated, though rules constrain shape and ownership.
- No full offline sync; mobile execution has offline-ready data shapes only.
- No advanced inventory or spare-parts reservation.
- No scheduled PM automation runner.
- No formal Firebase Emulator rules test suite yet.

## Operational Risks During Pilot

- Broad manager dashboard reads may slow as data grows.
- Legacy `assigneeId` and newer `assignedTo` fields must be kept consistent.
- PM completion should be supervised until real meter habits are understood.
- Firestore index deployment must be completed before live use.
- Temporary seed bypass must be removed before production-like use.

## Mobile UX Weaknesses

- Technician queue is still embedded in existing work order pages.
- Photo upload retry and true offline persistence are future work.
- Small workshops should pilot with a limited technician group first.

## Firebase Bottlenecks

- Collection-wide manager reads for assets, work orders, PM schedules, and notifications are acceptable for MVP pilot scale but should be paginated or aggregated later.
- Notification duplicate suppression performs per-target event key checks.
- Cloud Functions should own lifecycle, PM automation, notification generation, and audit writing before enterprise rollout.

## Pilot Exit Criteria

- No duplicate PM work orders during normal operation.
- Technicians can complete work orders on mobile without support intervention.
- Managers can approve/reject and reassign confidently.
- Meter rollback prevention works during real readings.
- PM compliance and overdue counts match workshop expectations.
