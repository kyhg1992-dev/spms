import { ChevronLeft } from "lucide-react"
import { Fragment } from "react"
import { Link, useLocation } from "react-router-dom"

const LABELS: Record<string, string> = {
  dashboard: "لوحة القيادة",
  assets: "الأصول",
  "work-orders": "أوامر العمل",
  pm: "صيانة وقائية",
  notifications: "الإشعارات",
  users: "المستخدمون",
  settings: "الإعدادات",
  reports: "التقارير",
  activity: "سجل النشاط",
}

function segmentLabel(segment: string, fullPath: string): string {
  const key = segment.toLowerCase()
  const mapped = LABELS[key]
  if (mapped) return mapped
  if (fullPath.includes("/assets/") && segment !== "assets") return "تفاصيل الأصل"
  if (fullPath.includes("/work-orders/") && segment !== "work-orders") return "تفاصيل أمر العمل"
  return segment
}

export function RecordBreadcrumbs() {
  const { pathname } = useLocation()
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) return null
  if (segments[0] !== "dashboard") return null
  if (segments.length <= 1) return null

  const crumbs: { to: string; label: string; isLast: boolean }[] = []
  let acc = ""
  segments.forEach((seg, idx) => {
    acc += `/${seg}`
    crumbs.push({
      to: acc,
      label: segmentLabel(seg, acc),
      isLast: idx === segments.length - 1,
    })
  })

  return (
    <nav aria-label="فتات التنقل" className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs md:text-[13px]">
      {crumbs.map((c) => (
        <Fragment key={c.to}>
          {c.to !== crumbs[0]?.to ? (
            <ChevronLeft className="text-muted-foreground/70 size-3.5 rotate-180 rtl:rotate-0" aria-hidden />
          ) : null}
          {!c.isLast ? (
            <Link to={c.to} className="hover:text-foreground max-w-[200px] truncate transition-colors">
              {c.label}
            </Link>
          ) : (
            <span className="text-foreground max-w-[240px] truncate font-medium">{c.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  )
}
