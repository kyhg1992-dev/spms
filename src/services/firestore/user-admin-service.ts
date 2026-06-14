import { deleteApp, initializeApp } from "firebase/app"
import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
  updateProfile,
} from "firebase/auth"
import { doc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore"

import type { UserRole } from "@/models/firestore"

/**
 * Admin user provisioning.
 *
 * Creating a Firebase Auth account via the primary SDK instance would replace the
 * admin's own session. To avoid that we spin up a SHORT-LIVED secondary Firebase
 * app: it creates the auth account, writes the new user's Firestore profile while
 * authenticated AS that new user (so Firestore rules `request.auth.uid == userId`
 * permit the self-create), signs out, and is torn down — leaving the admin's
 * primary session completely untouched.
 */

type CreateUserInput = {
  email: string
  password: string
  displayName: string
  role: UserRole
  phone?: string
  departmentId?: string
  specialization?: string
  isActive?: boolean
}

type CreateUserResult = { ok: true; uid: string } | { ok: false; error: string }

let secondaryCounter = 0

function readFirebaseConfig() {
  const env = import.meta.env
  return {
    apiKey: String(env.VITE_FIREBASE_API_KEY ?? ""),
    authDomain: String(env.VITE_FIREBASE_AUTH_DOMAIN ?? ""),
    projectId: String(env.VITE_FIREBASE_PROJECT_ID ?? ""),
    storageBucket: String(env.VITE_FIREBASE_STORAGE_BUCKET ?? ""),
    messagingSenderId: String(env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? ""),
    appId: String(env.VITE_FIREBASE_APP_ID ?? ""),
  }
}

function stripUndefined<T extends Record<string, unknown>>(payload: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  ) as Partial<T>
}

function authErrorToArabic(code: string): string {
  switch (code) {
    case "auth/email-already-in-use":
      return "البريد الإلكتروني مستخدم بالفعل"
    case "auth/invalid-email":
      return "صيغة البريد الإلكتروني غير صحيحة"
    case "auth/weak-password":
      return "كلمة المرور ضعيفة (٦ أحرف على الأقل)"
    case "auth/operation-not-allowed":
      return "تسجيل الدخول بالبريد/كلمة المرور غير مُفعّل في المشروع"
    default:
      return "تعذّر إنشاء المستخدم"
  }
}

export async function createUserWithProfile(input: CreateUserInput): Promise<CreateUserResult> {
  secondaryCounter += 1
  const appName = `user-admin-${secondaryCounter}`
  const secondary = initializeApp(readFirebaseConfig(), appName)

  try {
    const secondaryAuth = getAuth(secondary)
    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      input.email.trim(),
      input.password
    )

    if (input.displayName.trim()) {
      await updateProfile(cred.user, { displayName: input.displayName.trim() })
    }

    const secondaryDb = getFirestore(secondary)
    await setDoc(
      doc(secondaryDb, "users", cred.user.uid),
      stripUndefined({
        email: input.email.trim(),
        displayName: input.displayName.trim(),
        role: input.role,
        phone: input.phone?.trim() || undefined,
        departmentId: input.departmentId?.trim() || undefined,
        specialization: input.specialization?.trim() || undefined,
        isActive: input.isActive ?? true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    )

    await signOut(secondaryAuth)
    return { ok: true, uid: cred.user.uid }
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error ? String((error as { code: string }).code) : ""
    return { ok: false, error: code ? authErrorToArabic(code) : "تعذّر إنشاء المستخدم" }
  } finally {
    await deleteApp(secondary).catch(() => undefined)
  }
}
