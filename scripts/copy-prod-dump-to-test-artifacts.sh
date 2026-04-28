#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Stream a gzipped PROD dump from the PROD artifacts bucket, sanitize known
restore-incompatible MySQL dump output, and upload it to the TEST artifacts
bucket without writing the live-data dump to local disk.

Usage:
  scripts/copy-prod-dump-to-test-artifacts.sh \
    --source-bucket nwac-prod-artifacts \
    --source-key db-dumps/prod/example.sql.gz \
    --target-bucket nwac-test-artifacts \
    --target-key db-refresh/example.sql.gz

Options:
  --source-bucket NAME   Source S3 bucket. Default: nwac-prod-artifacts
  --source-key KEY       Source S3 key. Required.
  --target-bucket NAME   Target S3 bucket. Default: nwac-test-artifacts
  --target-key KEY       Target S3 key. Required.
  --source-profile NAME  AWS profile for source read. Default: nwac-prod
  --target-profile NAME  AWS profile for target write. Default: nwac-test
  --region REGION        AWS region. Default: ca-central-1
  --help                 Show this help text.
EOF
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_BUCKET="nwac-prod-artifacts"
SOURCE_KEY=""
TARGET_BUCKET="nwac-test-artifacts"
TARGET_KEY=""
SOURCE_PROFILE="nwac-prod"
TARGET_PROFILE="nwac-test"
AWS_REGION="ca-central-1"

fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source-bucket)
      [[ $# -ge 2 ]] || fail "--source-bucket requires a value"
      SOURCE_BUCKET="$2"
      shift 2
      ;;
    --source-key)
      [[ $# -ge 2 ]] || fail "--source-key requires a value"
      SOURCE_KEY="$2"
      shift 2
      ;;
    --target-bucket)
      [[ $# -ge 2 ]] || fail "--target-bucket requires a value"
      TARGET_BUCKET="$2"
      shift 2
      ;;
    --target-key)
      [[ $# -ge 2 ]] || fail "--target-key requires a value"
      TARGET_KEY="$2"
      shift 2
      ;;
    --source-profile)
      [[ $# -ge 2 ]] || fail "--source-profile requires a value"
      SOURCE_PROFILE="$2"
      shift 2
      ;;
    --target-profile)
      [[ $# -ge 2 ]] || fail "--target-profile requires a value"
      TARGET_PROFILE="$2"
      shift 2
      ;;
    --region)
      [[ $# -ge 2 ]] || fail "--region requires a value"
      AWS_REGION="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      fail "Unknown argument: $1"
      ;;
  esac
done

command -v aws >/dev/null 2>&1 || fail "aws CLI not found in PATH"
command -v gzip >/dev/null 2>&1 || fail "gzip not found in PATH"
command -v python3 >/dev/null 2>&1 || fail "python3 not found in PATH"
[[ -n "$SOURCE_KEY" ]] || fail "--source-key is required"
[[ -n "$TARGET_KEY" ]] || fail "--target-key is required"

SANITIZER="$ROOT_DIR/scripts/sanitize-prod-dump-for-test-restore.py"
[[ -f "$SANITIZER" ]] || fail "Sanitizer not found: $SANITIZER"

aws s3 cp "s3://$SOURCE_BUCKET/$SOURCE_KEY" - \
  --profile "$SOURCE_PROFILE" \
  --region "$AWS_REGION" \
  --only-show-errors \
  | gzip -dc \
  | python3 "$SANITIZER" \
  | gzip -c \
  | aws s3 cp - "s3://$TARGET_BUCKET/$TARGET_KEY" \
      --profile "$TARGET_PROFILE" \
      --region "$AWS_REGION" \
      --only-show-errors

printf '{"source":"s3://%s/%s","target":"s3://%s/%s","sanitized":true}\n' \
  "$SOURCE_BUCKET" "$SOURCE_KEY" "$TARGET_BUCKET" "$TARGET_KEY"
