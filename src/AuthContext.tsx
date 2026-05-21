import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { API_URL } from "./api";
import { emitAuthSyncEvent, subscribeAuthSyncEvents } from "./authSync";

/**
 * Represents the authentication state of the application.
 */
interface AuthState {
  accessToken: string | null;
  isAuthenticated: boolean;
  userId: string | null;
  expiresAt: number | null;
  isInitializing: boolean;
}

/**
 * Defines the operations available in the AuthContext.
 */
interface AuthContextType extends AuthState {
  login: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
  refreshTokens: () => Promise<boolean>;
  forceLogout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const parseUserIdFromToken = (token: string): string | null => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] || ""));
    return payload.sub || null;
  } catch {
    return null;
  }
};

const getTokenExpiryTime = (token: string): number | null => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] || ""));
    const exp = payload.exp;
    return exp ? exp * 1000 : null; // Convert to milliseconds
  } catch {
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
export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [authState, setAuthState] = useState<AuthState>({
    accessToken: null,
    isAuthenticated: false,
    userId: null,
    expiresAt: null,
    isInitializing: true,
  });

  const refreshInProgressRef = useRef(false);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Attempts to refresh the access token using the stored refresh token.
   * Returns true if successful, false otherwise.
   */
  const refreshTokens = useCallback(async (): Promise<boolean> => {
    if (refreshInProgressRef.current) {
      return false;
    }

    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) {
      return false;
    }

    refreshInProgressRef.current = true;

    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      const newAccessToken = data.accessToken;
      const newRefreshToken = data.refreshToken;
      const expiresIn = data.expiresIn || 900;

      localStorage.setItem("accessToken", newAccessToken);
      localStorage.setItem("refreshToken", newRefreshToken);

      const expiresAt = Date.now() + expiresIn * 1000;

      setAuthState({
        accessToken: newAccessToken,
        isAuthenticated: true,
        userId: parseUserIdFromToken(newAccessToken),
        expiresAt,
        isInitializing: false,
      });

      emitAuthSyncEvent("tokensRefreshed");

      scheduleTokenRefresh(expiresIn);
      return true;
    } catch (err) {
      console.error("Token refresh failed:", err);
      return false;
    } finally {
      refreshInProgressRef.current = false;
    }
  }, []);

  /**
   * Force logout the user, clearing all tokens and auth state.
   * This is called when refresh fails or token is invalid.
   */
  const forceLogout = useCallback(
    async ({
      broadcast = true,
      revokeOnServer = true,
    }: { broadcast?: boolean; revokeOnServer?: boolean } = {}) => {
      const refreshToken = localStorage.getItem("refreshToken");

      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");

      setAuthState({
        accessToken: null,
        isAuthenticated: false,
        userId: null,
        expiresAt: null,
        isInitializing: false,
      });

      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      if (broadcast) {
        emitAuthSyncEvent("logout");
      }

      // Optional: revoke the refresh token on the server
      if (revokeOnServer && refreshToken) {
        try {
          await fetch(`${API_URL}/auth/logout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          });
        } catch (err) {
          console.error("Failed to revoke refresh token:", err);
        }
      }
    },
    [],
  );

  /**
   * Schedule token refresh to occur shortly before expiry.
   * Uses a buffer of 60 seconds to refresh before actual expiry.
   */
  const scheduleTokenRefresh = useCallback(
    (expiresIn: number) => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      const refreshBuffer = 60; // Refresh 60 seconds before expiry
      const delayMs = Math.max((expiresIn - refreshBuffer) * 1000, 5000); // At least 5 seconds

      refreshTimeoutRef.current = setTimeout(async () => {
        const success = await refreshTokens();
        if (!success) {
          await forceLogout();
        }
      }, delayMs);
    },
    [refreshTokens, forceLogout],
  );

  /**
   * On mount, check if there's a stored token and if it's still valid.
   * Schedule refresh if needed.
   */
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      const expiresAt = getTokenExpiryTime(token);
      const now = Date.now();

      if (expiresAt && now >= expiresAt) {
        // Token has expired, attempt refresh
        refreshTokens()
          .then((success) => {
            if (!success) {
              forceLogout();
            }
          })
          .finally(() => {
            setAuthState((prev) => ({ ...prev, isInitializing: false }));
          });
      } else if (expiresAt) {
        // Token is still valid, set up the state and schedule refresh
        const expiresInSeconds = Math.round((expiresAt - now) / 1000);
        setAuthState({
          accessToken: token,
          isAuthenticated: true,
          userId: parseUserIdFromToken(token),
          expiresAt,
          isInitializing: false,
        });
        scheduleTokenRefresh(expiresInSeconds);
      }
    } else {
      // No token found, mark initialization as complete
      setAuthState((prev) => ({ ...prev, isInitializing: false }));
    }

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [refreshTokens, forceLogout, scheduleTokenRefresh]);

  const login = useCallback(
    (accessToken: string, refreshToken: string) => {
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);

      const expiresAt = getTokenExpiryTime(accessToken);
      const expiresInSeconds = expiresAt ? Math.round((expiresAt - Date.now()) / 1000) : 900;

      setAuthState({
        accessToken,
        isAuthenticated: true,
        userId: parseUserIdFromToken(accessToken),
        expiresAt: expiresAt || Date.now() + expiresInSeconds * 1000,
        isInitializing: false,
      });

      scheduleTokenRefresh(expiresInSeconds);
      emitAuthSyncEvent("tokensRefreshed");
    },
    [scheduleTokenRefresh],
  );

  const logout = useCallback(() => {
    forceLogout();
  }, [forceLogout]);

  const value = useMemo(
    () => ({ ...authState, login, logout, refreshTokens, forceLogout }),
    [authState, login, logout, refreshTokens, forceLogout],
  );

  /**
   * Listen for auth events from the API layer (token refresh or logout).
   */
  useEffect(() => {
    return subscribeAuthSyncEvents((type) => {
      if (type === "logout") {
        forceLogout({ broadcast: false, revokeOnServer: false });
        return;
      }

      const token = localStorage.getItem("accessToken");
      if (!token) {
        return;
      }

      const expiresAt = getTokenExpiryTime(token);
      const expiresInSeconds = expiresAt ? Math.round((expiresAt - Date.now()) / 1000) : 900;

      setAuthState({
        accessToken: token,
        isAuthenticated: true,
        userId: parseUserIdFromToken(token),
        expiresAt: expiresAt || Date.now() + expiresInSeconds * 1000,
        isInitializing: false,
      });
      scheduleTokenRefresh(expiresInSeconds);
    });
  }, [forceLogout, scheduleTokenRefresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Custom hook to access the authentication context.
 *
 * @returns The current authentication state and context methods
 * @throws Error if used outside an AuthProvider
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
