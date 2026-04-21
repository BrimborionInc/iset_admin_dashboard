#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Create a SQL dump from the NWAC test or prod database via SSM on a live app host and upload it to S3.

Usage:
  scripts/run-db-dump-via-ssm.sh --env test
  scripts/run-db-dump-via-ssm.sh --env prod --s3-key db-dumps/custom/prod.sql.gz

Options:
  --env NAME          Target environment: test or prod. Required.
  --s3-bucket NAME    S3 bucket for the dump object. Defaults by env:
                      test -> nwac-test-artifacts
                      prod -> nwac-prod-artifacts
  --s3-key KEY        Exact S3 object key to write. Default:
                      db-dumps/<env>/<timestamp>-iset_intake.sql.gz
  --instance-id ID    Override the auto-discovered SSM target instance.
  --profile NAME      AWS profile override. Defaults by env.
  --region REGION     AWS region. Default: ca-central-1
  --asg-name NAME     Auto Scaling Group override. Defaults by env.
  --db-secret-id ID   Secrets Manager secret override. Defaults by env.
  --db-host HOST      Aurora writer/cluster endpoint override. Defaults by env.
  --db-name NAME      Database name. Default: iset_intake
  --db-port PORT      Database port. Default: 3306
  --help              Show this help text.
EOF
}

AWS_REGION="ca-central-1"
ENV_NAME=""
AWS_PROFILE=""
ASG_NAME=""
DB_SECRET_ID=""
DB_HOST=""
DB_NAME="iset_intake"
DB_PORT="3306"
INSTANCE_ID=""
S3_BUCKET=""
S3_KEY=""

fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

shell_quote() {
  printf "'%s'" "${1//\'/\'\\\'\'}"
}

set_defaults_for_env() {
  case "$1" in
    test)
      AWS_PROFILE="${AWS_PROFILE:-nwac-test}"
      ASG_NAME="${ASG_NAME:-nwac-test-asg}"
      DB_SECRET_ID="${DB_SECRET_ID:-nwac-test-db-credentials}"
      DB_HOST="${DB_HOST:-nwac-test-db.cluster-cn4yoy2s4w5t.ca-central-1.rds.amazonaws.com}"
      S3_BUCKET="${S3_BUCKET:-nwac-test-artifacts}"
      ;;
    prod)
      AWS_PROFILE="${AWS_PROFILE:-nwac-prod}"
      ASG_NAME="${ASG_NAME:-nwac-prod-asg}"
      DB_SECRET_ID="${DB_SECRET_ID:-nwac-prod-db-credentials}"
      DB_HOST="${DB_HOST:-nwac-prod-db.cluster-c3g4iamg8j38.ca-central-1.rds.amazonaws.com}"
      S3_BUCKET="${S3_BUCKET:-nwac-prod-artifacts}"
      ;;
    *)
      fail "--env must be one of: test, prod"
      ;;
  esac
}

discover_instance_id() {
  local ssm_ids asg_ids asg_id ssm_id

  ssm_ids="$(aws ssm describe-instance-information \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --query 'InstanceInformationList[?PingStatus==`Online`].InstanceId' \
    --output text)"

  asg_ids="$(aws autoscaling describe-auto-scaling-groups \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --auto-scaling-group-names "$ASG_NAME" \
    --query 'AutoScalingGroups[0].Instances[?LifecycleState==`InService`].InstanceId' \
    --output text)"

  for asg_id in $asg_ids; do
    for ssm_id in $ssm_ids; do
      if [[ "$asg_id" == "$ssm_id" ]]; then
        printf '%s' "$asg_id"
        return 0
      fi
    done
  done

  return 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      [[ $# -ge 2 ]] || fail "--env requires a value"
      ENV_NAME="$2"
      shift 2
      ;;
    --s3-bucket)
      [[ $# -ge 2 ]] || fail "--s3-bucket requires a value"
      S3_BUCKET="$2"
      shift 2
      ;;
    --s3-key)
      [[ $# -ge 2 ]] || fail "--s3-key requires a value"
      S3_KEY="$2"
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
    --asg-name)
      [[ $# -ge 2 ]] || fail "--asg-name requires a value"
      ASG_NAME="$2"
      shift 2
      ;;
    --db-secret-id)
      [[ $# -ge 2 ]] || fail "--db-secret-id requires a value"
      DB_SECRET_ID="$2"
      shift 2
      ;;
    --db-host)
      [[ $# -ge 2 ]] || fail "--db-host requires a value"
      DB_HOST="$2"
      shift 2
      ;;
    --db-name)
      [[ $# -ge 2 ]] || fail "--db-name requires a value"
      DB_NAME="$2"
      shift 2
      ;;
    --db-port)
      [[ $# -ge 2 ]] || fail "--db-port requires a value"
      DB_PORT="$2"
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

[[ -n "$ENV_NAME" ]] || fail "--env is required"

command -v aws >/dev/null 2>&1 || fail "aws CLI not found in PATH"

LOCAL_PY_BIN="python3"
if ! command -v "$LOCAL_PY_BIN" >/dev/null 2>&1; then
  LOCAL_PY_BIN="python"
fi
command -v "$LOCAL_PY_BIN" >/dev/null 2>&1 || fail "python3/python not found in PATH"

set_defaults_for_env "$ENV_NAME"

if [[ -z "$S3_KEY" ]]; then
  S3_KEY="db-dumps/$ENV_NAME/$(date +%Y%m%d-%H%M%S)-$DB_NAME.sql.gz"
fi

if [[ -z "$INSTANCE_ID" ]]; then
  INSTANCE_ID="$(discover_instance_id)" || fail "Unable to find an online SSM-managed instance in ASG '$ASG_NAME'"
fi

CALLER_AWS_ACCESS_KEY_ID=""
CALLER_AWS_SECRET_ACCESS_KEY=""
CALLER_AWS_SESSION_TOKEN=""

exported_creds="$(aws configure export-credentials --profile "$AWS_PROFILE" --format env-no-export 2>/dev/null || true)"
if [[ -z "$exported_creds" ]]; then
  fail "Unable to export AWS credentials for profile '$AWS_PROFILE'"
fi

while IFS='=' read -r key value; do
  case "$key" in
    AWS_ACCESS_KEY_ID)
      CALLER_AWS_ACCESS_KEY_ID="$value"
      ;;
    AWS_SECRET_ACCESS_KEY)
      CALLER_AWS_SECRET_ACCESS_KEY="$value"
      ;;
    AWS_SESSION_TOKEN)
      CALLER_AWS_SESSION_TOKEN="$value"
      ;;
  esac
done <<< "$exported_creds"

[[ -n "$CALLER_AWS_ACCESS_KEY_ID" ]] || fail "Unable to resolve AWS_ACCESS_KEY_ID for profile '$AWS_PROFILE'"
[[ -n "$CALLER_AWS_SECRET_ACCESS_KEY" ]] || fail "Unable to resolve AWS_SECRET_ACCESS_KEY for profile '$AWS_PROFILE'"

REMOTE_DUMP="/tmp/$(basename "$S3_KEY")"
PARAMS_FILE="$(mktemp)"
trap 'rm -f "$PARAMS_FILE"' EXIT

REMOTE_COMMANDS=(
  "set -euo pipefail"
  "command -v aws >/dev/null 2>&1 || { echo 'aws CLI not found on target host' >&2; exit 127; }"
  "if ! command -v mysqldump >/dev/null 2>&1; then if command -v dnf >/dev/null 2>&1; then sudo dnf install -y mariadb105 >/dev/null 2>&1 || sudo dnf install -y mariadb >/dev/null 2>&1; elif command -v yum >/dev/null 2>&1; then sudo yum install -y mariadb >/dev/null 2>&1; else echo 'mysqldump not found on target host and no supported package manager is available' >&2; exit 127; fi; fi"
  "if ! command -v gzip >/dev/null 2>&1; then echo 'gzip not found on target host' >&2; exit 127; fi"
  "if ! command -v python3 >/dev/null 2>&1 && ! command -v python >/dev/null 2>&1; then echo 'python3/python not available on target host for secret parsing' >&2; exit 127; fi"
  "SECRET_PAYLOAD=\$(aws secretsmanager get-secret-value --secret-id $(shell_quote "$DB_SECRET_ID") --region $(shell_quote "$AWS_REGION") --query SecretString --output text)"
  "PY_BIN=python3; command -v python3 >/dev/null 2>&1 || PY_BIN=python"
  "DB_USER=\$(printf '%s' \"\$SECRET_PAYLOAD\" | \$PY_BIN -c 'import json,sys; print(json.loads(sys.stdin.read()).get(\"username\", \"\"))')"
  "DB_PASS=\$(printf '%s' \"\$SECRET_PAYLOAD\" | \$PY_BIN -c 'import json,sys; print(json.loads(sys.stdin.read()).get(\"password\", \"\"))')"
  "test -n \"\$DB_USER\" && test -n \"\$DB_PASS\" || { echo 'secret missing username/password' >&2; exit 1; }"
  "MYSQL_PWD=\"\$DB_PASS\" mysqldump --protocol TCP --ssl -h $(shell_quote "$DB_HOST") -P $(shell_quote "$DB_PORT") -u \"\$DB_USER\" --single-transaction --quick --routines --triggers --events --hex-blob --default-character-set=utf8mb4 --no-tablespaces $(shell_quote "$DB_NAME") | gzip -c > $(shell_quote "$REMOTE_DUMP")"
  "AWS_ACCESS_KEY_ID=$(shell_quote "$CALLER_AWS_ACCESS_KEY_ID") AWS_SECRET_ACCESS_KEY=$(shell_quote "$CALLER_AWS_SECRET_ACCESS_KEY") AWS_SESSION_TOKEN=$(shell_quote "$CALLER_AWS_SESSION_TOKEN") aws s3 cp $(shell_quote "$REMOTE_DUMP") s3://$S3_BUCKET/$S3_KEY --region $(shell_quote "$AWS_REGION") --only-show-errors"
  "rm -f $(shell_quote "$REMOTE_DUMP")"
)

"$LOCAL_PY_BIN" - "$PARAMS_FILE" "${REMOTE_COMMANDS[@]}" <<'PY'
import json
import sys

path = sys.argv[1]
commands = sys.argv[2:]

with open(path, 'w', encoding='utf-8') as handle:
    json.dump({"commands": commands}, handle)
PY

export AWS_PAGER=""
export AWS_CLI_AUTO_PROMPT="off"

COMMAND_ID="$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --parameters "file://$PARAMS_FILE" \
  --comment "Codex $ENV_NAME DB dump" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE" \
  --query 'Command.CommandId' \
  --output text)"

printf 'Creating %s DB dump on %s via SSM command %s\n' "$ENV_NAME" "$INSTANCE_ID" "$COMMAND_ID" >&2

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
      sleep 5
      ;;
    Success)
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
      printf '{"env":"%s","profile":"%s","instanceId":"%s","bucket":"%s","key":"%s","commandId":"%s"}\n' \
        "$ENV_NAME" "$AWS_PROFILE" "$INSTANCE_ID" "$S3_BUCKET" "$S3_KEY" "$COMMAND_ID"
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
