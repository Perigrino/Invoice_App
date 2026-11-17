"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatRecoveryKey, parseRecoveryKey } from "@/lib/recovery";
import { track } from "@/lib/analytics";

/**
 * Hands the key to `/w/<key>`, which already knows whether adopting it needs
 * confirmation (this browser may hold invoices of its own), so the decision
 * stays in one place.
 */
export function RecoverKeyForm() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const key = parseRecoveryKey(value);
    if (!key) {
      setError("That does not look like a recovery key — it has 20 letters and digits.");
      return;
    }
    setError(null);
    track("landing_recover");
    // A full navigation, not a router push: `/w/<key>` is a route handler that
    // sets the workspace cookie and redirects, which only a real document
    // request follows.
    window.location.assign(`/w/${formatRecoveryKey(key)}`);
  };

  return (
    <form onSubmit={submit} className="mt-3 space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="recovery-key" className="sr-only">
          Recovery key
        </label>
        <input
          id="recovery-key"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
          placeholder="K7QM-3XPD-9TZR-4HWV-8NB2"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "recovery-key-error" : undefined}
          className="h-10 flex-1 rounded-lg border border-gray-200 bg-white px-3 font-mono text-sm tracking-wider text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-600"
        />
        <Button type="submit" variant="outline" size="lg">
          Open workspace
        </Button>
      </div>
      {error && (
        <p id="recovery-key-error" role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
