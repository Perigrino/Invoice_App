/**
 * First hop of `x-forwarded-for`, which is what a CDN or platform proxy such
 * as Vercel sets. Only trustworthy when the deployment strips inbound copies
 * of the header — true on Vercel, worth checking anywhere else.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
