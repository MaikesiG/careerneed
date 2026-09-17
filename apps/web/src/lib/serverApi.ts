import "server-only";

import { cookies } from "next/headers";
import { API_URL } from "./api";

export async function serverApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  return fetch(`${API_URL}${path}`, {
    ...init,
    cache: init.cache ?? "no-store",
    headers: {
      ...(init.headers ?? {}),
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
  });
}
