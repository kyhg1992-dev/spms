import { collection, getDocs, query, where } from "firebase/firestore"

import { db } from "@/lib/firebase"

/**
 * True when another work order already uses this reference (CAM) request number.
 * Used to keep the reference number unique. `excludeId` is the current WO.
 */
export async function requestNoTaken(no: string, excludeId: string): Promise<boolean> {
  const trimmed = no.trim()
  if (!trimmed) return false
  const snap = await getDocs(query(collection(db, "workOrders"), where("externalRequestNo", "==", trimmed)))
  return snap.docs.some((d) => d.id !== excludeId)
}
