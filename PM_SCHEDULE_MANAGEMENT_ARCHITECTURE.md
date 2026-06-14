# PM Schedule Management Architecture

## Purpose

This foundation gives SPMS a practical PM schedule management surface without redesigning the PM module. It keeps React + Firebase intact and uses the existing Firestore service exports for schedule create/update operations.

## UI Entry Points

- `src/components/pm/pm-schedule-management-dialog.tsx`
  - Create PM schedule.
  - Edit PM schedule.
  - Pause/resume by updating `isActive`.
  - Deactivate safely by setting `isActive=false`.
  - Generate PM work order.
  - Complete PM from the last generated linked work order.
- `src/pages/spms/pm-schedules-page.tsx`
  - Adds a create action in the page header.
  - Adds per-row actions without redesigning the table.

## Supported Fields

- Asset selection.
- Service type `A-F`.
- Trigger mode: `time`, `hours`, `km`, `both`.
- `frequencyDays`.
- `meterHoursInterval`.
- `meterKmInterval`.
- `autoCreateWorkOrder`.
- Active/paused state through `isActive`.

## Validation

The UI validates required fields before calling services:

- Title and asset are always required.
- `frequencyDays` must be positive.
- Hours interval is required for `hours` and `both`.
- Kilometer interval is required for `km` and `both`.

## Constraints

- No production build was required.
- No package installation.
- No full PM page redesign.
- No duplicate business logic outside the PM engine/service layer.
