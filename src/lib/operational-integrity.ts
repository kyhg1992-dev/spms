import type { MeterReading, PMSchedule, WorkOrder } from "@/models/firestore"
import { getWorkOrderLifecycleStatus } from "@/lib/work-order-lifecycle"

export type IntegrityCheck = {
  ok: boolean
  code: string
  message: string
  messageAr: string
}

export function okIntegrity(): IntegrityCheck {
  return { ok: true, code: "OK", message: "OK", messageAr: "سليم" }
}

function failed(code: string, message: string, messageAr: string): IntegrityCheck {
  return { ok: false, code, message, messageAr }
}

export function validateNoOpenPMDuplicate(input: {
  existingWorkOrder?: WorkOrder | null
}): IntegrityCheck {
  if (!input.existingWorkOrder) return okIntegrity()
  return failed(
    "PM_DUPLICATE_WORK_ORDER",
    "An open work order already exists for this PM schedule.",
    "يوجد أمر عمل مفتوح مسبقا لهذه الصيانة الوقائية."
  )
}

export function validatePMWorkOrderLink(input: {
  schedule: PMSchedule
  workOrder: WorkOrder
}): IntegrityCheck {
  if (input.workOrder.pmScheduleId && input.workOrder.pmScheduleId !== input.schedule.id) {
    return failed(
      "PM_LINK_MISMATCH",
      "Work order is linked to a different PM schedule.",
      "أمر العمل مرتبط بخطة صيانة وقائية مختلفة."
    )
  }
  if (input.workOrder.assetId !== input.schedule.assetId) {
    return failed(
      "PM_ASSET_MISMATCH",
      "Work order asset does not match PM schedule asset.",
      "الأصل في أمر العمل لا يطابق أصل خطة الصيانة الوقائية."
    )
  }
  return okIntegrity()
}

export function validateNoDuplicateExecutionCompletion(workOrder: WorkOrder): IntegrityCheck {
  const status = getWorkOrderLifecycleStatus(workOrder)
  if (workOrder.executionCompletedAt || status === "COMPLETED" || status === "CLOSED") {
    return failed(
      "EXECUTION_ALREADY_COMPLETED",
      "Execution has already been completed for this work order.",
      "تم إكمال تنفيذ أمر العمل مسبقا."
    )
  }
  return okIntegrity()
}

export function validateApprovalNotOrphaned(workOrder: WorkOrder): IntegrityCheck {
  if (workOrder.approvedAt && !workOrder.approvedByUid) {
    return failed("ORPHAN_APPROVAL", "Approved work order is missing approver uid.", "الاعتماد بلا معرف معتمد.")
  }
  if (workOrder.rejectedAt && !workOrder.rejectedByUid) {
    return failed("ORPHAN_REJECTION", "Rejected work order is missing rejector uid.", "الرفض بلا معرف رافض.")
  }
  return okIntegrity()
}

export function validateDelegationConsistency(workOrder: WorkOrder): IntegrityCheck {
  if (!workOrder.delegationStatus) return okIntegrity()
  if (!workOrder.delegatedFrom || !workOrder.delegatedTo || !workOrder.delegatedBy) {
    return failed(
      "INCOMPLETE_DELEGATION",
      "Delegated work order is missing delegation parties.",
      "أمر العمل المفوض يفتقد أطراف التفويض."
    )
  }
  return okIntegrity()
}

export function validateMeterProgression(input: {
  previous?: MeterReading | null
  nextValue: number
}): IntegrityCheck {
  if (typeof input.previous?.value !== "number") return okIntegrity()
  if (input.nextValue < input.previous.value) {
    return failed(
      "METER_ROLLBACK",
      "Meter reading cannot be lower than the latest accepted reading.",
      "لا يمكن أن تكون قراءة العداد أقل من آخر قراءة معتمدة."
    )
  }
  return okIntegrity()
}

export function assertIntegrity(check: IntegrityCheck): void {
  if (!check.ok) throw new Error(check.message)
}
