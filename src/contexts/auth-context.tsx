import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { auth, db } from "@/lib/firebase"
import { inferUserRoleFromEmail } from "@/lib/resolve-user-role"
import type { SpmsUser, UserRole } from "@/models/firestore"

type AuthContextValue = {
  user: User | null
  profile: SpmsUser | null
  spmsRole: UserRole | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function mapSnapToUser(id: string, data: Record<string, unknown>): SpmsUser {
  return {
    id,
    email: String(data.email ?? ""),
    displayName: String(data.displayName ?? ""),
    role: data.role as UserRole,
    phone: data.phone !== undefined ? String(data.phone) : undefined,
    isActive: Boolean(data.isActive),
    createdAt: data.createdAt as SpmsUser["createdAt"],
    updatedAt: data.updatedAt as SpmsUser["updatedAt"],
  }
}

async function ensureUserDoc(firebaseUser: User): Promise<SpmsUser> {
  const ref = doc(db, "users", firebaseUser.uid)
  let snap = await getDoc(ref)

  if (!snap.exists()) {
    const role = inferUserRoleFromEmail(firebaseUser.email)
    const display =
      firebaseUser.displayName ??
      firebaseUser.email?.split("@")[0] ??
      firebaseUser.uid.slice(0, 8)
    await setDoc(ref, {
      email: firebaseUser.email ?? "",
      displayName: display,
      role,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    snap = await getDoc(ref)
  }

  if (!snap.exists()) {
    throw new Error("فشل إنشاء ملف المستخدم في Firestore")
  }

  return mapSnapToUser(snap.id, snap.data())
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<SpmsUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser)

      if (!nextUser) {
        setProfile(null)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const nextProfile = await ensureUserDoc(nextUser)
        setProfile(nextProfile)
      } catch {
        setProfile(null)
      } finally {
        setLoading(false)
      }
    })
    return unsub
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }, [])

  const logout = useCallback(async () => {
    await signOut(auth)
  }, [])

  const spmsRole = profile?.role ?? null

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      spmsRole,
      loading,
      login,
      logout,
    }),
    [user, profile, spmsRole, loading, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
