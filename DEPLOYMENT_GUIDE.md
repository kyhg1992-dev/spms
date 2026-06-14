# Deployment Guide

## Scope

This guide covers MVP deployment readiness for the React + Firebase SPMS application. It does not introduce new hosting or backend architecture.

## Pre-Deployment

- Confirm `.env.local` or CI secrets include all required `VITE_FIREBASE_*` variables.
- Set `VITE_USE_FIREBASE_EMULATORS=false`.
- Remove the temporary `devSeedAdminEmail` bypass from `firestore.rules`.
- Run lint.
- Run Firebase Emulator rules tests when available.
- Review Firestore index build requirements.

## Deployment Order

1. Deploy Firestore indexes.
2. Deploy Firestore rules.
3. Run a smoke test with admin, manager, technician, and requester users.
4. Deploy hosting through the controlled deployment pipeline.

## Smoke Tests

- Technician can see assigned work orders only.
- Technician can start, draft, and complete execution.
- Manager can approve/reject and reassign.
- PM schedule can generate one work order and prevent duplicates.
- Notifications can be read, unread, opened, and archived.
- Audit logs are readable by manager/admin and cannot be edited.
- Operational calendar defaults do not schedule PM follow-up into weekend/shutdown days.

## Rollback

- Keep the previous hosting release available in Firebase Hosting.
- Keep the previous rules/index files in version control.
- If rules block operations unexpectedly, roll back rules first, then investigate queries.
