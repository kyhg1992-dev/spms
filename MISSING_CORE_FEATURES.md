# Missing Core Features

## Priority 1: Work Order Operations

The data model supports work orders, but the UI currently only lists and displays them.

Missing:

- Create work order form.
- Edit work order form.
- Assign/reassign technician.
- Status transition actions.
- Close/completion workflow.
- Labor, downtime, cost, parts, and notes entry during execution.
- Approval workflow for `approvalRequired`, `approvedByUid`, and `approvedAt`.
- Requester workflow for submitting and tracking requests.
- Comment/thread history beyond `lastPublicComment`.
- Attachments/photos on work orders.
- Audit events for each transition.

## Priority 1: Preventive Maintenance Execution

PM schedules are listed, but there is no full scheduling or execution workflow.

Missing:

- Create/edit/pause/delete PM schedule UI.
- PM completion workflow.
- Automatic `nextRunAt`, `nextDueHours`, and `nextDueKm` recalculation after completion.
- Auto-create work order implementation for `autoCreateWorkOrder`.
- Meter-triggered due detection from latest readings.
- PM templates/checklists by service type.
- Reminder generation using `defaultPmReminderDays`.
- PM compliance history.

## Priority 1: Meter-Driven Maintenance Logic

Meter readings exist, but they do not yet drive maintenance automation.

Missing:

- Update asset `operatingHours`/`odometer` from latest accepted meter reading.
- Use `companySettings.meterAnomalyPct` to flag abnormal readings.
- Review/override workflow for anomaly readings.
- PM due checks based on hour/km thresholds.
- Trend charts for asset meter history.
- Meter reading audit detail and correction flow.

## Priority 1: Notification Actions

Notifications are displayed but not operational.

Missing:

- Mark as read/unread.
- Open linked `refPath` records.
- Archive/delete notification.
- Generate notifications from PM due/overdue, work order assignment, status changes, approvals, and anomalies.
- Email delivery implementation for `channel: "email"`.
- Notification preferences per user/role.

## Priority 2: User And Role Administration

The users page is currently read-only.

Missing:

- Create/invite user flow.
- Edit display name, phone, department, specialization.
- Change role with audit trail.
- Activate/deactivate accounts.
- Technician workload profile using names instead of raw UID snippets.
- Requester/technician self-profile maintenance.

## Priority 2: Attachment And Document Management

The model includes attachments but the UI does not expose them.

Missing:

- Upload/download/delete attachments for assets, work orders, and PM schedules.
- Storage path convention for attachment records.
- MIME/type and file-size validation.
- Document categories such as manuals, invoices, inspection photos, warranties, reports.
- Attachment audit events.

## Priority 2: Inventory And Spare Parts

Assets have `sparePartsNote`, but there is no structured inventory module.

Missing:

- Spare parts catalog.
- Stock levels and reorder thresholds.
- Part reservation/usage on work orders.
- Vendor and purchase data.
- Cost rollup from consumed parts.
- Low-stock alerts.

## Priority 2: Reporting And Analytics

Reports are currently preview-level.

Missing:

- Date range filters.
- Asset/category/department/location filters.
- Work order completion and backlog reports.
- PM compliance report.
- Downtime and cost reports.
- MTBF/MTTR reports using authoritative event history.
- CSV/PDF export per report type.
- Scheduled report delivery.

## Priority 2: Asset Lifecycle Enhancements

Asset CRUD is strong, but lifecycle workflows are still basic.

Missing:

- Asset decommission/retirement workflow.
- Warranty expiry alerts.
- Service history timeline combining work orders, PM completions, meter readings, attachments, and audit events.
- Parent/child asset hierarchy or components.
- Location/department master data.
- QR scan landing behavior optimized for technicians.

## Priority 3: Governance And Audit Completeness

Audit logging exists but is not comprehensive.

Missing:

- Central audit wrapper for all writes.
- Before/after snapshots for sensitive changes.
- Settings/user/security audit categories.
- Delete audit coverage.
- Exportable audit reports.
- Rule/emulator tests for access control.

## Priority 3: Operational Hardening

Missing:

- SPMS-specific README and setup instructions.
- Firebase emulator test workflow.
- Automated tests for services, rules, normalizers, and KPI calculations.
- Error boundary and consistent permission-denied UX.
- Empty/error/loading state consistency across all modules.
- Production removal plan for temporary seed bypass.

