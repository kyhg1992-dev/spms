# KPI Engine Architecture

## Purpose

The KPI engine provides reusable industrial maintenance calculations for SPMS without hardcoding analytics inside dashboard components. It is a lightweight operational layer, not a data warehouse.

## Primary File

- `src/lib/kpi-engine.ts`

## Supported KPIs

- PM compliance percentage.
- MTBF.
- MTTR.
- Total downtime hours.
- Work order completion rate.
- Overdue PM count.
- Overdue work order count.
- Technician workload.
- Asset availability percentage.

## Design Rules

- Functions are pure and reusable.
- Inputs are Firestore-normalized model arrays.
- Calculations tolerate missing timestamps and optional fields.
- No Firebase reads occur inside KPI calculations.
- Dashboard and reporting screens consume the same engine.

## Current Assumptions

- MTBF uses total operating hours divided by completed/closed work orders as a foundation metric.
- MTTR uses execution timestamps when available, then falls back to created/updated/closed timestamps.
- Availability uses active non-retired assets as the initial operational proxy.

These assumptions are documented so later historian, downtime, and condition-monitoring integrations can replace the proxies without changing UI consumers.
