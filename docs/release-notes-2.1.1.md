# InvoiceFlow 2.1.1

## Fixed: data loss on relaunch

InvoiceFlow 2.1.0 and earlier stored all data in `~/Library/Application Support/default.store`. That filename is not InvoiceFlow-specific — it is the default location **every** SwiftData app uses. On Macs where another SwiftData-based app (in our testing, a macOS system agent) opened the same file, whichever app wrote last replaced the file's schema and the other app's tables disappeared. For InvoiceFlow that meant: quit the app, reopen it, and clients, invoices, and settings were gone. Setup had to be redone after every relaunch.

**2.1.1 gives the app a database of its own.** Data now lives at `~/Library/Application Support/InvoiceFlow/InvoiceFlow.store`, a file no other app can touch. Records written with this version survive relaunches by design, verified by new regression tests that open a store, write, tear it down, reopen, and assert the data is still there.

## If you lost data — recovery path

Older releases snapshotted the store to `~/Library/Application Support/InvoiceFlow/Backups/` every time the app quit. Those snapshots still contain whatever existed at each quit, and they are restorable:

1. Install InvoiceFlow 2.1.1 and launch it once (this upgrades the storage location).
2. Open **Settings → General → Automatic Snapshots**. Snapshots are listed newest first.
3. Click **Restore** next to the newest snapshot dated *before* your data disappeared.
4. The app quits; reopen it. The snapshot's clients and invoices replace the current (empty) ones.

Two notes:

- Snapshots hold the store as it was at quit time. If you never quit the app between entering data and the wipe, no snapshot captured it — but quit-time snapshots have been taken by every 2.1.x release, so most users will find their data.
- Restore replaces current records with the snapshot's. If you re-entered some data after the wipe, it will be overwritten by the restored snapshot.

**Prefer a non-destructive check first?** Use **Settings → General → Backup & Restore → Export Backup…** before restoring: it writes your current (possibly empty) state to JSON, so nothing you did after the wipe is lost.

## For developers

- The store location is pinned by a regression test (`testStoreLivesInAppOwnedPathNotGenericDefaultStore`) that fails if the app ever points back at a generic store path.
- Snapshot files are normalized to a canonical name on write, so snapshots taken by 2.1.0 remain restorable after the rename.
- `npm run dist` now builds the native Xcode app and DMG end-to-end, verifies the artifact (universal binary, version, bundle id), and the obsolete Electron packaging has been removed.

**Full Changelog**: v2.0.0...v2.1.1
