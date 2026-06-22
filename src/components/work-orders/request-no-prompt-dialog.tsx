import { doc, getDoc } from "firebase/firestore"
import { ClipboardList } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/auth-context"
import { useCompanySettingsQuery } from "@/hooks/use-spms-data"
import { useI18n } from "@/i18n/i18n"
import { db } from "@/lib/firebase"
import { isBypassCode } from "@/lib/request-bypass"
import { serviceLevelColor } from "@/lib/spms-colors"
import { normalizeWorkOrder } from "@/lib/work-order-normalize"
import type { WorkOrder } from "@/models/firestore"
import { updateWorkOrder } from "@/services/firestore/spms-service"
import { requestNoTaken } from "@/services/firestore/work-order-request-no"

/**
 * Prompts the manager for the originating request (CAM) number right after a work
 * order is generated — while showing the maintenance plan so the executor knows the
 * scope. Entering the bypass code defers the number (recorded as bypassed).
 */
export function RequestNoPromptDialog({
  workOrderId,
  open,
  onDone,
}: {
  workOrderId: string | null
  open: boolean
  onDone: () => void
}) {
  const { t } = useI18n()
  const { spmsRole } = useAuth()
  const company = useCompanySettingsQuery()
  const queryClient = useQueryClient()
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const [wo, setWo] = useState<(WorkOrder & { id: string }) | null>(null)

  useEffect(() => {
    if (!open || !workOrderId) return
    setValue("")
    setWo(null)
    void getDoc(doc(db, "workOrders", workOrderId)).then((snap) => {
      if (snap.exists()) setWo(normalizeWorkOrder(snap.id, snap.data()))
    })
  }, [open, workOrderId])

  async function save() {
    if (!spmsRole || !workOrderId) return onDone()
    setBusy(true)
    try {
      if (isBypassCode(value, company.data)) {
        const res = await updateWorkOrder(spmsRole, workOrderId, {
          requestNoBypassed: true,
          externalRequestNo: undefined,
        })
        if (res.error) return void toast.error(res.error)
        toast.success(t("reqp.bypassed"))
      } else {
        if (value.trim() && (await requestNoTaken(value, workOrderId))) {
          return void toast.error(t("reqp.duplicate"))
        }
        const res = await updateWorkOrder(spmsRole, workOrderId, {
          externalRequestNo: value.trim() || undefined,
          requestNoBypassed: false,
        })
        if (res.error) return void toast.error(res.error)
      }
      await queryClient.invalidateQueries({ queryKey: ["workOrders"] })
      onDone()
    } finally {
      setBusy(false)
    }
  }

  const level = wo?.serviceLevelCode
  const c = level ? serviceLevelColor(level) : null
  const tasks = wo?.serviceTasks ?? []

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDone() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reqp.title")}</DialogTitle>
          <DialogDescription>{t("reqp.bypassHint")}</DialogDescription>
        </DialogHeader>

        {wo ? (
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <ClipboardList className="size-4" aria-hidden />
              {t("reqp.plan")}
              {level && c ? (
                <span className="flex size-5 items-center justify-center rounded text-[10px] font-bold text-white" style={{ backgroundColor: c.solid }}>
                  {level}
                </span>
              ) : null}
              {wo.serviceLevelNameAr ? <span className="text-muted-foreground font-normal">— {wo.serviceLevelNameAr}</span> : null}
            </p>
            {tasks.length > 0 ? (
              <ul className="max-h-40 list-disc space-y-0.5 overflow-y-auto ps-5 text-sm">
                {tasks.map((tk, i) => (
                  <li key={i}>{tk.descAr}{tk.qty ? ` — ${tk.qty}` : ""}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">{wo.title}</p>
            )}
          </div>
        ) : null}

        <Input
          dir="ltr"
          autoFocus
          placeholder="REQ-2026-014532"
          value={value}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void save() }}
        />
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onDone}>{t("reqp.later")}</Button>
          <Button disabled={busy} onClick={() => void save()}>{t("reqp.saveGo")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
