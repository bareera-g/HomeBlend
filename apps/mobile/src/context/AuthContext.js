import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { saveUser, getUser, clearUser } from '../lib/storage';
import { signInByName as firebaseSignIn } from '../lib/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUser().then((u) => {
      if (u) setUser(u);
      setLoading(false);
    });
  }, []);

  const signIn = async (displayName) => {
    // Use Firebase signInByName — matches web app identity system exactly.
    // userId = normalized name, stored in Firestore users/{userId}.
    const u = await firebaseSignIn(displayName);
    await saveUser(u);
    setUser(u);
    return u;
  };

  const signOut = async () => {
    await clearUser();
    setUser(null);
  };

  const value = useMemo(() => ({ user, loading, signIn, signOut }), [user, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
