const SESSION_KEY = "frame_session";

export type SessionUser = {
  email: string;
  role: string;
  name: string;
  createdAt: string;
  token?: string;
};

let inMemorySession: SessionUser | null = null;

export function createSession(
  user: Omit<SessionUser, "createdAt">
): SessionUser {
  const session: SessionUser = {
    ...user,
    createdAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined" && window.sessionStorage) {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  inMemorySession = session;
  return session;
}

export function getSession(): SessionUser | null {
  if (typeof window !== "undefined" && window.sessionStorage) {
    const rawSession = window.sessionStorage.getItem(SESSION_KEY);
    if (!rawSession) {
      return inMemorySession;
    }

    try {
      const session = JSON.parse(rawSession) as SessionUser;
      return session && session.email && session.role ? session : null;
    } catch {
      return inMemorySession;
    }
  }

  return inMemorySession;
}

export function clearSession(): void {
  if (typeof window !== "undefined" && window.sessionStorage) {
    window.sessionStorage.removeItem(SESSION_KEY);
  }

  inMemorySession = null;
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}

export function getToken(): string | null {
  const session = getSession();
  return session?.token || null;
}
