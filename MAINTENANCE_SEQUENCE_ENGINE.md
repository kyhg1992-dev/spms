# Maintenance Sequence Engine (A/B/C/D)

The distinctive core of SPMS: every asset follows a **cyclic service sequence**
such as `D → D → C → D → B → A`. The engine decides which service code is due
next based on the last code performed and how far the meter has advanced.

## Data model

`MaintenanceSequenceTemplate` (Firestore collection `maintenanceTemplates`,
defined in [`src/models/firestore.ts`](src/models/firestore.ts)):

| field          | meaning                                                        |
| -------------- | ------------------------------------------------------------- |
| `templateCode` | human id, e.g. `PM-FLT-STD`                                    |
| `sequence`     | ordered, **cyclic** list of codes, e.g. `["D","D","C","D","B","A"]` |
| `stepInterval` | meter delta between steps (e.g. `250` hours)                  |
| `meterKind`    | `operating_hours` \| `odometer`                               |
| `isActive`     | toggle                                                        |

## Engine — pure, testable

[`src/lib/maintenance-sequence.ts`](src/lib/maintenance-sequence.ts)

```ts
// Spec entry point — resolves templateId via the in-memory registry:
getNextCode(templateId, lastCode, currentReading, lastReading): NextCodeResult

// Pure core — pass the template object directly (used in tests / by the service):
computeNextCode(template, lastCode, currentReading, lastReading): NextCodeResult
```

`NextCodeResult` reports `nextCode`, `nextIndex`, `isDue`, `readingDelta`,
`remainingUntilDue`, `overdueBy`, `intervalsElapsed`, `cycleWrapped`, and a
`reason` (`NO_HISTORY` | `ADVANCED` | `UNKNOWN_LAST_CODE`).

### Rules
- **No history** (`lastCode == null`) → start at `sequence[0]`.
- **Advance** one step from `lastCode`'s position; the sequence wraps after the last step (`cycleWrapped = true`).
- **Due** when `currentReading - lastReading >= stepInterval`; otherwise `remainingUntilDue` tells how much meter is left.
- **Unknown `lastCode`** (not in this template) → safely restart at `sequence[0]`.

## Firestore wiring

[`src/services/firestore/maintenance-sequence-service.ts`](src/services/firestore/maintenance-sequence-service.ts)
loads/normalizes templates and registers them with the engine, then computes the
next code from live asset meter readings. Surfaced (role-checked) through
[`spms-service.ts`](src/services/firestore/spms-service.ts):

```ts
primeMaintenanceTemplates(role)                       // load + register all templates
getNextMaintenanceCode(role, { templateId, assetId, lastCode, lastReading })
createMaintenanceTemplate / list / update / delete    // standard CRUD
```

`getNextMaintenanceCode` reads the asset's current `operatingHours`/`odometer`
(per `meterKind`) itself — the caller only supplies the last serviced code and
the meter value at that time.
