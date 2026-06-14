import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { actionColor, serviceLevelColor } from "@/lib/spms-colors"
import type { MaintenanceActionCode, WorkOrder } from "@/models/firestore"

const ACTION_AR: Record<MaintenanceActionCode, string> = {
  REPLACE: "استبدال",
  CLEAN: "تنظيف",
  CHECK: "فحص",
  DRAIN: "تصريف",
  GREASE: "تشحيم",
  ADJUST: "ضبط",
  WASH: "غسيل",
  REFILL: "تعبئة",
}

/**
 * Clear, bilingual service-task table for a PM work order — mirrors the
 * Komatsu-style maintenance form (description EN/AR, item code, qty, colored
 * action chip, part no). Renders nothing when the WO carries no template tasks.
 */
export function ServiceTaskTable({ workOrder }: { workOrder: WorkOrder }) {
  const tasks = workOrder.serviceTasks
  if (!tasks || tasks.length === 0) return null
  const level = workOrder.serviceLevelCode
  const c = level ? serviceLevelColor(level) : null

  return (
    <Card className="overflow-hidden rounded-xl border-border/70 shadow-md" style={c ? { borderInlineStartWidth: 4, borderInlineStartColor: c.solid } : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {level && c ? (
            <span className="flex size-7 items-center justify-center rounded-md text-sm font-bold text-white" style={{ backgroundColor: c.solid }}>
              {level}
            </span>
          ) : null}
          مهام الخدمة {workOrder.serviceLevelNameAr ? `— ${workOrder.serviceLevelNameAr}` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 px-4 pb-5">
        {/* Mobile: stacked cards for clarity on the technician's phone. */}
        <div className="space-y-2 pb-1 md:hidden">
          {tasks.map((t, i) => {
            const ac = actionColor(t.action)
            return (
              <div key={i} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">
                      {i + 1}. {t.descAr}
                    </div>
                    {t.descEn ? <div className="text-muted-foreground text-[11px]" dir="ltr">{t.descEn}</div> : null}
                  </div>
                  <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: ac.bg, color: ac.fg }}>
                    {ACTION_AR[t.action] ?? t.action}
                  </span>
                </div>
                <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                  {t.itemCode ? <span dir="ltr">كود: {t.itemCode}</span> : null}
                  {t.qty ? <span>كمية: {t.qty}</span> : null}
                  {t.partNo ? <span dir="ltr">قطعة: {t.partNo}</span> : null}
                </div>
              </div>
            )
          })}
        </div>

        {/* Desktop: full table. */}
        <div className="-mx-4 hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-[11px]">
                <th className="p-2 text-start font-medium">#</th>
                <th className="p-2 text-start font-medium">الوصف / Description</th>
                <th className="p-2 text-start font-medium">Item Code</th>
                <th className="p-2 text-center font-medium">الكمية</th>
                <th className="p-2 text-start font-medium">الإجراء</th>
                <th className="p-2 text-start font-medium">رقم القطعة</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t, i) => {
                const ac = actionColor(t.action)
                return (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-2 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="p-2">
                      <div className="font-medium">{t.descAr}</div>
                      {t.descEn ? <div className="text-muted-foreground text-[11px]" dir="ltr">{t.descEn}</div> : null}
                    </td>
                    <td className="p-2 font-mono text-[11px] text-muted-foreground" dir="ltr">{t.itemCode ?? "—"}</td>
                    <td className="p-2 text-center font-medium tabular-nums">{t.qty ?? "—"}</td>
                    <td className="p-2">
                      <span className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: ac.bg, color: ac.fg }}>
                        {ACTION_AR[t.action] ?? t.action}
                      </span>
                    </td>
                    <td className="p-2 font-mono text-[11px] text-muted-foreground" dir="ltr">{t.partNo ?? "—"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
