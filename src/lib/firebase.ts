import { initializeApp } from "firebase/app"
import { connectAuthEmulator, getAuth } from "firebase/auth"
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore"
import { connectStorageEmulator, getStorage } from "firebase/storage"

type ViteFirebaseKey =
  | "VITE_FIREBASE_API_KEY"
  | "VITE_FIREBASE_AUTH_DOMAIN"
  | "VITE_FIREBASE_PROJECT_ID"
  | "VITE_FIREBASE_STORAGE_BUCKET"
  | "VITE_FIREBASE_MESSAGING_SENDER_ID"
  | "VITE_FIREBASE_APP_ID"
  | "VITE_FIREBASE_MEASUREMENT_ID"

const requiredFirebaseKeys: ViteFirebaseKey[] = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
]

/** True when running under Node/tsx (e.g. seed script). Never touch `import.meta.env` here. */
function isNodeRuntime(): boolean {
  try {
    return (
      typeof (globalThis as { process?: { versions?: { node?: string } } }).process?.versions
        ?.node === "string"
    )
  } catch {
    return false
  }
}

function nodeEnv(key: string): string {
  try {
    const env = (
      globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }
    ).process?.env
    const value = env?.[key]
    return typeof value === "string" ? value.trim() : ""
  } catch {
    return ""
  }
}

/** Prefer `process.env` in Node seeds; otherwise Vite-provided `import.meta.env`. */
function safeFirebaseEnv(key: ViteFirebaseKey): string {
  if (isNodeRuntime()) {
    return nodeEnv(key)
  }

  try {
    switch (key) {
      case "VITE_FIREBASE_API_KEY":
        return String(import.meta.env.VITE_FIREBASE_API_KEY ?? "")
      case "VITE_FIREBASE_AUTH_DOMAIN":
        return String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "")
      case "VITE_FIREBASE_PROJECT_ID":
        return String(import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "")
      case "VITE_FIREBASE_STORAGE_BUCKET":
        return String(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "")
      case "VITE_FIREBASE_MESSAGING_SENDER_ID":
        return String(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "")
      case "VITE_FIREBASE_APP_ID":
        return String(import.meta.env.VITE_FIREBASE_APP_ID ?? "")
      case "VITE_FIREBASE_MEASUREMENT_ID":
        return String(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? "")
      default:
        return ""
    }
  } catch {
    return ""
  }
}

/**
 * DEV flag: Node reads `NODE_ENV`; Vite/browser uses `import.meta.env.DEV` safely.
 */
function isDev(): boolean {
  if (isNodeRuntime()) {
    const nodeEnvRaw = nodeEnv("NODE_ENV")
    return nodeEnvRaw === "development"
  }

  try {
    return !!(import.meta as ImportMeta).env?.DEV
  } catch {
    return false
  }
}

/**
 * Emulator wiring only runs in browser/Vite (not tsx seeds), matching prior behavior.
 */
function shouldConnectFirebaseEmulators(): boolean {
  if (isNodeRuntime() || typeof window === "undefined") return false

  try {
    const useEmu =
      String((import.meta as ImportMeta).env?.VITE_USE_FIREBASE_EMULATORS ?? "") === "true"
    return isDev() && useEmu
  } catch {
    return false
  }
}

const firebaseConfig = {
  apiKey: safeFirebaseEnv("VITE_FIREBASE_API_KEY"),
  authDomain: safeFirebaseEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: safeFirebaseEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: safeFirebaseEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: safeFirebaseEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: safeFirebaseEnv("VITE_FIREBASE_APP_ID"),
  ...(safeFirebaseEnv("VITE_FIREBASE_MEASUREMENT_ID")
    ? { measurementId: safeFirebaseEnv("VITE_FIREBASE_MEASUREMENT_ID") }
    : {}),
}

function validateFirebaseConfig(): void {
  const missing = requiredFirebaseKeys.filter((key) => !safeFirebaseEnv(key))
  if (missing.length === 0) return

  const message = `Missing Firebase environment variables: ${missing.join(", ")}`
  if (!isDev()) {
    throw new Error(message)
  }

  console.warn(message)
}

validateFirebaseConfig()

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)
const storage = getStorage(app)

if (shouldConnectFirebaseEmulators()) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true })
  connectFirestoreEmulator(db, "127.0.0.1", 8080)
  connectStorageEmulator(storage, "127.0.0.1", 9199)
}

export { app, auth, db, storage }
