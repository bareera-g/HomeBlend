/**
 * HomeBlend — Name-only auth via Firebase
 * User enters display name. If exists → sign in; if not → create account.
 */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { signInByName as firebaseSignInByName, ensureSchema } from "./firebase.js";

const STORAGE_KEY = "homeblend_user";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.id) setUser(parsed);
      } catch {}
    }
    setLoading(false);
    // Bootstrap Firebase schema (creates users, rooms, etc. if missing)
    ensureSchema().catch(() => {});
  }, []);

  const signInByName = useCallback(async (displayName) => {
    const u = await firebaseSignInByName(displayName);
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    return u;
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signInByName, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
