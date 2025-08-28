#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAMBDA_DIR="$ROOT_DIR/lambdas/postConfirmation"
OUT_ZIP="$LAMBDA_DIR/postConfirmation.zip"

echo "Packaging PostConfirmation Lambda..."
rm -f "$OUT_ZIP"
(
  cd "$LAMBDA_DIR"
  zip -qr "postConfirmation.zip" index.js package.json package-lock.json 2>/dev/null || zip -qr "postConfirmation.zip" index.js
)
echo "Created $OUT_ZIP"
