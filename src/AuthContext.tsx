import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

/**
 * Represents the authentication state of the application.
 */
interface AuthState {
  accessToken: string | null;
  isAuthenticated: boolean;
  userId: string | null;
}

/**
 * Defines the operations available in the AuthContext.
 */
interface AuthContextType extends AuthState {
  login: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const parseUserIdFromToken = (token: string): string | null => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1] || ''));
    return payload.sub || null;
  } catch (e) {
    return null;
  }
};

/**
 * Provider component that wraps the application to supply authentication state.
 * Manages token persistence in localStorage and provides login/logout methods.
 *
 * @param props - Component properties
 * @param props.children - Child components that require access to the auth context
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    accessToken: null,
    isAuthenticated: false,
    userId: null,
  });

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      setAuthState({ 
        accessToken: token, 
        isAuthenticated: true,
        userId: parseUserIdFromToken(token)
      });
    }
  }, []);

  const login = (accessToken: string, refreshToken: string) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setAuthState({ 
      accessToken, 
      isAuthenticated: true,
      userId: parseUserIdFromToken(accessToken)
    });
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setAuthState({ accessToken: null, isAuthenticated: false, userId: null });
  };

  return (
    <AuthContext.Provider value={{ ...authState, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to access the authentication context.
 *
 * @returns The current authentication state and context methods
 * @throws Error if used outside of an AuthProvider
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
