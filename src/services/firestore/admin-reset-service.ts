import { collection, deleteField, getDocs, writeBatch } from "firebase/firestore"

import { db } from "@/lib/firebase"
import type { UserRole } from "@/models/firestore"

const CHUNK = 400

async function deleteAll(name: string): Promise<number> {
  const snap = await getDocs(collection(db, name))
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = writeBatch(db)
    for (const d of snap.docs.slice(i, i + CHUNK)) batch.delete(d.ref)
    await batch.commit()
  }
  return snap.docs.length
}

export type ResetCounts = {
  workOrders: number
  meterReadings: number
  notifications: number
  assets: number
}

/**
 * Wipe operational history for a clean test run: deletes all work orders, meter
 * readings and notifications, and clears each asset's rotation cursor (last service)
 * so maintenance restarts from scratch. Keeps assets, templates, users and settings.
 * Asset meter values (operatingHours/odometer) are intentionally preserved.
 * Admin only. Activity logs are immutable by design and are not touched.
 */
export async function resetOperationalData(
  role: UserRole
): Promise<{ ok: true; counts: ResetCounts } | { ok: false; error: string }> {
  if (role !== "admin") return { ok: false, error: "هذه العملية للمسؤول العام فقط" }
  try {
    const workOrders = await deleteAll("workOrders")
    const meterReadings = await deleteAll("meterReadings")
    const notifications = await deleteAll("notifications")

    const assetsSnap = await getDocs(collection(db, "assets"))
    for (let i = 0; i < assetsSnap.docs.length; i += CHUNK) {
      const batch = writeBatch(db)
      for (const d of assetsSnap.docs.slice(i, i + CHUNK)) {
        batch.update(d.ref, {
          lastServiceCode: deleteField(),
          lastServiceIndex: deleteField(),
          lastServiceReading: deleteField(),
          lastServiceAt: deleteField(),
        })
      }
      await batch.commit()
    }

    return {
      ok: true,
      counts: { workOrders, meterReadings, notifications, assets: assetsSnap.docs.length },
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
