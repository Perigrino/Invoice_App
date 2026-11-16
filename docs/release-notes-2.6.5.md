## InvoiceFlow 2.6.5

- The Updates card speaks plainly: one sentence per state, and a failed check
  names the reason (timed out, offline, server unreachable) instead of an error
  domain. A check that finds nothing shows **Up to date**, never "Check failed".
- Last checked reads "Just now" for a fresh check.
- The developer signature in the corner is quieter.
- Smaller app binary: the unused SwiftUI PDF theme renderer is gone.
- No data or schema changes — your invoices, clients and profiles are untouched.
