import { Check, ClipboardCheck, Download, X } from "lucide-react"
import { useState } from "react"

import { PhotoLightbox } from "@/components/work-orders/photo-lightbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useI18n } from "@/i18n/i18n"
import type { WorkOrder } from "@/models/firestore"

/**
 * Read-only summary of everything the technician recorded during execution —
 * checklist (done + qty used), extra items, observation notes, completion/safety/
 * parts notes, and photos. Shown to the approver so the list is visible before
 * approval. Renders nothing when there is no execution data yet.
 */
export function WorkOrderExecutionSummary({ workOrder }: { workOrder: WorkOrder }) {
  const { t } = useI18n()
  const [lightbox, setLightbox] = useState<number | null>(null)
  const checklist = workOrder.executionChecklist ?? []
  const extras = workOrder.extraItems ?? []
  const photos = workOrder.executionPhotos ?? []

  const hasAnything =
    checklist.length > 0 ||
    extras.length > 0 ||
    photos.length > 0 ||
    !!workOrder.observationNotes?.trim() ||
    !!workOrder.completionNotes?.trim() ||
    !!workOrder.safetyNotes?.trim() ||
    !!workOrder.requiredPartsNote?.trim()

  if (!hasAnything) return null

  return (
    <Card className="rounded-xl border-border/70 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="size-4" aria-hidden />
          {t("exec.summary")}
        </CardTitle>
        <CardDescription>{t("exec.summaryHint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {checklist.length > 0 ? (
          <Section title={t("exec.checklist")}>
            <ul className="space-y-1.5">
              {checklist.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
                  <span className="flex items-start gap-2">
                    {item.isDone ? (
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label={t("exec.done")} />
                    ) : (
                      <X className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label={t("exec.pending")} />
                    )}
                    <span className={item.isDone ? "" : "text-muted-foreground"}>{item.labelAr}</span>
                  </span>
                  {item.qtyUsed?.trim() ? (
                    <span className="shrink-0 rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary tabular-nums">
                      {t("exec.qtyUsed")}: {item.qtyUsed}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {extras.length > 0 ? (
          <Section title={t("exec.extraItems")}>
            <ul className="space-y-1">
              {extras.map((it, i) => (
                <li key={i} className="flex items-center justify-between gap-3 border-b border-dashed pb-1 last:border-0">
                  <span>{it.desc}</span>
                  {it.qty ? <span className="text-muted-foreground tabular-nums">{it.qty}</span> : null}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {workOrder.observationNotes?.trim() ? (
          <Section title={t("exec.observation")}>
            <p className="whitespace-pre-wrap rounded-md bg-amber-50 px-3 py-2 text-amber-900">{workOrder.observationNotes}</p>
          </Section>
        ) : null}

        {workOrder.completionNotes?.trim() ? (
          <Section title={t("exec.completionNotes")}>
            <p className="whitespace-pre-wrap">{workOrder.completionNotes}</p>
          </Section>
        ) : null}

        {workOrder.requiredPartsNote?.trim() ? (
          <Section title={t("exec.partsNote")}>
            <p className="whitespace-pre-wrap">{workOrder.requiredPartsNote}</p>
          </Section>
        ) : null}

        {workOrder.safetyNotes?.trim() ? (
          <Section title={t("exec.safetyNotes")}>
            <p className="whitespace-pre-wrap">{workOrder.safetyNotes}</p>
          </Section>
        ) : null}

        {photos.length > 0 ? (
          <Section title={t("exec.photos")}>
            <div className="flex flex-wrap gap-2">
              {photos.map((src, i) => (
                <div key={i} className="group relative">
                  <button
                    type="button"
                    className="block overflow-hidden rounded-md border"
                    aria-label={t("exec.viewPhoto")}
                    onClick={() => setLightbox(i)}
                  >
                    <img src={src} alt="" className="size-24 object-cover transition-transform group-hover:scale-105" />
                  </button>
                  <a
                    href={src}
                    download={`photo-${i + 1}.jpg`}
                    className="absolute end-1 top-1 rounded-full bg-black/55 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label={t("exec.download")}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download className="size-3.5" />
                  </a>
                </div>
              ))}
            </div>
          </Section>
        ) : null}
      </CardContent>

      {lightbox !== null ? (
        <PhotoLightbox photos={photos} index={lightbox} onClose={() => setLightbox(null)} />
      ) : null}
    </Card>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase">{title}</p>
      {children}
    </div>
  )
}
