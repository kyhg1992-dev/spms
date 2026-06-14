# First Pilot Checklist

## Recommendation

Run the first SPMS pilot with a small, controlled maintenance team before expanding to a full site rollout. The target pilot size is 1 admin, 1-2 managers or supervisors, 2-4 technicians, 10-25 assets, and 10-30 PM schedules.

## Before Deployment

- Confirm `npm.cmd run lint` passes.
- Confirm `npm.cmd run build` passes.
- Confirm Vercel has all required `VITE_FIREBASE_*` environment variables.
- Confirm `VITE_USE_FIREBASE_EMULATORS=false` in Vercel.
- Confirm Firebase Auth users exist for all pilot users.
- Confirm Firestore rules and indexes are deployed.
- Remove or disable temporary development seed bypasses before production-like pilot use.
- Confirm `vercel.json` SPA rewrite is present.

## Firebase Readiness

- Authentication provider is enabled.
- User profile documents exist in `users`.
- Admin and manager roles are correct.
- Technician profiles are active.
- Firestore security rules protect audit logs from edits and deletes.
- PM schedule writes are limited to admin and manager roles.
- Technician work order access is limited to assigned records.
- Notification reads are scoped to intended recipients.

## Pilot Data Readiness

- Demo or pilot assets use a clear `PILOT-` prefix.
- PM schedules have realistic intervals for time, hours, and kilometers.
- At least one overdue PM exists for validation.
- At least one technician has an assigned work order.
- At least one approval-required work order exists.
- At least one notification exists for manager validation.

## Workshop Workflow Smoke Test

- Login and logout.
- Switch Arabic and English.
- View dashboard summaries.
- Create or edit an asset.
- Capture a meter reading.
- Create, edit, pause, and resume a PM schedule.
- Generate a PM work order and confirm no duplicate open PM work order is created.
- Assign or reassign a work order.
- Start technician execution.
- Save execution draft.
- Complete execution with completion notes and labor hours.
- Approve or reject completed work.
- Close approved/completed work order.
- Mark notification as read, unread, and archived.

## Mobile Technician Check

- Technician can load assigned work orders on a phone-sized viewport.
- Primary actions are touch-friendly.
- Completion notes field is easy to use.
- Required validation messages are understandable.
- Long bilingual labels do not block execution.
- Technician can complete a realistic work order in under two minutes after opening it.

## Operational Safety Check

- Duplicate PM work order generation is blocked.
- Duplicate completion is blocked.
- Closed or cancelled work orders cannot be reopened by normal client actions.
- Reassignment requires a reason.
- Deleted or missing user references fail safely.
- Missing asset or meter references do not crash the UI.
- Audit events are created for critical actions.

## First Day Monitoring

- Monitor Firebase usage and Firestore rule denials.
- Track failed logins and permission errors.
- Review work orders created from PM schedules.
- Review notification volume and duplicate notifications.
- Review technician feedback after the first shift.
- Record any manual workaround used by the workshop team.

## Go / No-Go Criteria

Pilot may proceed when:

- Lint and build pass.
- Login and role-based access are verified.
- PM-to-work-order flow works without duplicates.
- Technician execution and approval flow works end to end.
- No critical runtime errors appear during smoke testing.

Pilot should pause when:

- Technicians can see records not assigned to them.
- PM generation creates duplicate open work orders.
- Audit logs can be edited or deleted by client users.
- Build fails or core routes fail to load.
- Firebase permission errors block core workflows.
