# Mobile Technician UX Architecture

## Purpose

The mobile technician foundation improves execution speed without creating a separate app or redesigning SPMS. The goal is fast workshop action under real operating conditions.

## Implemented Foundation

- Work order operational actions now use larger touch-friendly button targets.
- Technician note fields are compact and quick-note oriented.
- `src/lib/mobile-technician.ts` defines:
  - Mobile action descriptors.
  - Offline-ready execution draft shape.
- Existing service calls remain unchanged.

## UX Principles

- Start, save, and complete should remain visible and fast.
- Completion still requires notes and labor hours.
- Offline preparation is data-shape only in this MVP; no local sync engine is introduced.
- Supervisory actions remain available but do not dominate technician execution.

## Future Mobile Work

- Add a dedicated technician queue.
- Add local draft persistence with conflict review.
- Add photo capture and upload retry state.
- Add barcode/QR entry points for asset lookup.
