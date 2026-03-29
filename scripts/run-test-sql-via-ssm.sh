#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Run ad-hoc SQL against the NWAC test database via SSM on a live test app host.

Usage:
  scripts/run-test-sql-via-ssm.sh --sql "SELECT 1;"
  scripts/run-test-sql-via-ssm.sh --sql-file /path/to/query.sql
  printf 'SELECT 1;\n' | scripts/run-test-sql-via-ssm.sh

Options:
  --sql TEXT          SQL text to execute.
  --sql-file PATH     Path to a SQL file to execute.
  --instance-id ID    Override the auto-discovered SSM target instance.
  --profile NAME      AWS profile to use. Default: nwac-test
  --region REGION     AWS region to use. Default: ca-central-1
  --env-file PATH     Env file for DB_* values. Default: repo-root .env.test
  --help              Show this help text.
EOF
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AWS_PROFILE="nwac-test"
AWS_REGION="ca-central-1"
ENV_FILE="$ROOT_DIR/.env.test"
INSTANCE_ID=""
SQL_FILE=""
SQL_TEXT=""

fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

shell_quote() {
  printf "'%s'" "${1//\'/\'\\\'\'}"
}

read_env_value() {
  local key="$1"
  local file="$2"
  local value

  value="$(sed -n "s/^${key}=//p" "$file" | tail -n 1 | tr -d '\r')"
  [[ -n "$value" ]] || fail "Required key '$key' not found in $file"
  printf '%s' "$value"
}

read_env_value_optional() {
  local key="$1"
  local file="$2"

  sed -n "s/^${key}=//p" "$file" | tail -n 1 | tr -d '\r'
}

discover_instance_id() {
  local ssm_ids ec2_ids ec2_id ssm_id

  ssm_ids="$(aws ssm describe-instance-information \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --query 'InstanceInformationList[?PingStatus==`Online`].InstanceId' \
    --output text)"

  ec2_ids="$(aws ec2 describe-instances \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --filters "Name=tag:Name,Values=nwac-test-app" "Name=instance-state-name,Values=running" \
    --query 'Reservations[].Instances[].InstanceId' \
    --output text)"

  for ec2_id in $ec2_ids; do
    for ssm_id in $ssm_ids; do
      if [[ "$ec2_id" == "$ssm_id" ]]; then
        printf '%s' "$ec2_id"
        return 0
      fi
    done
  done

  return 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sql)
      [[ $# -ge 2 ]] || fail "--sql requires a value"
      SQL_TEXT="$2"
      shift 2
      ;;
    --sql-file)
      [[ $# -ge 2 ]] || fail "--sql-file requires a path"
      SQL_FILE="$2"
      shift 2
      ;;
    --instance-id)
      [[ $# -ge 2 ]] || fail "--instance-id requires a value"
      INSTANCE_ID="$2"
      shift 2
      ;;
    --profile)
      [[ $# -ge 2 ]] || fail "--profile requires a value"
      AWS_PROFILE="$2"
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
[[ -f "$ENV_FILE" ]] || fail "Env file not found: $ENV_FILE"

if [[ -n "$SQL_TEXT" && -n "$SQL_FILE" ]]; then
  fail "Use either --sql or --sql-file, not both"
fi

if [[ -n "$SQL_FILE" ]]; then
  [[ -f "$SQL_FILE" ]] || fail "SQL file not found: $SQL_FILE"
  SQL_TEXT="$(cat "$SQL_FILE")"
elif [[ -z "$SQL_TEXT" && ! -t 0 ]]; then
  SQL_TEXT="$(cat)"
fi

[[ -n "$SQL_TEXT" ]] || fail "No SQL provided. Use --sql, --sql-file, or stdin."

DB_HOST="$(read_env_value DB_HOST "$ENV_FILE")"
DB_PORT="$(read_env_value_optional DB_PORT "$ENV_FILE")"
DB_USER="$(read_env_value DB_USER "$ENV_FILE")"
DB_PASS="$(read_env_value DB_PASS "$ENV_FILE")"
DB_NAME="$(read_env_value DB_NAME "$ENV_FILE")"
DB_PORT="${DB_PORT:-3306}"

if [[ -z "$INSTANCE_ID" ]]; then
  INSTANCE_ID="$(discover_instance_id)" || fail "Unable to find an online SSM-managed nwac-test-app instance"
fi

SQL_B64="$(printf '%s' "$SQL_TEXT" | base64 | tr -d '\n')"
REMOTE_SQL="/tmp/codex-test-sql-$(date +%s)-$$.sql"
PARAMS_FILE="$(mktemp)"
trap 'rm -f "$PARAMS_FILE"' EXIT

cat > "$PARAMS_FILE" <<JSON
{"commands":[
"set -euo pipefail",
"if ! command -v mysql >/dev/null 2>&1; then if command -v dnf >/dev/null 2>&1; then dnf install -y mariadb105 >/dev/null 2>&1 || dnf install -y mariadb >/dev/null 2>&1; elif command -v yum >/dev/null 2>&1; then yum install -y mariadb >/dev/null 2>&1; else echo 'mysql client not found on target host and no supported package manager is available' >&2; exit 127; fi; fi",
"printf '%s' '$(printf '%s' "$SQL_B64")' | base64 -d > $(shell_quote "$REMOTE_SQL")",
"MYSQL_PWD=$(shell_quote "$DB_PASS") mysql -h $(shell_quote "$DB_HOST") -P $(shell_quote "$DB_PORT") -u $(shell_quote "$DB_USER") $(shell_quote "$DB_NAME") < $(shell_quote "$REMOTE_SQL")",
"rm -f $(shell_quote "$REMOTE_SQL")"
]}
JSON

export AWS_PAGER=""
export AWS_CLI_AUTO_PROMPT="off"

COMMAND_ID="$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --parameters "file://$PARAMS_FILE" \
  --comment "Codex test DB SQL" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --query 'Command.CommandId' \
  --output text)"

printf 'Running SQL on %s via SSM command %s\n' "$INSTANCE_ID" "$COMMAND_ID" >&2

while true; do
  STATUS="$(aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --query 'Status' \
    --output text 2>/dev/null || true)"

  case "$STATUS" in
    Pending|InProgress|Delayed|"")
      sleep 2
      ;;
    Success)
      aws ssm get-command-invocation \
        --command-id "$COMMAND_ID" \
        --instance-id "$INSTANCE_ID" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'StandardOutputContent' \
        --output text
      STDERR_CONTENT="$(aws ssm get-command-invocation \
        --command-id "$COMMAND_ID" \
        --instance-id "$INSTANCE_ID" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'StandardErrorContent' \
        --output text)"
      if [[ "$STDERR_CONTENT" != "None" && -n "$STDERR_CONTENT" ]]; then
        printf '%s\n' "$STDERR_CONTENT" >&2
      fi
      exit 0
      ;;
    *)
      aws ssm get-command-invocation \
        --command-id "$COMMAND_ID" \
        --instance-id "$INSTANCE_ID" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'StandardOutputContent' \
        --output text
      aws ssm get-command-invocation \
        --command-id "$COMMAND_ID" \
        --instance-id "$INSTANCE_ID" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        --query 'StandardErrorContent' \
        --output text >&2
      fail "SSM command finished with status: $STATUS"
      ;;
  esac
done
