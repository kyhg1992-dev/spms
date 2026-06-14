import { addDoc, collection, serverTimestamp } from "firebase/firestore"

import { db } from "@/lib/firebase"

export async function appendActivityLog(input: {
  actorUid: string
  actionKey: string
  entityType: string
  entityId: string
  labelAr: string
}): Promise<void> {
  try {
    await addDoc(collection(db, "activityLogs"), {
      ...input,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  } catch {
    // non-blocking auditing
  }
}
