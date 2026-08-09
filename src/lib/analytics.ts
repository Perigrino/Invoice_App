import posthog from "posthog-js";

const ENABLED = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);

export function track(event: string, properties?: Record<string, unknown>) {
  if (!ENABLED) return;
  try {
    posthog.capture(event, properties);
  } catch {
    // telemetry must never break the app
  }
}
