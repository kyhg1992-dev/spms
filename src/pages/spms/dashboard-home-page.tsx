import { ArrowUpRight, Boxes, Gauge, MapPin, Timer, Warehouse, Wrench } from "lucide-react"
import type { ReactNode } from "react"
import { lazy, Suspense, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { LiveClock } from "@/components/dashboard/live-clock"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  useAssetsQuery,
  useCompanySettingsQuery,
  useNotificationsQuery,
  usePMSchedulesQuery,
  useWorkOrdersQuery,
} from "@/hooks/use-spms-data"
import { computeDashboardKpis } from "@/lib/dashboard-metrics"
import { formatArDateTime } from "@/lib/format"
import { parseLocationAliases, resolveSite } from "@/lib/saudi-locations"
import { buildOperationalSummary } from "@/lib/operational-summary"
import { pmTriggerModeAr } from "@/lib/labels-ar"
import { pmServiceTypeAr } from "@/lib/labels-ar"
import { workOrderStatusAr } from "@/lib/labels-ar"
import type { PMSchedule } from "@/models/firestore"

const FleetMap = lazy(() => import("@/components/dashboard/fleet-map"))

const WO_COLORS = ["#0369a1", "#0ea5e9", "#f59e0b", "#10b981", "#94a3b8", "#64748b"]
const PM_COLORS = ["#ef4444", "#34d399", "#94a3b8"]

function countOverduePM(items: (PMSchedule & { id: string })[], nowMs: number): number {
  return items.filter(
    (p) =>
      p.isActive &&
      typeof p.nextRunAt?.toMillis === "function" &&
      p.nextRunAt.toMillis() < nowMs
  ).length
}

function formatHours(n: number | null) {
  if (n === null || Number.isNaN(n)) return "—"
  return `${n.toFixed(1)} س`
}

export default function DashboardHomePage() {
  const assets = useAssetsQuery()
  const workOrders = useWorkOrdersQuery()
  const pm = usePMSchedulesQuery()
  const notifications = useNotificationsQuery()
  const company = useCompanySettingsQuery()
  const aliasText = company.data?.locationAliases

  const [dashboardNowMs, setDashboardNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setDashboardNowMs(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const unread = useMemo(
    () => (notifications.data ?? []).filter((n) => !n.isRead).length,
    [notifications.data]
  )

  const fleetStats = useMemo(() => {
    const list = assets.data ?? []
    const aliases = parseLocationAliases(aliasText)
    const locations = new Set(list.map((a) => a.location?.trim()).filter(Boolean))
    const located = list.filter((a) => resolveSite(a.location, aliases))
    return { count: list.length, locations: locations.size, located }
  }, [assets.data, aliasText])

  const kpis = useMemo(
    () =>
      computeDashboardKpis({
        assets: assets.data ?? [],
        workOrders: workOrders.data ?? [],
        pm: pm.data ?? [],
        unreadNotifications: unread,
        comparisonNowMs: dashboardNowMs,
      }),
    [assets.data, dashboardNowMs, pm.data, unread, workOrders.data]
  )

  const woPieData = useMemo(() => {
    const rows = workOrders.data
    if (!rows) return []
    const map = new Map<string, number>()
    rows.forEach((w) => {
      map.set(String(w.status), (map.get(String(w.status)) ?? 0) + 1)
    })
    return [...map.entries()].map(([status, count]) => ({
      label: workOrderStatusAr[status] ?? status,
      value: count,
    }))
  }, [workOrders.data])

  const pmBarData = useMemo(() => {
    const rows = pm.data
    if (!rows || rows.length === 0) return []
    const overdue = countOverduePM(rows, dashboardNowMs)
    const onSchedule = rows.filter(
      (p) =>
        p.isActive &&
        typeof p.nextRunAt?.toMillis === "function" &&
        p.nextRunAt.toMillis() >= dashboardNowMs
    ).length
    const paused = rows.filter((p) => !p.isActive).length
    return [
      { name: "متأخر", count: overdue, fill: PM_COLORS[0] },
      { name: "على الموعد", count: onSchedule, fill: PM_COLORS[1] },
      { name: "موقوف مؤقتاً", count: paused, fill: PM_COLORS[2] },
    ]
  }, [pm.data, dashboardNowMs])

  const workload = useMemo(() => {
    const summary = buildOperationalSummary({
      assets: assets.data ?? [],
      workOrders: workOrders.data ?? [],
      pmSchedules: pm.data ?? [],
      nowMs: dashboardNowMs,
    })
    return summary.technicianExecutionStatus
      .slice(0, 6)
      .map((row) => [row.technicianUid, row.activeWorkOrders] as const)
  }, [assets.data, dashboardNowMs, pm.data, workOrders.data])

  const upcomingPm = useMemo(() => {
    return buildOperationalSummary({
      assets: assets.data ?? [],
      workOrders: workOrders.data ?? [],
      pmSchedules: pm.data ?? [],
      nowMs: dashboardNowMs,
    }).upcomingPM
  }, [assets.data, dashboardNowMs, pm.data, workOrders.data])

  const loading =
    assets.isLoading || workOrders.isLoading || pm.isLoading || notifications.isLoading

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-2/3 rounded-lg" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={`sk-${String(i)}`} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const errStrip =
    assets.error || workOrders.error || pm.error || notifications.error ? (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="text-destructive py-4 text-sm">
          تعذّر مزامنة جزء من الواجهات التشغيلية. راجع الاتصال وتكوين Firebase.
        </CardContent>
      </Card>
    ) : null

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="outline" className="mb-3 border-border/80">
            منصّة المؤسسة
          </Badge>
          <h1 className="from-foreground bg-gradient-to-bl to-sky-900/40 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:to-sky-200/50 md:text-4xl">
            لوحة قيادة للصيانة الوقائية الذكية
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
            مؤشرات حيّة مستمدة من قواعد Firestore فورية لتتبّع الأصول الثقيلة، حركة الفرق الصيانية، والامتثال
            للصيانة الدورية وفق أسلوب المنشآت العالمية.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <LiveClock />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" asChild>
              <Link to="/dashboard/work-orders">
                إنشاء أمر عمل سريع <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/dashboard/pm">جدول صيانة دورية</Link>
            </Button>
          </div>
        </div>
      </div>

      {errStrip}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          title="صافي التوفر التقريبي"
          value={kpis.availabilityPct !== null ? `${kpis.availabilityPct}%` : "—"}
          hint="نِسَب أسطول نشط غير في حالة صيانة"
          icon={<Gauge className="size-4" />}
        />
        <KpiTile
          title="MTBF تشغيلي"
          value={formatHours(kpis.mtbfHours)}
          hint="ساعات تشغيل مجمّعة / عدد الحوادث النموذجية"
          icon={<Timer className="size-4" />}
        />
        <KpiTile
          title="MTTR إصلاحات"
          value={formatHours(kpis.mttrHours)}
          hint="متوسط زمن إغلاق أوامر العمل المكتملة"
          icon={<Wrench className="size-4" />}
        />
        <KpiTile title="أوامر عمل نشطة" value={String(kpis.activeWorkOrders)} hint="جميع الحالات التنفيذية" />
        <KpiTile title="PM متأخر" value={String(kpis.delayedPm)} hint="خطط فعّالة متجاوزة للموعد" />
        <KpiTile title="الأسطول المملوك" value={String(kpis.assetFleetSize)} hint="أصول غير متوقفة" />
        <KpiTile title="تنبيهات غير مقروءة" value={String(kpis.unreadAlerts)} hint="في مركز الإشعارات" />
        <KpiTile title="إجمالي الأصول" value={String(fleetStats.count)} hint="كل الأصول المسجّلة" icon={<Boxes className="size-4" />} />
        <KpiTile title="عدد المواقع" value={String(fleetStats.locations)} hint="مواقع ميدانية مميّزة" icon={<MapPin className="size-4" />} />
      </section>

      <section>
        <Card className="overflow-hidden rounded-xl border border-border/80 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="size-4" aria-hidden />
              خريطة الأسطول
            </CardTitle>
            <CardDescription>
              {fleetStats.located.length} أصل موزّع على المواقع المعروفة من {fleetStats.count}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {fleetStats.located.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                لا توجد أصول بمواقع معروفة بعد — حدّد موقع الأصل (مثل: جدة، رابغ، تبوك) عند الإضافة أو التعديل.
              </p>
            ) : (
              <Suspense fallback={<Skeleton className="h-[360px] w-full rounded-lg" />}>
                <FleetMap assets={fleetStats.located} aliasText={aliasText} />
              </Suspense>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_min(100%,360px)]">
        <Card className="overflow-hidden rounded-xl border border-border/80 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Warehouse className="size-4" aria-hidden />
              أحمال الفنيين (أوامر مفتوحة)
            </CardTitle>
            <CardDescription>بالاعتماد على حقل الإسناد في كل أمر عمل لم يُغلق بعد.</CardDescription>
          </CardHeader>
          <CardContent>
            {workload.length === 0 ? (
              <p className="text-muted-foreground text-sm">لا توجد أوامر عمل مُسندة حالياً للفنيين.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المعرّف القصير للفني</TableHead>
                    <TableHead className="text-end">عدد الأوامر</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workload.map(([uid, cnt]) => (
                    <TableRow key={uid}>
                      <TableCell className="font-mono text-xs" dir="ltr">
                        {uid.slice(0, 10)}…
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{cnt}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-xl border border-border/80 shadow-md">
          <CardHeader>
            <CardTitle className="text-base">صيانة وقائية قادمة</CardTitle>
            <CardDescription>أقرب خمسة مواعيد لمخططات نشطة.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingPm.length === 0 ? (
              <p className="text-muted-foreground text-sm">لا توجد جداول نشطة.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {upcomingPm.map((s) => (
                  <li key={s.id} className="rounded-lg border bg-muted/40 p-3 shadow-xs">
                    <p className="font-medium leading-snug">{s.title}</p>
                    <div className="text-muted-foreground mt-1 flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary">{pmServiceTypeAr[s.serviceType] ?? s.serviceType}</Badge>
                      <Badge variant="outline">{pmTriggerModeAr[s.triggerMode]}</Badge>
                      <span>{formatArDateTime(s.nextRunAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="min-h-[340px] rounded-xl border border-border/80 shadow-md">
          <CardHeader>
            <CardTitle>حالات أوامر العمل</CardTitle>
            <CardDescription>تفكيك فوري لمخزون التنفيذ — دعم مخطط SAP/Maximo.</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            {woPieData.length === 0 ? (
              <p className="text-muted-foreground flex h-full items-center justify-center text-sm">لا بيانات عمليات</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={woPieData} cx="50%" cy="50%" outerRadius={92} dataKey="value" nameKey="label" label={false}>
                    {woPieData.map((_, idx) => (
                      <Cell key={`wo-cell-${String(idx)}`} fill={WO_COLORS[idx % WO_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-[340px] rounded-xl border border-border/80 shadow-md">
          <CardHeader>
            <CardTitle>التزام الصيانة الوقائية</CardTitle>
            <CardDescription>متابعة التأخيرات والجداول المتوقفة.</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            {(pm.data ?? []).length === 0 ? (
              <p className="text-muted-foreground flex h-full items-center justify-center text-sm">لا مخططات</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pmBarData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "currentColor", fontSize: 11 }} interval={0} />
                  <YAxis allowDecimals={false} width={34} />
                  <Tooltip cursor={{ fill: "hsl(var(--muted) / .35)" }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {pmBarData.map((_, i) => (
                      <Cell key={`cell-pm-${String(i)}`} fill={pmBarData[i]?.fill ?? PM_COLORS[i % PM_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function KpiTile({
  title,
  value,
  hint,
  icon,
}: {
  title: string
  value: string
  hint: string
  icon?: ReactNode
}) {
  return (
    <Card className="rounded-xl border border-border/70 bg-gradient-to-br from-card to-card/70 shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div>
          <CardDescription className="text-xs font-semibold uppercase tracking-wide">{title}</CardDescription>
          <CardTitle className="mt-1 text-3xl font-semibold tabular-nums">{value}</CardTitle>
        </div>
        {icon ? (
          <span className="text-primary bg-primary/10 rounded-md p-2">{icon}</span>
        ) : null}
      </CardHeader>
      <CardContent className="text-muted-foreground text-xs leading-snug">{hint}</CardContent>
    </Card>
  )
}
