#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Audit or clear deprecated staff Cognito custom attributes.

Default mode is read-only. Use --apply --yes to delete per-user values for
custom:region_id and custom:user_id. This does not remove Cognito pool schema
attributes; it only removes values from matching users.

Usage:
  scripts/audit-staff-cognito-legacy-custom-attrs.sh --env dev
  scripts/audit-staff-cognito-legacy-custom-attrs.sh --env test --username user@example.org
  scripts/audit-staff-cognito-legacy-custom-attrs.sh --env dev --apply --yes

Options:
  --env dev|test|prod   Target environment. Default: dev.
  --pool-id ID          Override the Cognito user pool ID.
  --profile NAME        Override the AWS CLI profile.
  --region REGION       Override AWS region. Default: ca-central-1.
  --env-file PATH       Override env file used to discover the pool ID.
  --username USER       Audit/clear one Cognito username instead of all users.
  --apply               Delete deprecated custom attribute values.
  --yes                 Required with --apply.
  --help                Show this help text.
EOF
}

fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_NAME="dev"
POOL_ID=""
PROFILE=""
AWS_REGION="ca-central-1"
ENV_FILE=""
USERNAME=""
APPLY=0
YES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      [[ $# -ge 2 ]] || fail "--env requires a value"
      ENV_NAME="$2"
      shift 2
      ;;
    --pool-id)
      [[ $# -ge 2 ]] || fail "--pool-id requires a value"
      POOL_ID="$2"
      shift 2
      ;;
    --profile)
      [[ $# -ge 2 ]] || fail "--profile requires a value"
      PROFILE="$2"
      shift 2
      ;;
    --region)
      [[ $# -ge 2 ]] || fail "--region requires a value"
      AWS_REGION="$2"
      shift 2
      ;;
    --env-file)
      [[ $# -ge 2 ]] || fail "--env-file requires a path"
      ENV_FILE="$2"
      shift 2
      ;;
    --username)
      [[ $# -ge 2 ]] || fail "--username requires a value"
      USERNAME="$2"
      shift 2
      ;;
    --apply)
      APPLY=1
      shift
      ;;
    --yes)
      YES=1
      shift
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

case "$ENV_NAME" in
  dev)
    DEFAULT_ENV_FILE="$ROOT_DIR/.env"
    DEFAULT_PROFILE="nwac-test"
    ;;
  test)
    DEFAULT_ENV_FILE="$ROOT_DIR/.env.test"
    DEFAULT_PROFILE="nwac-test"
    ;;
  prod)
    DEFAULT_ENV_FILE="$ROOT_DIR/.env.production"
    DEFAULT_PROFILE="nwac-prod"
    ;;
  *)
    fail "--env must be one of: dev, test, prod"
    ;;
esac

ENV_FILE="${ENV_FILE:-$DEFAULT_ENV_FILE}"
PROFILE="${PROFILE:-$DEFAULT_PROFILE}"

command -v aws >/dev/null 2>&1 || fail "aws CLI not found in PATH"
command -v python3 >/dev/null 2>&1 || fail "python3 not found in PATH"
[[ -f "$ENV_FILE" ]] || fail "Env file not found: $ENV_FILE"

read_env_value_optional() {
  local key="$1"
  local file="$2"
  sed -n "s/^${key}=//p" "$file" | tail -n 1 | tr -d '\r'
}

if [[ -z "$POOL_ID" ]]; then
  POOL_ID="$(read_env_value_optional COGNITO_STAFF_USER_POOL_ID "$ENV_FILE")"
  POOL_ID="${POOL_ID:-$(read_env_value_optional COGNITO_USER_POOL_ID "$ENV_FILE")}"
fi
[[ -n "$POOL_ID" ]] || fail "Could not resolve Cognito pool ID from $ENV_FILE; pass --pool-id"

if [[ "$APPLY" -eq 1 && "$YES" -ne 1 ]]; then
  fail "--apply requires --yes"
fi

if [[ "$APPLY" -eq 1 && "$ENV_NAME" == "prod" ]]; then
  printf 'About to clear deprecated custom attributes in PROD pool %s using profile %s.\n' "$POOL_ID" "$PROFILE" >&2
fi

TMP_JSON="$(mktemp)"
TMP_TSV="$(mktemp)"
cleanup() {
  rm -f "$TMP_JSON" "$TMP_TSV"
}
trap cleanup EXIT

export AWS_PAGER=""
export AWS_CLI_AUTO_PROMPT="off"

if [[ -n "$USERNAME" ]]; then
  aws cognito-idp admin-get-user \
    --user-pool-id "$POOL_ID" \
    --username "$USERNAME" \
    --region "$AWS_REGION" \
    --profile "$PROFILE" \
    --output json > "$TMP_JSON"
else
  aws cognito-idp list-users \
    --user-pool-id "$POOL_ID" \
    --region "$AWS_REGION" \
    --profile "$PROFILE" \
    --output json > "$TMP_JSON"
fi

python3 - "$TMP_JSON" > "$TMP_TSV" <<'PY'
import json
import sys

path = sys.argv[1]
with open(path, "r", encoding="utf-8") as handle:
    payload = json.load(handle)

if "Users" in payload:
    users = payload.get("Users") or []
else:
    users = [{
        "Username": payload.get("Username"),
        "Attributes": payload.get("UserAttributes") or [],
    }]

for user in users:
    attrs = {item.get("Name"): item.get("Value", "") for item in user.get("Attributes") or []}
    region_id = attrs.get("custom:region_id", "")
    user_id = attrs.get("custom:user_id", "")
    if not region_id and not user_id:
        continue
    print("\t".join([
        user.get("Username") or "",
        attrs.get("email", ""),
        region_id,
        user_id,
    ]))
PY

COUNT="$(wc -l < "$TMP_TSV" | tr -d ' ')"

printf 'Environment: %s\n' "$ENV_NAME"
printf 'AWS profile: %s\n' "$PROFILE"
printf 'User pool: %s\n' "$POOL_ID"
printf 'Mode: %s\n' "$([[ "$APPLY" -eq 1 ]] && printf 'apply' || printf 'dry-run')"
printf 'Users with deprecated custom attribute values: %s\n' "$COUNT"

if [[ "$COUNT" -eq 0 ]]; then
  exit 0
fi

printf '\nusername\temail\tcustom:region_id\tcustom:user_id\n'
cat "$TMP_TSV"

if [[ "$APPLY" -ne 1 ]]; then
  printf '\nDry run only. Re-run with --apply --yes to clear these per-user values.\n'
  exit 0
fi

while IFS= read -r line; do
  user="$(printf '%s\n' "$line" | awk -F '\t' '{print $1}')"
  region_id="$(printf '%s\n' "$line" | awk -F '\t' '{print $3}')"
  user_id="$(printf '%s\n' "$line" | awk -F '\t' '{print $4}')"
  attrs=()
  [[ -n "$region_id" ]] && attrs+=("custom:region_id")
  [[ -n "$user_id" ]] && attrs+=("custom:user_id")
  [[ "${#attrs[@]}" -gt 0 ]] || continue

  aws cognito-idp admin-delete-user-attributes \
    --user-pool-id "$POOL_ID" \
    --username "$user" \
    --user-attribute-names "${attrs[@]}" \
    --region "$AWS_REGION" \
    --profile "$PROFILE" \
    --output json >/dev/null
  printf 'Cleared %s for %s\n' "${attrs[*]}" "$user"
done < "$TMP_TSV"
