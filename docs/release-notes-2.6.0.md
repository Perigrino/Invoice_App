## InvoiceFlow 2.6.0

InvoiceFlow can now update itself.

- Automatic update checks once a day, with a subtle banner when a new version
  is available.
- Settings → General → Updates shows the installed version, the last check, and
  a manual **Check Now** button.
- Updates download and install in place, verify their EdDSA signature before
  extraction, and relaunch the app when done.
- New **Check for Updates…** item in the app menu.
- Builds remain ad-hoc signed until the Developer ID certificate is in place, so
  the first manual download may still need right-click → Open.
