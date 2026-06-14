import { config as loadDotEnv } from "dotenv"
import { resolve } from "node:path"

import type { PilotDemoUserSeed } from "../src/services/firestore/pilot-demo-seed"
import type { UserRole } from "../src/models/firestore"

function patchImportMetaEnv() {
  loadDotEnv({ path: resolve(process.cwd(), ".env.local") })
  const env = process.env
  ;(import.meta as unknown as { env: Record<string, unknown> }).env = {
    BASE_URL: "/",
    VITE_FIREBASE_API_KEY: env.VITE_FIREBASE_API_KEY ?? "",
    VITE_FIREBASE_AUTH_DOMAIN: env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
    VITE_FIREBASE_PROJECT_ID: env.VITE_FIREBASE_PROJECT_ID ?? "",
    VITE_FIREBASE_STORAGE_BUCKET: env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
    VITE_FIREBASE_MESSAGING_SENDER_ID: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
    VITE_FIREBASE_APP_ID: env.VITE_FIREBASE_APP_ID ?? "",
    VITE_FIREBASE_MEASUREMENT_ID: env.VITE_FIREBASE_MEASUREMENT_ID ?? "",
    VITE_USE_FIREBASE_EMULATORS: env.VITE_USE_FIREBASE_EMULATORS ?? "false",
    DEV: true,
    MODE: "development",
    PROD: false,
    SSR: false,
  }
}

function pilotUsersFromEnv(): PilotDemoUserSeed[] {
  const raw = process.env.PILOT_USERS_JSON
  if (!raw?.trim()) return []
  const parsed = JSON.parse(raw) as PilotDemoUserSeed[]
  return parsed.filter((user) => user.uid && user.email && user.displayName && user.role)
}

async function main() {
  patchImportMetaEnv()
  const email = process.env.SEED_EMAIL
  const password = process.env.SEED_PASSWORD
  if (!email?.trim() || !password) {
    throw new Error("Set SEED_EMAIL and SEED_PASSWORD before running pilot seed.")
  }

  const { auth } = await import("../src/lib/firebase")
  const { signInWithEmailAndPassword } = await import("firebase/auth")
  await signInWithEmailAndPassword(auth, email, password)

  const actorUid = auth.currentUser?.uid
  if (!actorUid) throw new Error("No UID after login.")

  const { db } = await import("../src/lib/firebase")
  const { doc, getDoc } = await import("firebase/firestore")
  const snap = await getDoc(doc(db, "users", actorUid))
  const role = (snap.data()?.role ?? "admin") as UserRole

  const { PILOT_DEMO_USERS, seedPilotDemoData, buildPilotDemoResetPlan } = await import(
    "../src/services/firestore/pilot-demo-seed"
  )
  const users = pilotUsersFromEnv()
  const result = await seedPilotDemoData({
    role,
    actorUid,
    users: users.length ? users : PILOT_DEMO_USERS,
  })

  console.log("Pilot seed complete.")
  result.createdPaths.forEach((path) => console.log(`  ${path}`))
  if (result.warnings.length) {
    console.log("Warnings:")
    result.warnings.forEach((warning) => console.log(`  ${warning}`))
  }
  console.log("Reset order plan:")
  buildPilotDemoResetPlan(result.createdPaths).forEach((path) => console.log(`  ${path}`))
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
