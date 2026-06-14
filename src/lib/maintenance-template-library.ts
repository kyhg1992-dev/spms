import type {
  MaintenanceSequenceTemplate,
  MaintenanceServiceLevel,
} from "@/models/firestore"

export type TemplateDraft = Omit<MaintenanceSequenceTemplate, "id" | "createdAt" | "updatedAt">

/** Tasks shared by the lightest (D / Minor) Komatsu WA380-6 service. */
const WA380_MINOR: MaintenanceServiceLevel = {
  code: "D",
  nameAr: "صغرى",
  nameEn: "Minor",
  tasks: [
    { descAr: "زيت محرك 15W40", descEn: "Engine Oil 15W40 (CI4)", itemCode: "OE001TUR002D", qty: "23", action: "REPLACE" },
    { descAr: "فلتر زيت محرك", descEn: "Engine Oil Filter", itemCode: "FO002LDR006P", qty: "1", action: "REPLACE", partNo: "6736-51-5142" },
    { descAr: "مستوى الكولانت", descEn: "Coolant Level", itemCode: "CW001RAD001D", qty: "—", action: "CHECK" },
    { descAr: "فلتر هواء خارجي", descEn: "Outer Air Filter", itemCode: "FA001LDR006P", qty: "1", action: "CLEAN", partNo: "عند الحاجة" },
    { descAr: "فلتر هواء كابينة", descEn: "Cabin Air Filter", itemCode: "FC002LDR006P", qty: "1", action: "CLEAN", partNo: "426-07-32441" },
    { descAr: "زيت فرامل DOT-4", descEn: "Brake Oil DOT-4", itemCode: "OB001CAN001C", qty: "—", action: "REFILL", partNo: "عند الحاجة" },
    { descAr: "تشحيم شامل MP2", descEn: "Greasing (MP2)", itemCode: "GR001GRS001P", qty: "kg", action: "GREASE", partNo: "جميع المفاصل" },
    { descAr: "ضغط الإطارات", descEn: "Tire Pressure", qty: "—", action: "CHECK" },
  ],
}

const WA380_INTERMEDIATE: MaintenanceServiceLevel = {
  code: "C",
  nameAr: "متوسطة",
  nameEn: "Intermediate",
  tasks: [
    ...WA380_MINOR.tasks,
    { descAr: "فلتر وقود أولي", descEn: "Fuel Pre-Filter", itemCode: "FU003LDR006P", qty: "1", action: "REPLACE", partNo: "600-319-3610" },
    { descAr: "فلتر وقود رئيسي", descEn: "Fuel Main Filter", itemCode: "FU002LDR006P", qty: "1", action: "REPLACE", partNo: "600-319-3750" },
    { descAr: "فاصل الماء", descEn: "Water Separator", qty: "—", action: "DRAIN" },
  ],
}

const WA380_MAJOR: MaintenanceServiceLevel = {
  code: "B",
  nameAr: "كبيرة",
  nameEn: "Major",
  tasks: [
    ...WA380_INTERMEDIATE.tasks,
    { descAr: "فلتر هيدروليك", descEn: "Hydraulic Filter", itemCode: "FH001LDR006P", qty: "1", action: "REPLACE" },
    { descAr: "زيت ناقل الحركة", descEn: "Transmission Oil", itemCode: "OT001LDR001D", qty: "—", action: "CHECK" },
  ],
}

const WA380_COMPREHENSIVE: MaintenanceServiceLevel = {
  code: "A",
  nameAr: "شاملة",
  nameEn: "Comprehensive",
  tasks: [
    ...WA380_MAJOR.tasks,
    { descAr: "زيت هيدروليك", descEn: "Hydraulic Oil", itemCode: "OH001LDR040D", qty: "40", action: "REPLACE" },
    { descAr: "زيت ناقل الحركة (تغيير)", descEn: "Transmission Oil (change)", itemCode: "OT001LDR001D", qty: "18", action: "REPLACE" },
    { descAr: "زيت الفرق (أمامي/خلفي)", descEn: "Differential Oil (F/R)", itemCode: "OD001LDR001D", qty: "—", action: "REPLACE" },
  ],
}

/** Ready-made starter templates the manager can pick and tweak. */
export const TEMPLATE_LIBRARY: { key: string; label: string; draft: TemplateDraft }[] = [
  {
    key: "wa380-6",
    label: "رافعة كوماتسو WA380-6 (ساعات)",
    draft: {
      templateCode: "PM-WA380-6",
      name: "صيانة رافعة كوماتسو WA380-6",
      assetTypeLabel: "رافعة كوماتسو WA380-6",
      triggerMode: "hours",
      meterKind: "operating_hours",
      stepInterval: 250,
      sequence: ["D", "C", "D", "B", "D", "C", "D", "A"],
      levels: [WA380_COMPREHENSIVE, WA380_MAJOR, WA380_INTERMEDIATE, WA380_MINOR],
      isActive: true,
      description: "تسلسل D·C·D·B·D·C·D·A كل 250 ساعة، يلتفّ كل 2000 ساعة.",
    },
  },
]

/**
 * A blank template scaffold — NO preset levels. Each equipment family chooses its
 * own coding scheme (any letters), so the manager adds exactly the levels needed.
 */
export function blankTemplateDraft(): TemplateDraft {
  return {
    templateCode: "",
    name: "",
    assetTypeLabel: "",
    triggerMode: "hours",
    meterKind: "operating_hours",
    stepInterval: 250,
    sequence: [],
    levels: [],
    isActive: true,
    description: "",
  }
}

/** Optional Arabic default names for the common A/B/C/D severity scale. */
export const DEFAULT_LEVEL_NAMES: Record<string, string> = {
  A: "شاملة",
  B: "كبيرة",
  C: "متوسطة",
  D: "صغرى",
}
