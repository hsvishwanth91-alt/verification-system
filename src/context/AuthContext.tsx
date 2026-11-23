import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import type { AuthUser, UserRole } from '../types/index.ts';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  setSession: (token: string, user: AuthUser) => void;
  logout: () => void;
  login: (email: string, password: string, expectedRole: UserRole) => Promise<AuthUser>;
  apiFetch: <T>(url: string, options?: RequestInit) => Promise<T>;
  downloadCertificatePdf: (certificateId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Store Bearer session strictly in React memory (never localStorage/sessionStorage)
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  const setSession = useCallback((nextToken: string, nextUser: AuthUser) => {
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const login = useCallback(
    async (email: string, password: string, expectedRole: UserRole): Promise<AuthUser> => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, expectedRole }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        token?: string;
        user?: AuthUser;
        error?: string;
      };
      if (!res.ok || !body.token || !body.user) {
        throw new Error(body.error || 'Authentication failed');
      }
      setToken(body.token);
      setUser(body.user);
      return body.user;
    },
    [],
  );

  const apiFetch = useCallback(
    async <T,>(url: string, options: RequestInit = {}): Promise<T> => {
      const headers = new Headers(options.headers || {});
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      if (
        options.body &&
        !(options.body instanceof FormData) &&
        !headers.has('Content-Type')
      ) {
        headers.set('Content-Type', 'application/json');
      }

      const res = await fetch(url, { ...options, headers });
      const data = (await res.json().catch(() => ({}))) as T & { error?: string };
      if (!res.ok) {
        if (res.status === 401) {
          setToken(null);
          setUser(null);
        }
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      return data;
    },
    [token],
  );

  const downloadCertificatePdf = useCallback(
    async (certificateId: string) => {
      if (!token) throw new Error('Please sign in to download this certificate.');
      const res = await fetch(`/api/certificates/${encodeURIComponent(certificateId)}/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Unable to download PDF certificate.');
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `CertiTrust-${certificateId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    },
    [token],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        setSession,
        logout,
        login,
        apiFetch,
        downloadCertificatePdf,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
