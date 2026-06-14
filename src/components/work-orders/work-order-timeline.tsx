import { Badge } from "@/components/ui/badge"
import { formatArDateTime } from "@/lib/format"
import type { WorkOrderTimelineEntry } from "@/lib/work-order-timeline"
import { cn } from "@/lib/utils"

type WorkOrderTimelineProps = {
  entries: WorkOrderTimelineEntry[]
  dir?: "rtl" | "ltr"
  language?: "ar" | "en"
}

const kindLabels: Record<WorkOrderTimelineEntry["kind"], string> = {
  created: "Created",
  updated: "Updated",
  status: "Status",
  reassignment: "Reassignment",
  delegation: "Delegation",
  execution: "Execution",
  approval: "Approval",
  closure: "Closure",
  audit: "Audit",
}

export function WorkOrderTimeline({
  entries,
  dir = "rtl",
  language = "ar",
}: WorkOrderTimelineProps) {
  if (entries.length === 0) {
    return (
      <div dir={dir} className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        {language === "ar" ? "لا توجد أحداث تشغيلية مسجلة بعد." : "No operational events recorded yet."}
      </div>
    )
  }

  return (
    <ol dir={dir} className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="grid grid-cols-[auto_1fr] gap-3">
          <span
            className={cn(
              "mt-1 size-2.5 rounded-full",
              entry.kind === "approval" || entry.kind === "closure"
                ? "bg-emerald-500"
                : entry.kind === "reassignment" || entry.kind === "delegation"
                  ? "bg-amber-500"
                  : "bg-primary"
            )}
            aria-hidden
          />
          <div className="min-w-0 rounded-md border bg-card px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-sm">
                {language === "ar" ? entry.titleAr : entry.titleEn}
              </p>
              <Badge variant="outline" className="text-[11px]">
                {kindLabels[entry.kind]}
              </Badge>
            </div>
            {entry.description ? (
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground text-xs leading-relaxed">
                {entry.description}
              </p>
            ) : null}
            {entry.occurredAt ? (
              <p className="mt-2 text-muted-foreground text-xs tabular-nums">
                {formatArDateTime(entry.occurredAt)}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}
