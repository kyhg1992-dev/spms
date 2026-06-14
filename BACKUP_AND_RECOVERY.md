# Backup and Recovery

## Purpose

SPMS stores maintenance operations, audit history, PM plans, and work orders in Firebase. Backup discipline protects operational continuity and audit trust.

## Backup Recommendations

- Schedule Firestore managed exports to a dedicated Google Cloud Storage bucket.
- Keep backups in a separate bucket with restricted admin access.
- Retain daily backups for at least 30 days for MVP operations.
- Retain monthly backups for compliance and audit review.
- Export Storage attachments according to the same retention policy.

## Recovery Procedure

1. Identify affected collections and recovery point.
2. Export current production state before restore.
3. Restore into a staging Firebase project first.
4. Validate work orders, PM schedules, users, and audit logs.
5. Restore production only after manager/admin sign-off.

## Operational Checks After Restore

- Confirm no duplicate PM-generated work orders were introduced.
- Confirm audit logs remain immutable.
- Confirm active PM schedules have sane next due dates.
- Confirm technician assignments still resolve to active users.

## Future Improvements

- Add automated backup verification.
- Add restore runbooks per collection.
- Add monitoring around failed scheduled exports.
