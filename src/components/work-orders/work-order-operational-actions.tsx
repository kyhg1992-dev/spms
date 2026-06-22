import { CheckCircle2, ClipboardCheck, FilePenLine, Play, UserCog, XCircle } from "lucide-react"
import type { ReactNode } from "react"
import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { WorkOrderReassignmentDialog } from "@/components/work-orders/work-order-reassignment-dialog"
import { WorkOrderExecutionDialog } from "@/components/work-orders/work-order-execution-dialog"
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
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/auth-context"
import { createOfflineExecutionDraft } from "@/lib/mobile-technician"
import { canCompleteExecution, canSaveExecutionDraft, canStartExecution } from "@/lib/technician-execution"
import { getWorkOrderLifecycleStatus } from "@/lib/work-order-lifecycle"
import { workOrderPendingOwner } from "@/lib/work-order-pending"
import type { WorkOrder } from "@/models/firestore"
import {
  completeTechnicianExecution,
  finalizeWorkOrder,
  rejectWorkOrder,
  saveTechnicianExecutionDraft,
  startTechnicianExecution,
} from "@/services/firestore/spms-service"

type ActionDialog = "draft" | "complete" | "reject" | null

type WorkOrderOperationalActionsProps = {
  workOrder: WorkOrder & { id: string }
  dir?: "rtl" | "ltr"
  language?: "ar" | "en"
}

const text = {
  ar: {
    title: "إجراءات تشغيلية",
    missingAuth: "يتطلب الإجراء مستخدما نشطا وصلاحية SPMS.",
    managerOnly: "متاح للمدير أو مسؤول النظام فقط.",
    start: "بدء التنفيذ",
    draft: "حفظ مسودة",
    complete: "إنهاء التنفيذ",
    finalize: "اعتماد وإغلاق",
    finalizeHint: "متاح بعد إنهاء الفنّي للتنفيذ.",
    needRequestNo: "أدخل رقم الطلب (الكام) أولاً قبل الإغلاق.",
    reject: "رفض وإعادة",
    assign: "إسناد لفنّي",
    reassign: "إعادة إسناد",
    nextStep: "الخطوة التالية",
    completionNotes: "ملاحظات الإكمال",
    technicianNotes: "ملاحظات الفني",
    laborHours: "ساعات العمل",
    downtimeHours: "ساعات التوقف",
    safetyNotes: "ملاحظات السلامة",
    partsNote: "ملاحظة قطع الغيار",
    rejectionReason: "سبب الرفض",
    executionDescription: "يتم حفظ بيانات التنفيذ على أمر العمل نفسه.",
    offlineReady: "جاهز لمسودة محلية",
    quickNote: "ملاحظة سريعة",
    cancel: "إلغاء",
    submit: "تنفيذ",
    saved: "تم تنفيذ الإجراء التشغيلي.",
  },
  en: {
    title: "Operational Actions",
    missingAuth: "A signed-in SPMS user and role are required.",
    managerOnly: "Available to manager or system admin only.",
    start: "Start Execution",
    draft: "Save Draft",
    complete: "Finish Execution",
    finalize: "Approve & Close",
    finalizeHint: "Available after the technician finishes execution.",
    needRequestNo: "Enter the request (CAM) number before closing.",
    reject: "Reject & Return",
    assign: "Assign technician",
    reassign: "Reassign",
    nextStep: "Next step",
    completionNotes: "Completion Notes",
    technicianNotes: "Technician Notes",
    laborHours: "Labor Hours",
    downtimeHours: "Downtime Hours",
    safetyNotes: "Safety Notes",
    partsNote: "Required Parts Note",
    rejectionReason: "Rejection Reason",
    executionDescription: "Execution data is saved directly on the work order.",
    offlineReady: "Local draft ready",
    quickNote: "Quick Note",
    cancel: "Cancel",
    submit: "Submit",
    saved: "Operational action completed.",
  },
}

function firstReason(errors: string[], fallback: string): string {
  return errors[0] ?? fallback
}

function canManage(role: string | null): boolean {
  return role === "admin" || role === "manager"
}

export function WorkOrderOperationalActions({
  workOrder,
  dir = "rtl",
  language = "ar",
}: WorkOrderOperationalActionsProps) {
  const labels = text[language]
  const { spmsRole, user } = useAuth()
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<ActionDialog>(null)
  const [reassignOpen, setReassignOpen] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")

  const lifecycleStatus = getWorkOrderLifecycleStatus(workOrder)
  const hasAuth = !!spmsRole && !!user?.uid
  const manager = canManage(spmsRole)
  const hasAssignee = !!(workOrder.assignedTo?.trim() || workOrder.assigneeId?.trim())
  const hasRequestNo = !!workOrder.externalRequestNo?.trim() || !!workOrder.requestNoBypassed
  const readyToFinalize = manager && (lifecycleStatus === "WAITING_APPROVAL" || lifecycleStatus === "COMPLETED")
  const canFinalize = readyToFinalize && hasRequestNo
  const canReject = manager && lifecycleStatus === "WAITING_APPROVAL"
  const isTerminal = lifecycleStatus === "CLOSED" || lifecycleStatus === "CANCELLED"
  const assignLabel = hasAssignee ? labels.reassign : labels.assign
  const nextStepHint = workOrderPendingOwner(workOrder).labelAr

  const validation = useMemo(() => {
    const start = canStartExecution(workOrder)
    const draft = canSaveExecutionDraft(workOrder)
    const complete = canCompleteExecution(workOrder, { completionNotes: "ready" })
    return { start, draft, complete }
  }, [workOrder])

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["workOrders"] })
    await queryClient.invalidateQueries({ queryKey: ["notifications"] })
  }

  async function runAction(name: string, action: () => Promise<{ error: string | null }>) {
    if (!spmsRole || !user?.uid) {
      toast.error(labels.missingAuth)
      return
    }
    setBusyAction(name)
    try {
      const result = await action()
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(labels.saved)
      setDialog(null)
      await refresh()
    } finally {
      setBusyAction(null)
    }
  }

  const offlineDraft =
    user?.uid
      ? createOfflineExecutionDraft({
          workOrderId: workOrder.id,
          technicianUid: user.uid,
          completionNotes: workOrder.completionNotes ?? "",
        })
      : null

  return (
    <div dir={dir} className="rounded-xl border border-border/70 bg-card p-3 sm:p-4 print:hidden">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">{labels.title}</p>
          {!isTerminal ? (
            <p className="text-muted-foreground mt-0.5 text-xs">
              {labels.nextStep}: {nextStepHint}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {offlineDraft ? (
            <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground text-xs">
              {labels.offlineReady}
            </span>
          ) : null}
          <span className="text-muted-foreground text-xs">{lifecycleStatus}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:gap-2.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-10 flex-1 sm:flex-none"
          disabled={!hasAuth || !validation.start.ok || busyAction !== null}
          title={!hasAuth ? labels.missingAuth : firstReason(validation.start.errors, "")}
          onClick={() =>
            void runAction(labels.start, () =>
              startTechnicianExecution(spmsRole!, workOrder.id, user!.uid)
            )
          }
        >
          <Play className="size-4" />
          {labels.start}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-10 flex-1 sm:flex-none"
          disabled={!hasAuth || !validation.draft.ok || busyAction !== null}
          title={!hasAuth ? labels.missingAuth : firstReason(validation.draft.errors, "")}
          onClick={() => setDialog("draft")}
        >
          <FilePenLine className="size-4" />
          {labels.draft}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-10 flex-1 sm:flex-none"
          disabled={!hasAuth || !validation.complete.ok || busyAction !== null}
          title={!hasAuth ? labels.missingAuth : firstReason(validation.complete.errors, "")}
          onClick={() => setDialog("complete")}
        >
          <ClipboardCheck className="size-4" />
          {labels.complete}
        </Button>

        <Button
          type="button"
          size="sm"
          className="min-h-10 flex-1 sm:flex-none"
          disabled={!hasAuth || !canFinalize || busyAction !== null}
          title={
            !manager
              ? labels.managerOnly
              : readyToFinalize && !hasRequestNo
                ? labels.needRequestNo
                : !readyToFinalize
                  ? labels.finalizeHint
                  : undefined
          }
          onClick={() =>
            void runAction(labels.finalize, () => finalizeWorkOrder(spmsRole!, workOrder.id, user!.uid))
          }
        >
          <CheckCircle2 className="size-4" />
          {labels.finalize}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-10 flex-1 sm:flex-none"
          disabled={!hasAuth || !canReject || busyAction !== null}
          title={!manager ? labels.managerOnly : undefined}
          onClick={() => setDialog("reject")}
        >
          <XCircle className="size-4" />
          {labels.reject}
        </Button>

        <Button
          type="button"
          size="sm"
          variant={!hasAssignee && !isTerminal ? "default" : "outline"}
          className="min-h-10 flex-1 sm:flex-none"
          disabled={!hasAuth || !manager || isTerminal}
          title={!manager ? labels.managerOnly : undefined}
          onClick={() => setReassignOpen(true)}
        >
          <UserCog className="size-4" />
          {assignLabel}
        </Button>
      </div>

      {readyToFinalize && !hasRequestNo ? (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
          {labels.needRequestNo}
        </p>
      ) : null}

      <WorkOrderExecutionDialog
        workOrder={workOrder}
        open={dialog === "draft" || dialog === "complete"}
        mode={dialog === "complete" ? "complete" : "draft"}
        busy={busyAction !== null}
        onOpenChange={(open) => setDialog(open ? dialog : null)}
        onSubmit={(draft) =>
          void runAction(dialog === "complete" ? labels.complete : labels.draft, () =>
            dialog === "complete"
              ? completeTechnicianExecution(spmsRole!, {
                  workOrderId: workOrder.id,
                  technicianUid: user!.uid,
                  draft,
                })
              : saveTechnicianExecutionDraft(spmsRole!, {
                  workOrderId: workOrder.id,
                  technicianUid: user!.uid,
                  draft,
                })
          )
        }
      />

      <RejectDialog
        open={dialog === "reject"}
        labels={labels}
        busy={busyAction !== null}
        rejectionReason={rejectionReason}
        dir={dir}
        setRejectionReason={setRejectionReason}
        onOpenChange={(open) => setDialog(open ? "reject" : null)}
        onSubmit={() =>
          void runAction(labels.reject, () =>
            rejectWorkOrder(spmsRole!, {
              workOrderId: workOrder.id,
              actorUid: user!.uid,
              rejectionReason,
            })
          )
        }
      />

      <WorkOrderReassignmentDialog
        open={reassignOpen}
        onOpenChange={setReassignOpen}
        workOrder={workOrder}
        onReassigned={() => void refresh()}
        dir={dir}
      />
    </div>
  )
}

type Labels = typeof text.ar

function RejectDialog(props: {
  open: boolean
  labels: Labels
  dir: "rtl" | "ltr"
  busy: boolean
  rejectionReason: string
  setRejectionReason: (value: string) => void
  onOpenChange: (open: boolean) => void
  onSubmit: () => void
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent dir={props.dir} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{props.labels.reject}</DialogTitle>
          <DialogDescription>{props.labels.rejectionReason}</DialogDescription>
        </DialogHeader>
        <Field label={props.labels.rejectionReason}>
          <Textarea
            rows={4}
            value={props.rejectionReason}
            onChange={(event) => props.setRejectionReason(event.target.value)}
          />
        </Field>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={props.busy} onClick={() => props.onOpenChange(false)}>
            {props.labels.cancel}
          </Button>
          <Button type="button" variant="destructive" disabled={props.busy} onClick={props.onSubmit}>
            {props.labels.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
