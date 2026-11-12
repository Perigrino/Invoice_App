# In-app updates (Sparkle)

InvoiceFlow updates itself with [Sparkle 2](https://sparkle-project.org) from a
feed hosted on GitHub Pages, with binaries on GitHub Releases.

```
InvoiceFlow.app ──HTTPS──> appcast.xml (Pages)
      │                        └─ enclosure → InvoiceFlow-X.Y.Z.dmg (Release asset)
      └─ EdDSA verify (SUPublicEDKey) → extract → replace → relaunch
```

## What ships in the app

| Info.plist key | Value |
|---|---|
| `SUFeedURL` | `https://perigrino.github.io/Invoice_App/appcast.xml` |
| `SUPublicEDKey` | public half of the EdDSA pair (safe to publish) |
| `SUEnableAutomaticChecks` | `YES` — one background check a day |
| `SUScheduledCheckInterval` | `86400` |
| `SUVerifyUpdateBeforeExtraction` | `YES` — archive is verified before it is unpacked |

The private key is **never** in the repository, the app bundle or CI logs.

## Signing keys

Generated once with Sparkle's `generate_keys`:

- The private key lives in the login Keychain of the build Mac.
- A copy is stored as the repository secret `SPARKLE_ED_PRIVATE_KEY` for CI.
- Export it with `generate_keys -x <file>`; never commit that file.
- Losing it means existing installs will refuse every future update unless the
  feed and the app agree on a new key (Sparkle only supports rotation from a
  Developer ID–signed release), so keep an offline backup.

## Local rehearsal (no Apple account)

1. Build an "old" app: `xcodebuild -configuration Debug … MARKETING_VERSION=2.5.0 CURRENT_PROJECT_VERSION=6 build`
2. Build a "new" app with a higher build number, zip it:
   `ditto -c -k --keepParent InvoiceFlow.app InvoiceFlow-2.5.1.zip`
3. Sign it: `Sparkle/bin/sign_update InvoiceFlow-2.5.1.zip`
4. Write an `appcast.xml` whose `<enclosure>` points at the zip and whose
   `sparkle:edSignature`/`length` come from step 3.
5. Serve the folder: `python3 -m http.server 8765 --bind 127.0.0.1`
6. Launch the old build with:
   ```
   INVOICEFLOW_AUTO_UPDATE=1 \
   INVOICEFLOW_FEED_URL=http://127.0.0.1:8765/appcast.xml \
   INVOICEFLOW_UPDATE_LOG=/tmp/invoiceflow-update.log \
   /Applications/InvoiceFlow.app/Contents/MacOS/InvoiceFlow
   ```
   `INVOICEFLOW_AUTO_UPDATE` selects a debug-only driver that answers Sparkle's
   prompts automatically (Release builds do not contain it). The log shows the
   full cycle; afterwards `plutil -extract CFBundleShortVersionString raw
   /Applications/InvoiceFlow.app/Contents/Info.plist` should show the new
   version.

## Releasing

1. Bump `MARKETING_VERSION` in `InvoiceFlow/InvoiceFlow.xcodeproj` if you want
   the project default to match (the tag overrides it in CI).
2. Write `docs/release-notes-<version>.md`.
3. Tag and push:
   ```
   git tag v2.6.0 && git push origin v2.6.0
   ```
4. The `Release` workflow (behind the `release` environment approval) runs
   tests, builds a universal DMG, signs it, generates the appcast with
   `generate_appcast --ed-key-file -`, publishes the GitHub release, and
   deploys `appcast.xml` to Pages.

CI uses `CURRENT_PROJECT_VERSION = $GITHUB_RUN_NUMBER`, which is monotonic — the
only version number Sparkle really cares about.

## Rollback

- Regenerate the feed without the bad release, or mark the release as a draft:
  `gh release edit v2.6.0 --draft`, then re-run the release job for the version
  you want to keep, or edit `appcast.xml` on the Pages artifact.
- Sparkle cannot downgrade an installed app, so the real fix is a higher build
  number.

## Phase 2 (Developer ID + notarisation)

Add these repository secrets and the workflow switches itself on:

| Secret | Purpose |
|---|---|
| `DEVELOPER_ID_P12_BASE64` | base64 of the `.p12` holding the Developer ID Application certificate |
| `DEVELOPER_ID_P12_PASSWORD` | password for that `.p12` |
| `KEYCHAIN_PASSWORD` | throwaway password for the CI keychain |
| `DEVELOPER_ID_APPLICATION` | certificate CN, e.g. `Developer ID Application: Your Name (TEAMID)` |
| `APPSTORE_API_KEY_ID` | App Store Connect API key id |
| `APPSTORE_API_ISSUER_ID` | App Store Connect issuer id |
| `APPSTORE_API_PRIVATE_KEY` | contents of the `AuthKey_*.p8` file |

With `DEVELOPER_ID_APPLICATION` set, `scripts/build-dmg.sh` signs with the
certificate, hardened runtime and a timestamp (inside-out, never `--deep`), and
the workflow notarises and staples the DMG. Nothing else changes: same feed,
same appcast, same bundle id.

## Limitations until Phase 2

- Builds are ad-hoc signed, so the **first** download still trips Gatekeeper:
  right-click → Open, or `xattr -dr com.apple.quarantine /Applications/InvoiceFlow.app`.
- Updates after that install and relaunch inside the app (EdDSA verification is
  what Sparkle enforces for a bundle update).
- The app must live in `/Applications`; Sparkle will not update a copy running
  from a DMG or a translocated path.
