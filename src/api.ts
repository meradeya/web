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
 *
 * @param url - The API endpoint to fetch (relative to API_URL)
 * @returns A promise resolving to the parsed JSON response
 * @throws Error if the request fails
 */
export const fetcher = async (url: string) => {
  const headers: HeadersInit = {};
  const token = localStorage.getItem("accessToken");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${url}`, { headers });
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
 *
 * @param endpoint - The API endpoint to call (relative to API_URL)
 * @param options - Standard fetch options (method, body, headers, etc.)
 * @returns A promise resolving to the parsed JSON response, or null for 204 No Content
 * @throws Error with detailed message from the server if the request fails
 */
export const apiCall = async (endpoint: string, options: RequestInit = {}) => {
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

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.title || "API Request failed");
  }

  if (res.status === 204) return null;

  return res.json();
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
