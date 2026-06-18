import { AlertTriangle } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/auth-context"
import { resetOperationalData } from "@/services/firestore/admin-reset-service"

const CONFIRM_WORD = "تصفير"

/** Admin-only destructive reset of operational data for a clean test run. */
export function DangerZone() {
  const { spmsRole } = useAuth()
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)

  if (spmsRole !== "admin") return null

  async function run() {
    setBusy(true)
    try {
      const res = await resetOperationalData("admin")
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(
        `تم التصفير: ${res.counts.workOrders} أمر عمل · ${res.counts.meterReadings} قراءة · ${res.counts.notifications} إشعار · ${res.counts.assets} أصل أُعيد ضبط دورته`
      )
      setConfirm("")
      await queryClient.invalidateQueries()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="max-w-3xl rounded-xl border-destructive/40 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-5" aria-hidden />
          منطقة الخطر — تصفير بيانات التجربة
        </CardTitle>
        <CardDescription>
          يحذف <b>كل أوامر العمل والقراءات والإشعارات</b> ويعيد ضبط مؤشّر الصيانة (آخر خدمة) لكل أصل،
          لبدء تجربة بسجل نظيف. تبقى الأصول والقوالب والمستخدمون وقيم العدّادات كما هي.
          <br />
          <b>لا يمكن التراجع عن هذه العملية.</b>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="confirm-reset" className="text-xs">
            اكتب «{CONFIRM_WORD}» للتأكيد
          </Label>
          <Input
            id="confirm-reset"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={CONFIRM_WORD}
            className="max-w-xs"
          />
        </div>
        <Button
          variant="destructive"
          disabled={confirm.trim() !== CONFIRM_WORD || busy}
          onClick={() => void run()}
        >
          {busy ? "جارٍ التصفير…" : "تصفير بيانات التجربة الآن"}
        </Button>
      </CardContent>
    </Card>
  )
}
