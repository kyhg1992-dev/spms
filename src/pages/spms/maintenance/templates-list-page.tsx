import { Plus } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"

import { TemplateApplyDialog } from "@/components/maintenance/template-apply-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/contexts/auth-context"
import { useMaintenanceTemplatesQuery } from "@/hooks/use-spms-data"
import { serviceLevelColor } from "@/lib/spms-colors"

const TRIGGER_AR: Record<string, string> = { hours: "ساعات", km: "كيلومترات", time: "زمن" }

export default function TemplatesListPage() {
  const { data, isLoading, error } = useMaintenanceTemplatesQuery()
  const { spmsRole } = useAuth()
  const canManage = spmsRole === "admin" || spmsRole === "manager"
  const [applyFor, setApplyFor] = useState<{ id: string; name: string } | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">قوالب الصيانة</h1>
          <p className="text-muted-foreground mt-1 text-sm">قالب لكل نوع معدة → مستويات A/B/C/D بمهامها وتسلسل تناوب.</p>
        </div>
        {canManage ? (
          <Button size="sm" className="shrink-0 gap-2" asChild>
            <Link to="/dashboard/maintenance-templates/new">
              <Plus className="size-4" aria-hidden />
              قالب جديد
            </Link>
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-destructive text-sm">تعذّر تحميل القوالب.</p> : null}

      <Card className="shadow-sm overflow-hidden">
        <CardHeader>
          <CardTitle>القوالب</CardTitle>
          <CardDescription>تُطبَّق على الأصول حسب النوع وتغذّي محرّك الجدولة.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 px-4 pb-6">
          {isLoading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (data ?? []).length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 py-14 text-center">
              <p className="font-medium">لا توجد قوالب بعد</p>
              <p className="text-muted-foreground max-w-sm text-sm">أنشئ أول قالب — يمكنك البدء من قالب جاهز.</p>
              {canManage ? (
                <Button size="sm" asChild>
                  <Link to="/dashboard/maintenance-templates/new">قالب جديد</Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="-mx-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>القالب</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>المحفّز</TableHead>
                    <TableHead>التسلسل</TableHead>
                    <TableHead>المستويات</TableHead>
                    {canManage ? <TableHead className="text-end">إجراء</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{t.assetTypeLabel ?? "—"}</TableCell>
                      <TableCell className="text-sm">
                        {(TRIGGER_AR[t.triggerMode ?? "hours"] ?? "ساعات")} · كل {t.stepInterval}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(t.sequence ?? []).map((code, i) => {
                            const c = serviceLevelColor(code)
                            return (
                              <span key={i} className="inline-flex size-5 items-center justify-center rounded text-[10px] font-bold" style={{ backgroundColor: c.bg, color: c.fg }}>{code}</span>
                            )
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{(t.levels ?? []).length} مستوى</Badge>
                      </TableCell>
                      {canManage ? (
                        <TableCell className="text-end">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setApplyFor({ id: t.id, name: t.name })}>
                              تطبيق على أصول
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                              <Link to={`/dashboard/maintenance-templates/${t.id}`}>تعديل</Link>
                            </Button>
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {applyFor ? (
        <TemplateApplyDialog
          open={!!applyFor}
          onOpenChange={(o) => !o && setApplyFor(null)}
          templateId={applyFor.id}
          templateName={applyFor.name}
        />
      ) : null}
    </div>
  )
}
