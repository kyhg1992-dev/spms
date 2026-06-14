# Pilot Deployment Guide

## Scope

This guide prepares SPMS for the first controlled workshop pilot. It covers Firebase, Vercel, demo data, and operational smoke checks.

## Pre-Deployment Requirements

- Confirm all `VITE_FIREBASE_*` environment variables exist in Vercel.
- Set `VITE_USE_FIREBASE_EMULATORS=false` in Vercel.
- Deploy Firestore indexes before or alongside Firestore rules.
- Remove the temporary `admin@spms.test` seed bypass from `firestore.rules` before production-like pilot use.
- Confirm Firebase Auth users exist for admin, manager, and technicians.

## Build and Deploy

1. Run `npm.cmd run lint`.
2. Run `npm.cmd run build`.
3. Deploy to Vercel with the same environment variables as local `.env.local`.
4. Confirm SPA routing works by opening `/login`, `/dashboard`, `/dashboard/assets`, and `/dashboard/work-orders`.

## Vercel Notes

- `vercel.json` rewrites all routes to `/index.html` for React Router compatibility.
- Do not expose service account keys in Vercel client variables.
- Firebase web API keys are expected in Vite variables; privileged backend credentials are not.

## Firebase Notes

- Firestore rules and indexes are deployment artifacts.
- Authentication providers must be enabled before pilot login.
- Storage rules should be deployed even if attachments are limited in MVP.

## Pilot Smoke Check

- Admin can log in.
- Manager can view dashboard, PM, work orders, and notifications.
- Technician can view assigned work orders only.
- PM schedule can generate exactly one open work order.
- Work order can move through execution and approval.
- Notifications can be marked read and archived.
