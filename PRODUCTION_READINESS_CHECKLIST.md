# Production Readiness Checklist

## Environment

- All required `VITE_FIREBASE_*` variables are configured.
- `VITE_USE_FIREBASE_EMULATORS=false` in production.
- Firebase project id matches hosting, Firestore, Auth, and Storage project.
- Firebase Auth providers and authorized domains are configured.

## Security

- Remove temporary seed bypass from `firestore.rules`.
- Deploy Firestore rules and indexes together.
- Enable Firebase App Check for production clients.
- Enable multi-factor authentication for admin accounts where possible.
- Keep manager/admin accounts minimal and named.

## Data Protection

- Schedule Firestore exports/backups.
- Document restore procedure and retention period.
- Verify Storage bucket lifecycle and access rules.
- Keep audit logs immutable and exportable.

## Operations

- Run Firebase Emulator rules tests before release.
- Validate PM-to-work-order duplicate prevention with production-like data.
- Validate technician scoped queries with technician accounts.
- Validate requester scoped queries with requester accounts.
- Monitor Firestore index build status after deployment.
- Review operational health checks for orphan PM work orders, overdue PMs, and missing asset links.
- Configure alerting for failed deploys, Firestore rule denials, and unusually high write volume.
- Confirm operational calendar settings for weekends, holidays, shutdowns, and quiet hours.

## Deployment

- Run lint before deployment.
- Run production build only in deployment pipeline.
- Deploy hosting, Firestore rules, and indexes from a controlled branch.
- Tag release versions and keep rollback notes.

## Future Hardening

- Move operational audit and notification writes to Cloud Functions.
- Move PM recalculation and lifecycle transition enforcement to trusted backend code.
- Add structured error telemetry.
- Add scheduled backup verification drills.
