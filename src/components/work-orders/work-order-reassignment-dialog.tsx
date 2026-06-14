import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/auth-context"
import { useUsersQuery } from "@/hooks/use-spms-data"
import type { WorkOrder } from "@/models/firestore"
import { adminReassignWorkOrderControlled } from "@/services/firestore/spms-service"

type WorkOrderReassignmentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workOrder: (WorkOrder & { id: string }) | null
  onReassigned?: () => void
  dir?: "rtl" | "ltr"
}

export function WorkOrderReassignmentDialog({
  open,
  onOpenChange,
  workOrder,
  onReassigned,
  dir = "rtl",
}: WorkOrderReassignmentDialogProps) {
  const { spmsRole, user } = useAuth()
  const users = useUsersQuery()
  const [newAssigneeUid, setNewAssigneeUid] = useState("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)

  const assignableUsers = useMemo(
    () =>
      (users.data ?? []).filter(
        (item) => item.isActive && (item.role === "technician" || item.role === "manager")
      ),
    [users.data]
  )

  const previousAssignee = workOrder?.assignedTo ?? workOrder?.assigneeId
  const previousAssigneeLabel =
    assignableUsers.find((item) => item.id === previousAssignee)?.displayName ?? previousAssignee ?? "غير مسند"

  async function submit() {
    if (!workOrder || !spmsRole || !user?.uid) return
    if (spmsRole !== "admin" && spmsRole !== "manager") {
      toast.error("إعادة الإسناد متاحة للمسؤول أو المدير فقط.")
      return
    }
    if (!newAssigneeUid) {
      toast.error("اختر الفني أو المدير الجديد.")
      return
    }
    if (!reason.trim()) {
      toast.error("سبب إعادة الإسناد مطلوب.")
      return
    }

    setBusy(true)
    try {
      const res = await adminReassignWorkOrderControlled(spmsRole, {
        workOrderId: workOrder.id,
        newAssigneeUid,
        reassignedBy: user.uid,
        reassignmentReason: reason,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("تمت إعادة إسناد أمر العمل")
      setNewAssigneeUid("")
      setReason("")
      onOpenChange(false)
      onReassigned?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={dir} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>إعادة إسناد أمر العمل</DialogTitle>
          <DialogDescription>
            استخدم هذا الإجراء عند تحويل المهمة بين الفنيين أو مشرفي الورشة مع حفظ سبب تشغيلي واضح.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="text-muted-foreground">المسند الحالي</p>
            <p className="mt-1 font-medium">{previousAssigneeLabel}</p>
          </div>

          <div className="space-y-2">
            <Label>المسند الجديد</Label>
            <Select value={newAssigneeUid} onValueChange={setNewAssigneeUid} disabled={busy}>
              <SelectTrigger>
                <SelectValue placeholder="اختر فني أو مدير" />
              </SelectTrigger>
              <SelectContent>
                {assignableUsers.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.displayName} - {item.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reassignmentReason">سبب إعادة الإسناد</Label>
            <Textarea
              id="reassignmentReason"
              rows={4}
              value={reason}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
              placeholder="مثال: تحويل المهمة إلى فني مناوبة الورشة المسائية."
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button type="button" disabled={busy || !workOrder} onClick={() => void submit()}>
            {busy ? "جار إعادة الإسناد..." : "تأكيد إعادة الإسناد"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

