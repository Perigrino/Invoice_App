import { headers } from "next/headers";

export async function getBaseUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto")?.split(",")[0] ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

export function buildUrl(baseUrl: string, path: string, params: Record<string, string>): string {
  const search = new URLSearchParams(params).toString();
  return `${baseUrl}${path}${search ? `?${search}` : ""}`;
}
