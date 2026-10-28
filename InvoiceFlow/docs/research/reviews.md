# Reviews

Research for InvoiceFlow. Done 2026-10-28.
[V] verified in a source, [K] from knowledge, [U] unverified, test first.

Question: what do users of the leading invoicing apps love and hate?
Decision it informs: what to redesign (UI), re-architect (data/robustness), rebuild in InvoiceFlow's next version.

## Likes and dislikes

| App | People like | People dislike | Sources |
|---|---|---|---|
| FreshBooks | fast professional invoicing; recurring + auto payment reminders best-in-class; support praised; clean mobile UI | bank import broken (debits only, deposits/transfer missing); non-intuitive workflows; repeated price hikes (#1 exit trigger); no free plan | [V](https://business.com/reviews/freshbooks-accounting-software-and-invoice-generators), [V](https://reddit.com/r/Bookkeeping/comments/18q3jeo), [V](https://chargd.pro blog citing r/), [V](https://trustpilot.com/review/freshbooks.com) |
| QuickBooks | feature depth is the one consistent positive; accountant default (switching costs) | visceral hate for the UI ("exasperated every time I use it"); support widely called worst, occasionally damaging accounts; price increases without service; forced Desktop→subscription migration | [V](https://nerdwallet.com/.../quickbooks-online), [V](https://reddit.com/r/QuickBooks/comments/1ngznfj), [V](https://reddit.com/r/QuickBooks/comments/18x3url), [V](https://reddit.com/r/quickbooksonline/comments/1kd1sj6) |
| Invoice Simple | simple & fast; 4.9 App Store satisfaction; long-term 7-year users | mid-term contract changes (locked out of invoice creation as annual subscriber); ~40% price jump, invoice-count tiers feel like bait; cancellation/refund friction; mobile↔web sync bugs | [V](https://reddit.com/r/Freelancers/comments/1n0byxm), [V](https://brandedinvoice.com/blog/invoice-simple-review), [V](https://reddit.com/r/smallbusiness/comments/1mc6ub3), [V](https://trustpilot.com/review/invoicesimple.com) |
| Billings Pro | native Mac + iPhone sync "works properly"; stable; overdue/outstanding tracking; flexible billing modes | subscription without meaningful updates; bought-forever app converted to subscription + mandatory cloud login; timer unreliability destroyed data trust; weak template editing, no Excel export; product appears abandoned [U] | [V](https://apps.apple.com/us/app/billings-pro-time-invoice/id434514810), [U](https://www.marketcircle.com/billingspro/) |

Patterns:
- **Subscription resentment** is the strongest recurring betrayal narrative (all four apps). → must-have: stable pricing, no mid-term term changes.
- **Trust through reliability** is the emotional core ("can I trust you with my money data?"): broken import (FreshBooks), timers eating billable hours (Billings Pro), sync mismatches (Simple), QBO instability. → our chance: provably reliable local data + backups + export.
- **Unresponsive/harmful support** appears in every hate cycle.
- **Simplicity wins 5-star reviews** — "simple, easy to use" is the top praise everywhere; bloat (QBO, Billings Pro) is punished.
- HN corroborates the niche: 734-point thread on a solo dev's invoicing app. [V](news.ycombinator.com item 26423002)

## Decisions

1. Re-architect for **data reliability**: local-first store, automatic backups, import/export lifeline, and no network dependency for core flows. [V pattern]
2. Keep UX scoped to **one job — fast invoice creation**; do not drift into multi-suite accounting bloat. [K/U — direction from consistent review patterns]
3. Any pricing model must avoid the resentments found: no invoice-count caps, no mid-term changes; one-time/lifetime or stable price preferred. [V pattern]

## Open questions

- [U] Billings Pro abandonment (update gap 2020→2026) — vet Marketcircle's status before citing competitive whitespace in any release notes.
