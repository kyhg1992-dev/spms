# Dashboard Operational Summary

## Purpose

The operational summary layer centralizes dashboard-ready maintenance facts so the dashboard does not become the source of reporting logic.

## Primary File

- `src/lib/operational-summary.ts`

## Summary Outputs

- Active work orders.
- Overdue PMs.
- Critical assets.
- Work orders waiting approval.
- Technician execution status.
- Upcoming PM schedules.

## Integration

The existing dashboard continues to render its current layout, but workload and upcoming PM sections now consume the centralized operational summary foundation.

The legacy `computeDashboardKpis` helper also delegates core KPI values to:

- `src/lib/kpi-engine.ts`
- `src/lib/operational-summary.ts`

## Design Constraints

- No dashboard redesign.
- No new packages.
- No production build.
- No separate analytics storage.
- Keep calculations reusable for reports, exports, and future mobile supervisor views.
