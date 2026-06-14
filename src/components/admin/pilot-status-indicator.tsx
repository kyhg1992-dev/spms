import { Badge } from "@/components/ui/badge"
import { pilotWarningBannerText, type PilotReadinessStatus } from "@/lib/pilot-readiness"

type PilotStatusIndicatorProps = {
  status: PilotReadinessStatus
  dir?: "rtl" | "ltr"
  language?: "ar" | "en"
}

export function PilotStatusIndicator({
  status,
  dir = "rtl",
  language = "ar",
}: PilotStatusIndicatorProps) {
  const text = pilotWarningBannerText(status)
  const variant = status === "blocked" ? "destructive" : status === "warning" ? "secondary" : "outline"

  return (
    <div dir={dir} className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
      <Badge variant={variant}>{status.toUpperCase()}</Badge>
      <span className="text-muted-foreground">{language === "ar" ? text.ar : text.en}</span>
    </div>
  )
}
