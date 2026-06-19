import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  type DocumentData,
} from "firebase/firestore"

import { db } from "@/lib/firebase"
import type { Announcement, AnnouncementPriority, UserRole } from "@/models/firestore"

function isManager(role: UserRole): boolean {
  return role === "admin" || role === "manager"
}

function asTimestamp(v: unknown): Timestamp {
  return v && typeof (v as Timestamp).toMillis === "function" ? (v as Timestamp) : Timestamp.now()
}

function normalize(id: string, d: DocumentData): Announcement & { id: string } {
  const priority = d.priority
  return {
    id,
    title: typeof d.title === "string" ? d.title : "",
    body: typeof d.body === "string" ? d.body : "",
    priority: (["normal", "important", "urgent"].includes(priority) ? priority : "normal") as AnnouncementPriority,
    createdByUid: typeof d.createdByUid === "string" ? d.createdByUid : "",
    createdAt: asTimestamp(d.createdAt),
    updatedAt: asTimestamp(d.updatedAt),
  }
}

export async function listAnnouncements(): Promise<(Announcement & { id: string })[]> {
  const snap = await getDocs(
    query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(30))
  )
  return snap.docs.map((d) => normalize(d.id, d.data()))
}

export async function createAnnouncement(
  role: UserRole,
  input: { title: string; body: string; priority: AnnouncementPriority; createdByUid: string }
): Promise<{ error: string | null }> {
  if (!isManager(role)) return { error: "النشر متاح للمدير أو المسؤول فقط" }
  if (!input.title.trim()) return { error: "العنوان مطلوب" }
  try {
    await addDoc(collection(db, "announcements"), {
      title: input.title.trim(),
      body: input.body.trim(),
      priority: input.priority,
      createdByUid: input.createdByUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return { error: null }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "تعذّر نشر الإعلان" }
  }
}

export async function deleteAnnouncement(role: UserRole, id: string): Promise<{ error: string | null }> {
  if (!isManager(role)) return { error: "الحذف متاح للمدير أو المسؤول فقط" }
  try {
    await deleteDoc(doc(db, "announcements", id))
    return { error: null }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "تعذّر حذف الإعلان" }
  }
}
