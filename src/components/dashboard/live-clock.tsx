import { Clock } from "lucide-react"
import { useEffect, useState } from "react"

const fmtTime = new Intl.DateTimeFormat("ar", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
  numberingSystem: "latn",
})
const fmtDay = new Intl.DateTimeFormat("ar", { weekday: "long" })
const fmtDate = new Intl.DateTimeFormat("ar", {
  day: "numeric",
  month: "long",
  year: "numeric",
  calendar: "gregory",
  numberingSystem: "latn",
})

/** Live clock + Arabic day/date for the dashboard header. Updates every second. */
export function LiveClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-2.5 shadow-sm">
      <span className="text-primary bg-primary/10 flex size-9 items-center justify-center rounded-lg">
        <Clock className="size-4" aria-hidden />
      </span>
      <div className="leading-tight">
        <div className="text-lg font-bold tabular-nums" dir="ltr">
          {fmtTime.format(now)}
        </div>
        <div className="text-muted-foreground text-xs">
          {fmtDay.format(now)} · {fmtDate.format(now)}
        </div>
      </div>
    </div>
  )
}
