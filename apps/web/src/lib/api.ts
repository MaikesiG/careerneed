export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type ApiError = {
  detail?: string;
};

/**
 * Browser-only API client. Credentials are intentionally forced to "include"
 * so authenticated requests always send the session cookie.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
  });
}

export async function getApiErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as ApiError;
    return typeof body.detail === "string" ? body.detail : fallback;
  } catch {
    return fallback;
  }
}
