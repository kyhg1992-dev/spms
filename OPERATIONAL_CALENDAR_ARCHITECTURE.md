# Operational Calendar Architecture

## Purpose

The operational calendar foundation prepares SPMS for real workshop timing without introducing advanced scheduling UI. It helps PM scheduling, notification timing, and escalation preparation respect practical working windows.

## Implemented Foundation

- `src/lib/operational-calendar.ts`
  - `weekendDays`
  - `officialHolidays`
  - `shutdownPeriods`
  - `quietHours`
  - `workshopOperatingHours`
- `CompanySettings` now supports optional operational calendar fields.
- PM next-run calculation can adjust to the next operational working day.
- Notification timing utilities can identify quiet hours and shutdown suppression windows.

## Defaults

- Weekend days: Friday and Saturday.
- Quiet hours: 22:00 to 06:00.
- Workshop operating hours: 07:00 to 17:00.

## Integration Scope

- PM engine accepts an optional operational calendar.
- PM completion recalculation uses calendar settings when scheduling the next PM.
- Notification engine exposes timing preparation for future suppression/escalation workers.

## Non-Goals

- No calendar UI.
- No advanced resource scheduling.
- No technician shift planner.
- No automatic escalation worker in this MVP.
