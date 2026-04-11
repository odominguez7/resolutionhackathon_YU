import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { auth, onAuthStateChanged, signInWithGoogle, signInWithApple, signOut, getToken, type User } from "@/lib/firebase";
import { api } from "@/lib/api";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  profile: any | null;
  onboarded: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null, loading: true, profile: null, onboarded: false,
  loginWithGoogle: async () => {}, loginWithApple: async () => {},
  logout: async () => {}, refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  const loadProfile = async (uid: string) => {
    try {
      const p = await api.get(`/api/identity/me?user_id=${uid}`);
      if (p && !p.error) setProfile(p);
      else setProfile(null);
    } catch { setProfile(null); }
  };

  const refreshedRef = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // HARD CONSTRAINT: pull fresh wearable data on app load.
        // Debounced: only once per session (not on every token refresh).
        if (!refreshedRef.current) {
          refreshedRef.current = true;
          try { await fetch("/api/oura/refresh"); } catch {}
        }
        await loadProfile(u.uid);
      } else {
        setProfile(null);
        refreshedRef.current = false;
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const loginWithGoogle = async () => {
    const result = await signInWithGoogle();
    await loadProfile(result.user.uid);
  };

  const loginWithApple = async () => {
    const result = await signInWithApple();
    await loadProfile(result.user.uid);
  };

  const logout = async () => {
    await signOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.uid);
  };

  const onboarded = !!(profile && profile.equipment && !profile.error);

  return (
    <AuthContext.Provider value={{ user, loading, profile, onboarded, loginWithGoogle, loginWithApple, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
