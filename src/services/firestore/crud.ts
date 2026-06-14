import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type QueryConstraint,
} from "firebase/firestore"

import { db } from "@/lib/firebase"

type AsyncState<T> = {
  loading: boolean
  data: T | null
  error: string | null
}

type QueryWhere = {
  field: string
  op: "==" | "!=" | ">" | ">=" | "<" | "<=" | "array-contains" | "in" | "array-contains-any" | "not-in"
  value: unknown
}

type ListOptions = {
  whereClauses?: QueryWhere[]
  orderByField?: string
  orderDirection?: "asc" | "desc"
  limitCount?: number
}

const createState = <T>(): AsyncState<T> => ({
  loading: true,
  data: null,
  error: null,
})

const doneState = <T>(data: T): AsyncState<T> => ({
  loading: false,
  data,
  error: null,
})

const errorState = <T>(error: unknown): AsyncState<T> => ({
  loading: false,
  data: null,
  error: error instanceof Error ? error.message : "Unknown error",
})

/** Firestore rejects `undefined` field values; drop them before any write. */
const stripUndefined = <T extends Record<string, unknown>>(payload: T): Partial<T> =>
  Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)) as Partial<T>

const withTimestamps = <T extends Record<string, unknown>>(payload: T) => ({
  ...stripUndefined(payload),
  updatedAt: serverTimestamp(),
})

const withCreateTimestamps = <T extends Record<string, unknown>>(payload: T) => ({
  ...stripUndefined(payload),
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
})

export async function createOne<T extends DocumentData>(
  collectionName: string,
  payload: T
): Promise<AsyncState<string>> {
  const state = createState<string>()
  try {
    const ref = await addDoc(collection(db, collectionName), withCreateTimestamps(payload))
    return doneState(ref.id)
  } catch (error) {
    return errorState<string>(error)
  } finally {
    state.loading = false
  }
}

/** Create many documents fast via batched writes (≤400 per commit). */
export async function bulkCreate<T extends DocumentData>(
  collectionName: string,
  payloads: T[],
  onProgress?: (done: number, total: number) => void
): Promise<AsyncState<number>> {
  try {
    let created = 0
    for (let i = 0; i < payloads.length; i += 400) {
      const chunk = payloads.slice(i, i + 400)
      const batch = writeBatch(db)
      for (const payload of chunk) {
        batch.set(doc(collection(db, collectionName)), withCreateTimestamps(payload))
      }
      await batch.commit()
      created += chunk.length
      onProgress?.(created, payloads.length)
    }
    return doneState(created)
  } catch (error) {
    return errorState<number>(error)
  }
}

/** Delete many documents fast via batched writes (≤400 per commit). */
export async function bulkDelete(
  collectionName: string,
  ids: string[],
  onProgress?: (done: number, total: number) => void
): Promise<AsyncState<number>> {
  try {
    let removed = 0
    for (let i = 0; i < ids.length; i += 400) {
      const chunk = ids.slice(i, i + 400)
      const batch = writeBatch(db)
      for (const id of chunk) batch.delete(doc(db, collectionName, id))
      await batch.commit()
      removed += chunk.length
      onProgress?.(removed, ids.length)
    }
    return doneState(removed)
  } catch (error) {
    return errorState<number>(error)
  }
}

export async function createWithId<T extends DocumentData>(
  collectionName: string,
  id: string,
  payload: T
): Promise<AsyncState<string>> {
  const state = createState<string>()
  try {
    const ref = doc(db, collectionName, id)
    await setDoc(ref, withCreateTimestamps(payload))
    return doneState(ref.id)
  } catch (error) {
    return errorState<string>(error)
  } finally {
    state.loading = false
  }
}

export async function getOne<T extends DocumentData>(
  collectionName: string,
  id: string
): Promise<AsyncState<T & { id: string }>> {
  const state = createState<T & { id: string }>()
  try {
    const snapshot = await getDoc(doc(db, collectionName, id))
    if (!snapshot.exists()) {
      return errorState<T & { id: string }>("Document not found")
    }
    return doneState({ id: snapshot.id, ...(snapshot.data() as T) })
  } catch (error) {
    return errorState<T & { id: string }>(error)
  } finally {
    state.loading = false
  }
}

export async function listMany<T extends DocumentData>(
  collectionName: string,
  options: ListOptions = {}
): Promise<AsyncState<Array<T & { id: string }>>> {
  const state = createState<Array<T & { id: string }>>()
  try {
    const constraints: QueryConstraint[] = []

    if (options.whereClauses) {
      options.whereClauses.forEach((clause) => {
        constraints.push(where(clause.field, clause.op, clause.value))
      })
    }
    if (options.orderByField) {
      constraints.push(orderBy(options.orderByField, options.orderDirection ?? "desc"))
    }
    if (options.limitCount) {
      constraints.push(limit(options.limitCount))
    }

    const baseRef = collection(db, collectionName)
    const snapshot = constraints.length
      ? await getDocs(query(baseRef, ...constraints))
      : await getDocs(baseRef)

    return doneState(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as T) })))
  } catch (error) {
    return errorState<Array<T & { id: string }>>(error)
  } finally {
    state.loading = false
  }
}

export async function updateOne<T extends DocumentData>(
  collectionName: string,
  id: string,
  payload: Partial<T>
): Promise<AsyncState<boolean>> {
  const state = createState<boolean>()
  try {
    await updateDoc(doc(db, collectionName, id), withTimestamps(payload))
    return doneState(true)
  } catch (error) {
    return errorState<boolean>(error)
  } finally {
    state.loading = false
  }
}

export async function removeOne(collectionName: string, id: string): Promise<AsyncState<boolean>> {
  const state = createState<boolean>()
  try {
    await deleteDoc(doc(db, collectionName, id))
    return doneState(true)
  } catch (error) {
    return errorState<boolean>(error)
  } finally {
    state.loading = false
  }
}

export function docRef(collectionName: string, id: string): DocumentReference {
  return doc(db, collectionName, id)
}

export type { AsyncState, ListOptions, QueryWhere }
