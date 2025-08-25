
'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import type { User } from '@/lib/types';

interface AuthContextProps {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const logout = useCallback(() => {
    setCurrentUser(null);
  }, []);

  const contextValue = {
    currentUser,
    setCurrentUser,
    logout
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
