import { config as loadDotEnv } from "dotenv"
import { resolve } from "node:path"

import type { UserRole } from "../src/models/firestore"

function patchImportMetaEnv() {
  loadDotEnv({ path: resolve(process.cwd(), ".env.local") })
  const env = process.env
  const viteEnv = {
    BASE_URL: "/",
    VITE_FIREBASE_API_KEY: env.VITE_FIREBASE_API_KEY ?? "",
    VITE_FIREBASE_AUTH_DOMAIN: env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
    VITE_FIREBASE_PROJECT_ID: env.VITE_FIREBASE_PROJECT_ID ?? "",
    VITE_FIREBASE_STORAGE_BUCKET: env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
    VITE_FIREBASE_MESSAGING_SENDER_ID: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
    VITE_FIREBASE_APP_ID: env.VITE_FIREBASE_APP_ID ?? "",
    ...(env.VITE_FIREBASE_MEASUREMENT_ID
      ? { VITE_FIREBASE_MEASUREMENT_ID: env.VITE_FIREBASE_MEASUREMENT_ID }
      : {}),
    VITE_USE_FIREBASE_EMULATORS: env.VITE_USE_FIREBASE_EMULATORS ?? "false",
    DEV: true,
    MODE: "development",
    PROD: false,
    SSR: false,
  }
  ;(import.meta as unknown as { env: Record<string, unknown> }).env = viteEnv
}

async function main() {
  patchImportMetaEnv()

  const email = process.env.SEED_EMAIL
  const password = process.env.SEED_PASSWORD
  if (!email?.trim() || !password) {
    console.error(
      "Set SEED_EMAIL and SEED_PASSWORD in environment (or append to .env.local) before npm run seed."
    )
    process.exit(1)
  }

  const { auth } = await import("../src/lib/firebase")
  const { signInWithEmailAndPassword } = await import("firebase/auth")

  await signInWithEmailAndPassword(auth, email, password)

  const uid = auth.currentUser?.uid
  if (!uid) {
    console.error("No UID after login")
    process.exit(1)
  }

  const { db } = await import("../src/lib/firebase")
  const { doc, getDoc } = await import("firebase/firestore")
  const { inferUserRoleFromEmail } = await import("../src/lib/resolve-user-role")
  const { seedSpmsFirestore } = await import("../src/services/firestore/seed")

  let role: UserRole = inferUserRoleFromEmail(email)
  const snap = await getDoc(doc(db, "users", uid))
  const snapRole = snap.data()?.role
  if (
    typeof snapRole === "string" &&
    ["admin", "manager", "technician", "requester"].includes(snapRole)
  ) {
    role = snapRole as UserRole
  }

  const result = await seedSpmsFirestore(role, uid)
  if (result.error || !result.data) {
    console.error(result.error ?? "Seed produced no paths")
    process.exit(1)
  }
  console.log("Seed OK:")
  result.data.forEach((p: string) => console.log(`  ${p}`))
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
