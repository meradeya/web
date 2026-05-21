import { emitAuthSyncEvent } from "./authSync";

let envApiUrl = "http://localhost:8080/v1.0";
try {
  // @ts-ignore
  envApiUrl = process.env.BUN_PUBLIC_API_URL || (import.meta as any).env?.VITE_API_URL || envApiUrl;
} catch {
  try {
    envApiUrl = (import.meta as any).env?.VITE_API_URL || envApiUrl;
  } catch {}
}

/**
 * Base URL for the Meradeya API.
 * Falls back to localhost if the BUN_PUBLIC_API_URL environment variable is not set.
 */
export const API_URL = envApiUrl;

let refreshInProgressRef = false;
let refreshPromiseRef: Promise<boolean> | null = null;

/**
 * Attempts to refresh the access token using the stored refresh token.
 * This is called internally when a 401 response is received.
 */
async function attemptTokenRefresh(): Promise<boolean> {
  if (refreshInProgressRef && refreshPromiseRef) {
    return refreshPromiseRef;
  }

  refreshInProgressRef = true;
  const refreshToken = localStorage.getItem("refreshToken");

  if (!refreshToken) {
    refreshInProgressRef = false;
    return false;
  }

  refreshPromiseRef = (async () => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        emitAuthSyncEvent("logout");
        return false;
      }

      const data = await response.json();
      const newAccessToken = data.accessToken;
      const newRefreshToken = data.refreshToken;

      localStorage.setItem("accessToken", newAccessToken);
      localStorage.setItem("refreshToken", newRefreshToken);

      emitAuthSyncEvent("tokensRefreshed");
      return true;
    } catch (err) {
      console.error("Token refresh failed:", err);
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      emitAuthSyncEvent("logout");
      return false;
    } finally {
      refreshInProgressRef = false;
      refreshPromiseRef = null;
    }
  })();

  return refreshPromiseRef;
}

/**
 * Resolves a server-relative photo URL to a full absolute URL.
 *
 * @param url - The server-relative path (e.g., /media/...)
 * @returns The absolute URL
 */
export const resolvePhotoUrl = (url: string) => {
  const baseUrl = API_URL.replace(/\/v1\.0$/, "");
  return `${baseUrl}${url}`;
};

/**
 * Basic fetch wrapper designed for use with SWR hooks.
 * Automatically attaches the Authorization header if a token is present in localStorage.
 * On 401, attempts to refresh the token and retry the request once.
 *
 * @param url - The API endpoint to fetch (relative to API_URL)
 * @param retried - Internal flag to track retry attempts
 * @returns A promise resolving to the parsed JSON response
 * @throws Error if the request fails
 */
export const fetcher = async (url: string, retried = false): Promise<any> => {
  const headers: HeadersInit = {};
  const token = localStorage.getItem("accessToken");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${url}`, { headers });

  // If 401 and haven't retried, attempt token refresh and retry
  if (res.status === 401 && !retried) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      return fetcher(url, true); // Retry once with new token
    }
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || errorData.title || "An error occurred while fetching the data.",
    );
  }
  return res.json();
};

/**
 * Advanced API caller for mutations (POST, PATCH, DELETE) and programmatic fetches.
 * Handles content-type setup, auth headers, and standardized error extraction.
 * On 401, attempts to refresh the token and retry the request once.
 *
 * @param endpoint - The API endpoint to call (relative to API_URL)
 * @param options - Standard fetch options (method, body, headers, etc.)
 * @param retried - Internal flag to track retry attempts
 * @returns A promise resolving to the parsed JSON response, or null for 204 No Content
 * @throws Error with detailed message from the server if the request fails
 */
export const apiCall = async (
  endpoint: string,
  options: RequestInit = {},
  retried = false,
): Promise<any> => {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = localStorage.getItem("accessToken");
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // If 401 and haven't retried, attempt token refresh and retry
  if (res.status === 401 && !retried) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      return apiCall(endpoint, options, true); // Retry once with new token
    }
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.title || "API Request failed");
  }

  if (res.status === 204) return null;

  return res.json();
};

/**
 * Generates a unique ID that works across all browsers (including older mobile browsers).
 * Uses crypto.randomUUID if available, falls back to timestamp + random for older browsers.
 *
 * @returns A unique ID string
 */
export const generateId = (): string => {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  // Fallback for browsers without crypto.randomUUID support
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  const counter = Math.floor(Math.random() * 10000).toString(36);
  return `${timestamp}-${randomPart}-${counter}`;
};

/**
 * Formats a numeric price into a localized currency string.
 *
 * @param price - The price amount to format
 * @param currency - The ISO 4217 currency code (defaults to 'MDL')
 * @returns The formatted price string (e.g., "$1,234.00" or "MDL 1,234")
 */
export const formatPrice = (price: number, currency: string = "MDL") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
};
