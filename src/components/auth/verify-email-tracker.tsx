"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

export function VerifyEmailTracker({ valid }: { valid: boolean }) {
  useEffect(() => {
    if (valid) track("verify_email_success");
  }, [valid]);

  return null;
}
