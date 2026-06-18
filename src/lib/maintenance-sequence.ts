import type { MaintenanceSequenceTemplate, MaintenanceServiceCode } from "@/models/firestore"

/**
 * Maintenance sequence engine — the distinctive core of SPMS.
 *
 * Each piece of equipment follows a cyclic service sequence such as
 * `D → D → C → D → B → A`. The engine answers a single question:
 *
 *   "Given the last service code performed and how far the meter has advanced
 *    since then, which service code is due next — and is it due yet?"
 *
 * The functions here are PURE (no Firebase, no I/O) so they are trivially
 * unit-testable. The Firestore-aware wrapper lives in
 * `src/services/firestore/maintenance-sequence-service.ts`.
 */

/** Why a particular next code was chosen — useful for logs and UI hints. */
export type NextCodeReason =
  | "NO_HISTORY" // no prior service on this asset → start at sequence[0]
  | "ADVANCED" // moved one step forward from lastCode
  | "UNKNOWN_LAST_CODE" // lastCode is not part of this template → restart at sequence[0]

export type NextCodeResult = {
  /** The service code that should be performed next. */
  nextCode: MaintenanceServiceCode
  /** Display label for `nextCode` that disambiguates repeats (e.g. "D2"); bare code when unique. */
  nextLabel: string
  /** Index of `nextCode` within `template.sequence`. */
  nextIndex: number
  /** True once the meter has advanced at least `stepInterval` since `lastReading`. */
  isDue: boolean
  /** `currentReading - lastReading`, clamped to be non-negative. */
  readingDelta: number
  /** The template's per-step interval, echoed for convenience. */
  stepInterval: number
  /** Meter units still required before `nextCode` becomes due (0 when due/overdue). */
  remainingUntilDue: number
  /** Meter units accrued past the due point (0 when not yet due). */
  overdueBy: number
  /** How many full intervals have elapsed in `readingDelta` (≥1 means overdue/skipped). */
  intervalsElapsed: number
  /** True when advancing wrapped from the last step back to index 0. */
  cycleWrapped: boolean
  reason: NextCodeReason
}

export class MaintenanceSequenceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MaintenanceSequenceError"
  }
}

/**
 * Build per-position display labels for a sequence. A code that appears more than
 * once gets a 1-based occurrence suffix (e.g. `D · C · D · B · D · C · D · A` →
 * `D1 · C1 · D2 · B · D3 · C2 · D4 · A`); a code that appears once stays bare.
 * This lets the technician/manager tell *which* repeat in the rotation they are at.
 */
export function sequenceOccurrenceLabels(
  sequence: readonly MaintenanceServiceCode[]
): string[] {
  const totals = new Map<string, number>()
  for (const code of sequence) totals.set(code, (totals.get(code) ?? 0) + 1)
  const running = new Map<string, number>()
  return sequence.map((code) => {
    const n = (running.get(code) ?? 0) + 1
    running.set(code, n)
    return (totals.get(code) ?? 0) > 1 ? `${code}${n}` : code
  })
}

/** Display label for a single position in the sequence (e.g. index 4 → "D3"). */
export function occurrenceLabelForIndex(
  sequence: readonly MaintenanceServiceCode[],
  index: number
): string {
  if (index < 0 || index >= sequence.length) return ""
  return sequenceOccurrenceLabels(sequence)[index]
}

/** Throws if a template can never produce a meaningful next code. */
export function assertValidTemplate(template: MaintenanceSequenceTemplate): void {
  if (!Array.isArray(template.sequence) || template.sequence.length === 0) {
    throw new MaintenanceSequenceError(
      `Template "${template.templateCode}" has an empty sequence.`
    )
  }
  if (!(template.stepInterval > 0)) {
    throw new MaintenanceSequenceError(
      `Template "${template.templateCode}" has a non-positive stepInterval (${template.stepInterval}).`
    )
  }
}

/**
 * Pure core: compute the next service code from a fully-resolved template.
 *
 * @param template      The sequence definition (codes + per-step interval).
 * @param lastCode      Code of the most recent service, or `null`/`undefined`
 *                      when the asset has no maintenance history yet.
 * @param currentReading Current meter value (hours or km, matching `template.meterKind`).
 * @param lastReading   Meter value recorded when `lastCode` was performed.
 * @param lastIndex     Authoritative position of the last service within `sequence`.
 *                      Prefer this over `lastCode` — it disambiguates repeated codes
 *                      (a `D` appearing 3 times advances D→C→D→B correctly). When
 *                      omitted/null, falls back to locating `lastCode` (legacy data).
 */
export function computeNextCode(
  template: MaintenanceSequenceTemplate,
  lastCode: MaintenanceServiceCode | null | undefined,
  currentReading: number,
  lastReading: number,
  lastIndex?: number | null
): NextCodeResult {
  assertValidTemplate(template)

  const sequence = template.sequence
  const stepInterval = template.stepInterval
  const readingDelta = Math.max(0, (currentReading ?? 0) - (lastReading ?? 0))
  const intervalsElapsed = Math.floor(readingDelta / stepInterval)
  const isDue = readingDelta >= stepInterval

  // Resolve the last performed position: the explicit index wins (handles repeats);
  // otherwise locate the code; -1 means "no usable history".
  const hasIndex =
    lastIndex != null && lastIndex >= 0 && lastIndex < sequence.length
  const resolvedLastIndex = hasIndex
    ? (lastIndex as number)
    : lastCode == null
      ? -1
      : sequence.findIndex((code) => code === lastCode)

  let reason: NextCodeReason
  let nextIndex: number
  let cycleWrapped = false

  if (!hasIndex && lastCode == null) {
    reason = "NO_HISTORY"
    nextIndex = 0
  } else if (resolvedLastIndex === -1) {
    // lastCode isn't in this template (e.g. template changed) — restart safely.
    reason = "UNKNOWN_LAST_CODE"
    nextIndex = 0
  } else {
    reason = "ADVANCED"
    nextIndex = (resolvedLastIndex + 1) % sequence.length
    cycleWrapped = resolvedLastIndex === sequence.length - 1
  }

  const dueAtDelta = stepInterval
  const remainingUntilDue = isDue ? 0 : Math.max(0, dueAtDelta - readingDelta)
  const overdueBy = isDue ? readingDelta - dueAtDelta : 0
  const labels = sequenceOccurrenceLabels(sequence)

  return {
    nextCode: sequence[nextIndex],
    nextLabel: labels[nextIndex],
    nextIndex,
    isDue,
    readingDelta,
    stepInterval,
    remainingUntilDue,
    overdueBy,
    intervalsElapsed,
    cycleWrapped,
    reason,
  }
}

/* -------------------------------------------------------------------------- */
/* Template registry — lets `getNextCode` keep the requested (templateId, ...) */
/* signature while staying pure/in-memory. Populate it from Firestore via the  */
/* service layer (or directly in tests).                                       */
/* -------------------------------------------------------------------------- */

const templateRegistry = new Map<string, MaintenanceSequenceTemplate>()

/** Register/replace templates available to `getNextCode` (keyed by document id). */
export function registerMaintenanceTemplates(
  templates: Array<MaintenanceSequenceTemplate & { id: string }>
): void {
  for (const template of templates) {
    templateRegistry.set(template.id, template)
  }
}

/** Look up a registered template by its document id. */
export function getMaintenanceTemplate(
  templateId: string
): (MaintenanceSequenceTemplate & { id: string }) | undefined {
  return templateRegistry.get(templateId) as
    | (MaintenanceSequenceTemplate & { id: string })
    | undefined
}

/** Clear the registry (primarily for tests). */
export function resetMaintenanceTemplateRegistry(): void {
  templateRegistry.clear()
}

/**
 * The headline engine entry point, matching the SPMS spec signature.
 *
 * Resolves `templateId` against the in-memory registry, then delegates to the
 * pure `computeNextCode`. Throws `MaintenanceSequenceError` if the template is
 * not registered — load it first via `registerMaintenanceTemplates` (the
 * service layer does this for you).
 *
 *   getNextCode(templateId, lastCode, currentReading, lastReading)
 */
export function getNextCode(
  templateId: string,
  lastCode: MaintenanceServiceCode | null | undefined,
  currentReading: number,
  lastReading: number,
  lastIndex?: number | null
): NextCodeResult {
  const template = templateRegistry.get(templateId)
  if (!template) {
    throw new MaintenanceSequenceError(
      `Maintenance template "${templateId}" is not registered. ` +
        `Call registerMaintenanceTemplates() (or use the service layer) first.`
    )
  }
  return computeNextCode(template, lastCode, currentReading, lastReading, lastIndex)
}
