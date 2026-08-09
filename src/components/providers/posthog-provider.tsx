"use client";

import { Suspense, useCallback, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

if (typeof window !== "undefined" && POSTHOG_KEY && !posthog.__loaded) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    autocapture: true,
    capture_exceptions: true,
    rageclick: true,
    person_profiles: "identified_only",
    session_recording: {
      maskAllInputs: true,
    },
  });
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!POSTHOG_KEY) return;
    const url = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
    if (lastUrl.current === url) return;
    lastUrl.current = url;
    posthog.capture("$pageview", { pathname, url });
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const reportWebVitals = useCallback((metric: {
    name: string;
    value: number;
    id: string;
    navigationType?: string;
  }) => {
    if (!POSTHOG_KEY) return;
    posthog.capture("web_vitals", {
      id: metric.id,
      name: metric.name,
      value: Math.round(metric.value * 100) / 100,
      navigation_type: metric.navigationType,
    });
  }, []);

  useReportWebVitals(reportWebVitals);

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </>
  );
}
