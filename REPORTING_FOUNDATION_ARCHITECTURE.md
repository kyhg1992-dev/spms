# Reporting Foundation Architecture

## Purpose

The reporting foundation prepares SPMS operational data for filtering, aggregation, and export without introducing heavy analytics infrastructure.

## Files

- `src/lib/reporting-query.ts`
  - Filter work orders, PM schedules, and assets by operational dimensions.
  - Provide lightweight aggregation helpers.
- `src/lib/report-export.ts`
  - Prepare CSV-ready, Excel-ready, and PDF-ready structures.
- `src/pages/spms/reports-page.tsx`
  - Consumes the foundation with minimal UI changes.

## Supported Filters

- Date range.
- Asset.
- Site/workshop through asset department, location, or category.
- Technician.
- PM service type.
- Work order status.

## Aggregation Scope

Current aggregation is intentionally lightweight:

- `countBy`
- `sumBy`
- Prepared report rows and columns.

No OLAP cube, warehouse, or long-running analytics worker is introduced in this phase.

## Export Scope

The foundation prepares:

- CSV content and MIME type.
- Excel-ready row/column structures.
- PDF-ready row/column structures with summary lines.

Full export UI, styled PDFs, and spreadsheet generation are future features.
