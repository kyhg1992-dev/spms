import { doc, setDoc, Timestamp } from "firebase/firestore"

import { db } from "@/lib/firebase"
import type { Asset, Notification, PMSchedule, UserRole, WorkOrder } from "@/models/firestore"
import {
  createAsset,
  createMaintenanceTemplate,
  createMeterReading,
  createNotification,
  createPMSchedule,
  createWorkOrder,
} from "@/services/firestore/spms-service"

type SeedResult = {
  loading: boolean
  data: string[] | null
  error: string | null
}

const now = Timestamp.now()
const inSevenDays = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
const inFourteenDays = Timestamp.fromDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000))
const overdue = Timestamp.fromDate(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000))
const thirtyDaysAhead = Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))

const assetSeedBase = (): Omit<Asset, "id" | "createdAt" | "updatedAt"> => ({
  assetCode: "",
  assetName: "",
  category: "mechanical",
  brand: "",
  model: "",
  serialNo: "",
  plateNo: "",
  department: "ورش المعدات الثقيلة",
  location: "",
  operatingHours: 0,
  odometer: 0,
  status: "active",
  notes: "",
  imageUrl: "",
})

const seedAssets: Array<Omit<Asset, "id" | "createdAt" | "updatedAt">> = [
  {
    ...assetSeedBase(),
    assetCode: "FLT-8042",
    assetName: "رافعة شوكية كوماتسو ٣ طن",
    category: "mechanical",
    brand: "Komatsu",
    model: "FG30HT-17",
    serialNo: "KMT-FG-88421",
    plateNo: "Riy 8042",
    location: "مستودع الشمال · الرياض",
    operatingHours: 4820,
    odometer: 12840,
    status: "active",
    vendorName: "وكالة التجهيزات المتقدمة",
    purchaseDate: now,
    warrantyExpiry: thirtyDaysAhead,
    documentsMeta: "دليل التشغيل رقم FLT-8042 · محفوظ في الأرشفة الرقمية",
    sparePartsNote: "فلاتر زيت · شمعات احتراق · خراطيم هيدروليك احتياطي",
    notes: "يشغّل مناوبتين؛ يُفحص الأسبوعي للهيدروليك قبل نوبات الذروة.",
    imageUrl: "",
    installedAt: now,
    lastServiceAt: now,
  },
  {
    ...assetSeedBase(),
    assetCode: "TRK-1903",
    assetName: "شاحنات نقل ثقيلة · مرسيدس أكسل",
    category: "fleet",
    brand: "Mercedes-Benz",
    model: "Actros 4148",
    serialNo: "MB-ACTROS-99321",
    plateNo: "Riy AB 903",
    location: "قاعدة النقل · الخرج",
    operatingHours: 6200,
    odometer: 198442,
    status: "active",
    vendorName: "الخياط للشاحنات",
    purchaseDate: now,
    warrantyExpiry: undefined,
    documentsMeta: "عقد ضمان شامل حتى سنة ٢٠٢٧",
    notes: "",
    imageUrl: "",
  },
  {
    ...assetSeedBase(),
    assetCode: "GEN-2200",
    assetName: "مولّد احتياطي كاتربلر ‎٢٠٠٠ كيفي",
    category: "electrical",
    brand: "Caterpillar",
    model: "C18",
    serialNo: "CAT-GEN-22001",
    plateNo: "—",
    location: "مبنى الخدمات · محطة المعالجة",
    operatingHours: 15310,
    odometer: 0,
    status: "maintenance",
    vendorName: "بترول إنرجي",
    purchaseDate: now,
    warrantyExpiry: overdue,
    documentsMeta: "سجل تجارب تحميل · إصدار شهر ٣ / ٢٠٢٦",
    sparePartsNote: "عبوة زيت مشحّم CAT 365-8396",
    notes: "اختبار تحميل مؤجّل بسبب أمر عمل مفتوح.",
    imageUrl: "",
    lastServiceAt: now,
  },
  {
    ...assetSeedBase(),
    assetCode: "CH-771",
    assetName: "وحدة تبريد صناعية",
    category: "hvac",
    brand: "Trane",
    model: "RTHD Series",
    serialNo: "TR-CH-99440",
    plateNo: "—",
    location: "المرافق المركزية",
    department: "الخدمات الهندسية",
    operatingHours: 22120,
    odometer: 0,
    status: "active",
    vendorName: "فارس للتكييف",
    purchaseDate: now,
    warrantyExpiry: thirtyDaysAhead,
    notes: "مزودة بتقنية تجميع بيانات اهتزاز.",
    imageUrl: "",
    installedAt: now,
    lastServiceAt: now,
  },
  {
    ...assetSeedBase(),
    assetCode: "HVY-557",
    assetName: "حفارة كارتربلر CAT 349F",
    category: "mechanical",
    brand: "CAT",
    model: "349F L",
    serialNo: "CAT-HVY-77412",
    plateNo: "Riy HZ 771",
    location: "موقع التوسعة الشمالية",
    operatingHours: 9100,
    odometer: 45000,
    status: "active",
    vendorName: "بن هادي للمعدات الثقيلة",
    purchaseDate: now,
    sparePartsNote: "سائل هيدروليك · قطع أسنان دلاء",
    notes: "",
    imageUrl: "",
  },
]

export async function seedSpmsFirestore(role: UserRole, currentUserUid: string): Promise<SeedResult> {
  const created: string[] = []
  try {
    if (role === "admin" || role === "manager") {
      try {
        await setDoc(
          doc(db, "companySettings", "main"),
          {
            docKey: "main",
            companyNameAr: "مؤسسة صيانة المعدات الذكية",
            timezone: "Asia/Riyadh",
            locale: "ar-SA",
            defaultPmReminderDays: 10,
            meterAnomalyPct: 35,
            maintenanceAnnualBudget: 4_250_000,
            updatedAt: now,
          },
          { merge: true }
        )
        created.push("companySettings/main")
      } catch {
        // Ignore rule mismatch in restrictive environments.
      }
    }

    const assetIdByCode = new Map<string, string>()

    for (const asset of seedAssets) {
      const result = await createAsset(role, asset)
      if (result.error) throw new Error(result.error)
      if (result.data) {
        assetIdByCode.set(asset.assetCode, result.data)
        created.push(`assets/${result.data}`)
      }
    }

    const chillerId = assetIdByCode.get("CH-771")
    const genId = assetIdByCode.get("GEN-2200")
    const forkliftId = assetIdByCode.get("FLT-8042")
    if (!chillerId || !genId || !forkliftId) throw new Error("Missing seeded asset linkage")

    const seedWorkOrders: Array<Omit<WorkOrder, "id" | "createdAt" | "updatedAt">> = [
      {
        title: "فحص اهتزاز كومبريسور وحدة التبريد CH-771",
        description:
          "تسجيل قيم الاهتزاز، فحص تسريبات، إعادة ملء الزيت وفق دليل المصنّع.",
        assetId: chillerId,
        requesterId: currentUserUid,
        assigneeId: currentUserUid,
        status: "in_progress",
        priority: "critical",
        dueDate: inSevenDays,
        laborHours: 3.5,
        downtimeMinutes: 120,
        internalNotes: "الفريق الثاني في انتظار رفع المعدات.",
      },
      {
        title: "اختبار تحميل جزئي للمولّد GEN-2200",
        description: "تشغيل غير متزامن، قياس THD، تأكيد وقود الطوارئ.",
        assetId: genId,
        requesterId: currentUserUid,
        assigneeId: currentUserUid,
        status: "waiting_parts",
        priority: "high",
        dueDate: overdue,
        downtimeMinutes: 480,
        internalNotes: "بانتظار وصول لبّاب تبريد.",
        estimatedCost: 8200,
      },
      {
        title: "خدمة وقتية لوحدة الهيدروليك رافعة FLT-8042",
        description: "تصريف وفحص مانومتر الاسطوانة الأمامية.",
        assetId: forkliftId,
        requesterId: currentUserUid,
        status: "assigned",
        priority: "medium",
        dueDate: inFourteenDays,
        laborHours: 1,
      },
    ]

    let workOrderPrimary = ""
    for (const wo of seedWorkOrders) {
      const res = await createWorkOrder(role, wo)
      if (res.error) throw new Error(res.error)
      if (res.data) {
        created.push(`workOrders/${res.data}`)
        if (!workOrderPrimary) workOrderPrimary = res.data
      }
    }

    /** A/B/C/D maintenance sequence template for the forklift (hours-driven). */
    let forkliftTemplateId = ""
    const templateRes = await createMaintenanceTemplate(role, {
      templateCode: "PM-FLT-SEQ",
      name: "تسلسل صيانة الرافعة الشوكية A→A→B→A→C",
      sequence: ["A", "A", "B", "A", "C"],
      stepInterval: 200,
      meterKind: "operating_hours",
      isActive: true,
      description: "كل 200 ساعة تشغيل تتقدّم الخدمة خطوة واحدة في التسلسل ثم يلتفّ.",
    })
    if (templateRes.error) throw new Error(templateRes.error)
    if (templateRes.data) {
      forkliftTemplateId = templateRes.data
      created.push(`maintenanceTemplates/${templateRes.data}`)
    }

    const seedPM: Array<Omit<PMSchedule, "id" | "createdAt" | "updatedAt">> = [
      {
        assetId: chillerId,
        title: "صيانة نوعية C — لفّات وفلاتر وحدة التبريد",
        frequencyDays: 90,
        nextRunAt: thirtyDaysAhead,
        lastRunAt: now,
        isActive: true,
        serviceType: "C",
        triggerMode: "time",
        autoCreateWorkOrder: true,
        templateCode: "PM-CH-C-90",
      },
      {
        assetId: genId,
        title: "فحص نصف شهري — جاهزية المولّد",
        frequencyDays: 15,
        nextRunAt: overdue,
        lastRunAt: now,
        isActive: true,
        serviceType: "B",
        triggerMode: "both",
        meterHoursInterval: 250,
        autoCreateWorkOrder: false,
        templateCode: "PM-GEN-B-15",
      },
      {
        assetId: forkliftId,
        title: "تزييت عجلات وقياس ضغط هيدروليك",
        frequencyDays: 7,
        nextRunAt: inSevenDays,
        isActive: true,
        serviceType: "A",
        triggerMode: "hours",
        meterHoursInterval: 200,
        ...(forkliftTemplateId ? { maintenanceTemplateId: forkliftTemplateId } : {}),
        lastServiceReading: 4820,
      },
    ]

    const truckIdResolved = assetIdByCode.get("TRK-1903")
    if (truckIdResolved) {
      seedPM.push({
        assetId: truckIdResolved,
        title: "تدوير مطاط وفحص محاور قبل الرحلات الطويلة",
        frequencyDays: 14,
        nextRunAt: inFourteenDays,
        lastRunAt: now,
        isActive: true,
        serviceType: "B",
        triggerMode: "km",
        meterKmInterval: 15000,
        autoCreateWorkOrder: true,
        templateCode: "PM-FLT-KM-B",
      })
    }

    for (const pm of seedPM.filter((row) => row.assetId)) {
      const pmRes = await createPMSchedule(role, pm)
      if (pmRes.error) throw new Error(pmRes.error)
      if (pmRes.data) created.push(`pmSchedules/${pmRes.data}`)
    }

    /** Meter history samples */
    let prevHours = seedAssets.find((a) => a.assetCode === "FLT-8042")?.operatingHours ?? 0
    for (let i = 0; i < 3; i += 1) {
      prevHours -= 210
      const mr = await createMeterReading(role, {
        assetId: forkliftId,
        kind: "operating_hours",
        value: Math.max(4200, prevHours),
        deltaFromPrevious: 210,
        note: `قراءة تجريبية تلقائيّة (${String(i)})`,
        enteredByUid: currentUserUid,
      })
      if (mr.error && !mr.data) continue
      if (mr.data) created.push(`meterReadings/${mr.data}`)
    }

    if (truckIdResolved) {
      let prevKm = seedAssets.find((a) => a.assetCode === "TRK-1903")?.odometer ?? 0
      for (let i = 0; i < 2; i += 1) {
        prevKm -= 8200
        const mrKm = await createMeterReading(role, {
          assetId: truckIdResolved,
          kind: "odometer",
          value: Math.max(180000, prevKm),
          deltaFromPrevious: 8200,
          enteredByUid: currentUserUid,
        })
        if (mrKm.data) created.push(`meterReadings/${mrKm.data}`)
      }
    }

    const seedNotifications: Array<Omit<Notification, "id" | "createdAt" | "updatedAt">> = [
      {
        userId: currentUserUid,
        type: "work_order",
        channel: "in_app",
        priority: "critical",
        title: "أمر تشغيل فوري",
        body: "الوحدة CH-771 تتطلّب فريقًا معتمدًا خلال اليوم الحالي.",
        isRead: false,
        refPath: workOrderPrimary ? `workOrders/${workOrderPrimary}` : undefined,
      },
      {
        userId: currentUserUid,
        type: "pm_schedule",
        channel: "in_app",
        priority: "high",
        title: "صيانة وقائية متأخرة",
        body: "المولّد GEN-2200 متجاوز تاريخ الموعد وفق مخطّط النصف شهري.",
        isRead: false,
      },
    ]

    for (const notification of seedNotifications) {
      const n = await createNotification(role, notification)
      if (n.error) throw new Error(n.error)
      if (n.data) created.push(`notifications/${n.data}`)
    }

    return { loading: false, data: created, error: null }
  } catch (error) {
    return {
      loading: false,
      data: null,
      error: error instanceof Error ? error.message : "Seed failed",
    }
  }
}
