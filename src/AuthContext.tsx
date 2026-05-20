import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

/**
 * Represents the authentication state of the application.
 */
interface AuthState {
  accessToken: string | null;
  isAuthenticated: boolean;
}

/**
 * Defines the operations available in the AuthContext.
 */
interface AuthContextType extends AuthState {
  login: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
  });

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      setAuthState({ accessToken: token, isAuthenticated: true });
    }
  }, []);

  const login = (accessToken: string, refreshToken: string) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setAuthState({ accessToken, isAuthenticated: true });
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setAuthState({ accessToken: null, isAuthenticated: false });
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
