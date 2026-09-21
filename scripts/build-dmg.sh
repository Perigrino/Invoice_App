#!/usr/bin/env bash
#
# build-dmg.sh — build the native InvoiceFlow.app and package it as a DMG.
#
# Replaces the manual dance: xcodebuild archive → pull the .app out of the
# archive → ad-hoc codesign (repo ships unsigned, matching identity: null) →
# stage with an Applications symlink → hdiutil into dist/.
#
# Usage:
#   scripts/build-dmg.sh            # version read from MARKETING_VERSION
#   scripts/build-dmg.sh 2.1.1      # override the version label
#
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
XCODEPROJ="$PROJECT_ROOT/InvoiceFlow/InvoiceFlow.xcodeproj"
SCHEME="InvoiceFlow"
APP_NAME="InvoiceFlow.app"
DIST_DIR="$PROJECT_ROOT/dist"

WORK_DIR="$(mktemp -d /tmp/invoiceflow-dmg.XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT

ARCHIVE="$WORK_DIR/$APP_NAME.xcarchive"
EXPORT_APP="$WORK_DIR/export/$APP_NAME"
STAGE="$WORK_DIR/stage"
VERSION="${1:-}"

# --- 1. Version: argument override, else read from the Xcode project -------
if [[ -z "$VERSION" ]]; then
  VERSION="$(xcodebuild -project "$XCODEPROJ" -showBuildSettings 2>/dev/null \
    | awk '/MARKETING_VERSION/ { print $3; exit }')"
fi
[[ -n "$VERSION" ]] || { echo "error: could not determine version" >&2; exit 1; }
DMG_PATH="$DIST_DIR/${APP_NAME%.app}-${VERSION}.dmg"

echo "==> Version: $VERSION"

# --- 2. Archive (Release, universal) ---------------------------------------
echo "==> Archiving (universal: arm64 + x86_64)…"
if ! xcodebuild archive \
  -project "$XCODEPROJ" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination 'generic/platform=macOS' \
  -archivePath "$ARCHIVE" \
  ARCHS="arm64 x86_64" \
  > "$WORK_DIR/archive.log" 2>&1; then
  grep -E "error:" "$WORK_DIR/archive.log" | head -5 >&2
  echo "error: archive failed (full log: $WORK_DIR/archive.log)" >&2
  exit 1
fi

ARCHIVED_APP="$ARCHIVE/Products/Applications/$APP_NAME"
[[ -d "$ARCHIVED_APP" ]] || { echo "error: no app in archive" >&2; exit 1; }

# --- 3. Export: copy out of the archive, then ad-hoc sign ------------------
# xcodebuild -exportArchive needs a signing team; this repo ships ad-hoc
# signed apps, so replicate that with codesign.
mkdir -p "$WORK_DIR/export"
cp -R "$ARCHIVED_APP" "$EXPORT_APP"
codesign --force --deep --sign - "$EXPORT_APP" >/dev/null
echo "==> Ad-hoc signed: $(codesign -dv "$EXPORT_APP" 2>&1 | awk -F'=' '/^Identifier=/ { print $2 }')"

# --- 4. Package -------------------------------------------------------------
echo "==> Building DMG: ${DMG_PATH#$PROJECT_ROOT/}"
mkdir -p "$STAGE"
cp -R "$EXPORT_APP" "$STAGE/$APP_NAME"
ln -s /Applications "$STAGE/Applications"
mkdir -p "$DIST_DIR"
rm -f "$DMG_PATH"
hdiutil create \
  -volname "${APP_NAME%.app}" \
  -srcfolder "$STAGE" \
  -ov -format UDZO -fs HFS+ \
  "$DMG_PATH" | sed 's/^/    /'

# --- 5. Verify ---------------------------------------------------------------
echo "==> Verifying…"
MNT="$WORK_DIR/mnt"
mkdir -p "$MNT"
hdiutil attach -readonly -nobrowse -mountpoint "$MNT" "$DMG_PATH" >/dev/null
DMG_APP="$MNT/$APP_NAME"

fail() { echo "error: $1" >&2; hdiutil detach "$MNT" >/dev/null; exit 1; }

DMG_ARCHS="$(lipo -archs "$DMG_APP/Contents/MacOS/${APP_NAME%.app}")"
[[ "$DMG_ARCHS" == *arm64* && "$DMG_ARCHS" == *x86_64* ]] \
  || fail "binary is not universal: $DMG_ARCHS"
echo "    archs:      $DMG_ARCHS"

DMG_VERSION="$(plutil -extract CFBundleShortVersionString raw \
  "$DMG_APP/Contents/Info.plist")"
[[ "$DMG_VERSION" == "$VERSION" ]] \
  || fail "version mismatch: DMG has $DMG_VERSION, expected $VERSION"
echo "    version:    $DMG_VERSION"

DMG_ID="$(codesign -dv "$DMG_APP" 2>&1 | awk -F'=' '/^Identifier=/ { print $2 }')"
[[ "$DMG_ID" == "com.invoiceflow.app" ]] || fail "unexpected bundle id: $DMG_ID"
echo "    bundle id:  $DMG_ID"

hdiutil detach "$MNT" >/dev/null

echo "==> Done: ${DMG_PATH#$PROJECT_ROOT/} ($(du -h "$DMG_PATH" | cut -f1))"
