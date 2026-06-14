import { doc, serverTimestamp, setDoc, Timestamp } from "firebase/firestore"

import { db } from "@/lib/firebase"
import type { Asset, Notification, PMSchedule, SpmsUser, UserRole, WorkOrder } from "@/models/firestore"
import {
  createAsset,
  createNotification,
  createPMSchedule,
  createUser,
  createWorkOrder,
} from "@/services/firestore/spms-service"

export type PilotDemoUserSeed = {
  uid: string
  email: string
  displayName: string
  role: UserRole
}

export type PilotDemoSeedInput = {
  role: UserRole
  actorUid: string
  users: PilotDemoUserSeed[]
}

export type PilotDemoSeedResult = {
  createdPaths: string[]
  warnings: string[]
}

const now = Timestamp.now()
const nextWeek = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
const nextMonth = Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
const overdue = Timestamp.fromDate(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000))

export const PILOT_DEMO_USERS: PilotDemoUserSeed[] = [
  {
    uid: "replace-with-admin-uid",
    email: "admin@pilot.spms.local",
    displayName: "Pilot Admin / مسؤول التجربة",
    role: "admin",
  },
  {
    uid: "replace-with-manager-uid",
    email: "manager@pilot.spms.local",
    displayName: "Workshop Manager / مدير الورشة",
    role: "manager",
  },
  {
    uid: "replace-with-technician-uid-1",
    email: "tech1@pilot.spms.local",
    displayName: "Mechanical Technician / فني ميكانيكا",
    role: "technician",
  },
  {
    uid: "replace-with-technician-uid-2",
    email: "tech2@pilot.spms.local",
    displayName: "Electrical Technician / فني كهرباء",
    role: "technician",
  },
]

function demoAssets(): Array<Omit<Asset, "id" | "createdAt" | "updatedAt">> {
  return [
    {
      assetCode: "PILOT-FLT-01",
      assetName: "Forklift 3 Ton / رافعة شوكية 3 طن",
      category: "mechanical",
      brand: "Toyota",
      model: "8FG30",
      serialNo: "PILOT-FLT-0001",
      plateNo: "Pilot 101",
      department: "Heavy Equipment Workshop / ورشة المعدات الثقيلة",
      location: "North Warehouse / مستودع الشمال",
      operatingHours: 4280,
      odometer: 12600,
      status: "active",
      notes: "Daily material handling asset for pilot validation.",
      imageUrl: "",
    },
    {
      assetCode: "PILOT-GEN-01",
      assetName: "Standby Generator 800 kVA / مولد احتياطي 800 ك.ف.أ",
      category: "electrical",
      brand: "Caterpillar",
      model: "C18",
      serialNo: "PILOT-GEN-0001",
      plateNo: "-",
      department: "Utilities / الخدمات",
      location: "Service Building / مبنى الخدمات",
      operatingHours: 9360,
      odometer: 0,
      status: "maintenance",
      notes: "Use for overdue PM and approval flow validation.",
      imageUrl: "",
    },
    {
      assetCode: "PILOT-TRK-01",
      assetName: "Service Truck / شاحنة خدمة",
      category: "fleet",
      brand: "Isuzu",
      model: "NPR",
      serialNo: "PILOT-TRK-0001",
      plateNo: "Pilot 302",
      department: "Mobile Maintenance / الصيانة المتنقلة",
      location: "Workshop Yard / ساحة الورشة",
      operatingHours: 3100,
      odometer: 88400,
      status: "active",
      notes: "Vehicle-based kilometer PM validation.",
      imageUrl: "",
    },
  ]
}

function demoPM(assetIds: Record<string, string>): Array<Omit<PMSchedule, "id" | "createdAt" | "updatedAt">> {
  return [
    {
      assetId: assetIds["PILOT-FLT-01"],
      title: "A Service - Forklift lubrication / خدمة A - تزييت الرافعة",
      serviceType: "A",
      triggerMode: "hours",
      frequencyDays: 14,
      nextRunAt: nextWeek,
      isActive: true,
      meterHoursInterval: 200,
      autoCreateWorkOrder: true,
      templateCode: "PILOT-PM-FLT-A",
    },
    {
      assetId: assetIds["PILOT-GEN-01"],
      title: "B Service - Generator readiness / خدمة B - جاهزية المولد",
      serviceType: "B",
      triggerMode: "both",
      frequencyDays: 15,
      nextRunAt: overdue,
      lastRunAt: now,
      isActive: true,
      meterHoursInterval: 250,
      autoCreateWorkOrder: true,
      templateCode: "PILOT-PM-GEN-B",
    },
    {
      assetId: assetIds["PILOT-TRK-01"],
      title: "Fleet PM - Tire and axle check / فحص الإطارات والمحاور",
      serviceType: "B",
      triggerMode: "km",
      frequencyDays: 30,
      nextRunAt: nextMonth,
      isActive: true,
      meterKmInterval: 10000,
      autoCreateWorkOrder: false,
      templateCode: "PILOT-PM-TRK-KM",
    },
  ]
}

export function buildPilotDemoResetPlan(createdPaths: string[]): string[] {
  return [...createdPaths].sort().reverse()
}

export async function seedPilotDemoData(input: PilotDemoSeedInput): Promise<PilotDemoSeedResult> {
  const createdPaths: string[] = []
  const warnings: string[] = []

  if (input.role !== "admin" && input.role !== "manager") {
    throw new Error("Pilot demo seed requires admin or manager role.")
  }

  await setDoc(
    doc(db, "companySettings", "main"),
    {
      docKey: "main",
      companyNameAr: "منشأة تجربة SPMS",
      timezone: "Asia/Riyadh",
      locale: "ar-SA",
      defaultPmReminderDays: 7,
      meterAnomalyPct: 30,
      weekendDays: [5, 6],
      officialHolidays: [],
      shutdownPeriods: [],
      quietHours: { start: "22:00", end: "06:00" },
      workshopOperatingHours: { start: "07:00", end: "17:00" },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
  createdPaths.push("companySettings/main")

  for (const user of input.users) {
    if (user.uid.startsWith("replace-with-")) {
      warnings.push(`Skipped placeholder user ${user.email}; replace uid before pilot seed.`)
      continue
    }
    const payload: Omit<SpmsUser, "id" | "createdAt" | "updatedAt"> = {
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      isActive: true,
    }
    const result = await createUser(input.role, user.uid, payload)
    if (result.error) warnings.push(`User ${user.email}: ${result.error}`)
    else createdPaths.push(`users/${user.uid}`)
  }

  const assetIds: Record<string, string> = {}
  for (const asset of demoAssets()) {
    const result = await createAsset(input.role, asset)
    if (result.error || !result.data) throw new Error(result.error ?? "Asset seed failed")
    assetIds[asset.assetCode] = result.data
    createdPaths.push(`assets/${result.data}`)
  }

  const pmIds: string[] = []
  for (const schedule of demoPM(assetIds)) {
    const result = await createPMSchedule(input.role, schedule)
    if (result.error || !result.data) throw new Error(result.error ?? "PM seed failed")
    pmIds.push(result.data)
    createdPaths.push(`pmSchedules/${result.data}`)
  }

  const managerUid = input.users.find((user) => user.role === "manager" && !user.uid.startsWith("replace-with-"))?.uid ?? input.actorUid
  const techUid = input.users.find((user) => user.role === "technician" && !user.uid.startsWith("replace-with-"))?.uid

  const workOrders: Array<Omit<WorkOrder, "id" | "createdAt" | "updatedAt">> = [
    {
      title: "Generator inspection after alarm / فحص المولد بعد إنذار",
      description: "Validate oil pressure, coolant level, battery charger, and load transfer readiness.",
      assetId: assetIds["PILOT-GEN-01"],
      requesterId: managerUid,
      assignedTo: techUid,
      assigneeId: techUid,
      status: techUid ? "assigned" : "open",
      lifecycleStatus: techUid ? "ASSIGNED" : "OPEN",
      priority: "high",
      dueDate: nextWeek,
      approvalRequired: true,
      pmScheduleId: pmIds[1],
      sourceType: "PM",
      sourceRef: `pmSchedules/${pmIds[1]}`,
    },
    {
      title: "Forklift hydraulic leak check / فحص تهريب هيدروليك الرافعة",
      description: "Inspect visible hoses, cylinder seals, and record operating hours.",
      assetId: assetIds["PILOT-FLT-01"],
      requesterId: managerUid,
      assignedTo: techUid,
      assigneeId: techUid,
      status: techUid ? "in_progress" : "open",
      lifecycleStatus: techUid ? "IN_PROGRESS" : "OPEN",
      priority: "medium",
      dueDate: nextWeek,
      approvalRequired: false,
    },
  ]

  for (const workOrder of workOrders) {
    const result = await createWorkOrder(input.role, workOrder)
    if (result.error || !result.data) throw new Error(result.error ?? "Work order seed failed")
    createdPaths.push(`workOrders/${result.data}`)
  }

  const notifications: Array<Omit<Notification, "id" | "createdAt" | "updatedAt">> = [
    {
      userId: managerUid,
      type: "pm_schedule",
      channel: "in_app",
      priority: "high",
      title: "Pilot PM overdue / صيانة وقائية متأخرة",
      body: "Generator readiness PM is overdue and should generate a work order during pilot validation.",
      isRead: false,
      isArchived: false,
      refPath: `pmSchedules/${pmIds[1]}`,
    },
  ]

  for (const notification of notifications) {
    const result = await createNotification(input.role, notification)
    if (result.error || !result.data) throw new Error(result.error ?? "Notification seed failed")
    createdPaths.push(`notifications/${result.data}`)
  }

  return { createdPaths, warnings }
}
