# MVP Limitations and Future Roadmap

## MVP Limitations

- No trusted backend yet for audit, notifications, and PM automation.
- No full offline sync engine for technicians.
- No inventory/spare-parts reservation workflow.
- No advanced asset hierarchy or multi-site authorization matrix.
- No scheduled PM automation runner.
- No formal Firebase Emulator rules test suite yet.
- No rich PDF/Excel export generation, only export-ready structures.

## Operational Roadmap

1. Move critical workflows to Cloud Functions:
   - Audit logs.
   - Notifications.
   - PM work order generation.
   - PM completion recalculation.
   - Lifecycle transitions.
2. Add technician mobile queue:
   - Offline drafts.
   - Photo retry.
   - QR asset lookup.
3. Add inventory lite:
   - Spare part requests.
   - Reservation status.
   - Parts consumed by work order.
4. Add reporting maturity:
   - Paginated report reads.
   - Scheduled exports.
   - KPI snapshots.
5. Add production controls:
   - App Check.
   - Emulator rules tests.
   - Backup verification.
   - Operational monitoring alerts.

## Product Principle

SPMS should stay an industrial maintenance operations platform. Future growth should deepen reliability and execution clarity before adding ERP-style breadth.
