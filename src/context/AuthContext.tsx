import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { apiRequest, setAuthToken } from '../services/api';
import type { UserProfile } from '../types';

interface AuthContextValue {
  user: UserProfile | null;
  login: (email: string, password: string) => Promise<UserProfile>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    major: string;
    university: string;
  }) => Promise<UserProfile>;
  claimAdmin: (payload: {
    name: string;
    email: string;
    password: string;
    university: string;
    passcode?: string;
  }) => Promise<UserProfile>;
  refreshProfile: () => Promise<void>;
  setUser: (user: UserProfile | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(
    async (payload: {
      name: string;
      email: string;
      password: string;
      major: string;
      university: string;
    }) => {
      const data = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setAuthToken(data.token);
      setUser(data.user);
      return data.user;
    },
    []
  );

  const claimAdmin = useCallback(
    async (payload: {
      name: string;
      email: string;
      password: string;
      university: string;
      passcode?: string;
    }) => {
      const data = await apiRequest<{ token: string; user: UserProfile }>(
        '/api/auth/claim-admin',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
      setAuthToken(data.token);
      setUser(data.user);
      return data.user;
    },
    []
  );

  const refreshProfile = useCallback(async () => {
    const data = await apiRequest<{ user: UserProfile }>('/api/auth/me');
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, login, register, claimAdmin, refreshProfile, setUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
