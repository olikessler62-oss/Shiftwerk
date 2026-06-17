import { getDatabase } from "@/lib/db";

export function getWebAppUrl(): string {
  const configured = process.env.EXPO_PUBLIC_WEB_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return "http://localhost:3000";
}

export class MobileApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "MobileApiError";
  }
}

export async function fetchMobileApi<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const session = await getDatabase().authGetSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new MobileApiError("Nicht angemeldet.", 401);
  }

  const response = await fetch(`${getWebAppUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };

  if (!response.ok) {
    throw new MobileApiError(
      payload.error ?? "Anfrage fehlgeschlagen.",
      response.status
    );
  }

  return payload as T;
}
