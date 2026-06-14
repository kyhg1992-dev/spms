import RoleGate from "@/components/auth/role-gate"
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
import { useActivityLogsQuery } from "@/hooks/use-spms-data"
import { formatArDateTime } from "@/lib/format"

function ActivityBody() {
  const q = useActivityLogsQuery(true)

  if (q.isLoading) return <Skeleton className="min-h-[320px] w-full rounded-xl" />
  if (q.error)
    return <p className="text-destructive text-sm">تعذر تحميل السجل وفق سياسات Firestore لهذه الجلسة.</p>

  return (
    <div className="-mx-4 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>النشاط العربي المعروض</TableHead>
            <TableHead>نوع الكيان</TableHead>
            <TableHead dir="ltr">معرّف</TableHead>
            <TableHead>الوقت النظامي</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(q.data ?? []).length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground text-center">
                فارغ تمامًا — ستُسجَّل كل العمليات هنا لمطابقة الامتثال.
              </TableCell>
            </TableRow>
          ) : (
            (q.data ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.labelAr}</TableCell>
                <TableCell>{row.entityType}</TableCell>
                <TableCell className="font-mono text-xs" dir="ltr">
                  {row.entityId.slice(0, 10)}…
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{formatArDateTime(row.updatedAt)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export default function ActivityLogPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">سجل النشاط والتدقيق</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm">
          يمكن للمسؤولين والمديرين فقط الوصول لمستودع نشاط ضوابط الحوكمة (محفوظ في مجموعة ActivityLogs).
        </p>
      </div>

      <RoleGate roles={["admin", "manager"]}>
        <Card className="rounded-xl border-border/70 shadow-lg">
          <CardHeader>
            <CardTitle>أحداث منظَّمة ذات طابع حساس</CardTitle>
            <CardDescription>مزامنة مباشرة من Firestore — آخر ثلاثمائة حدث.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityBody />
          </CardContent>
        </Card>
      </RoleGate>
    </div>
  )
}
