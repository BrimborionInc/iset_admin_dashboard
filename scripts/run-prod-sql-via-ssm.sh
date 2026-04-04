#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Run ad-hoc SQL against the NWAC prod database via SSM on a live prod app host.

Usage:
  scripts/run-prod-sql-via-ssm.sh --sql "SELECT 1;"
  scripts/run-prod-sql-via-ssm.sh --sql-file /path/to/query.sql
  printf 'SELECT 1;\n' | scripts/run-prod-sql-via-ssm.sh

Options:
  --sql TEXT          SQL text to execute.
  --sql-file PATH     Path to a SQL file to execute.
  --s3-bucket NAME    Temporary S3 bucket for large SQL files. Default: nwac-prod-artifacts
  --s3-key-prefix KEY Temporary S3 key prefix for large SQL files. Default: ssm-sql
  --instance-id ID    Override the auto-discovered SSM target instance.
  --profile NAME      AWS profile to use. Default: nwac-prod
  --region REGION     AWS region to use. Default: ca-central-1
  --asg-name NAME     Auto Scaling Group to inspect. Default: nwac-prod-asg
  --db-secret-id ID   Secrets Manager secret for DB credentials. Default: nwac-prod-db-credentials
  --db-host HOST      Aurora writer/cluster endpoint. Default: nwac-prod-db.cluster-c3g4iamg8j38.ca-central-1.rds.amazonaws.com
  --db-name NAME      Database name. Default: iset_intake
  --db-port PORT      Database port. Default: 3306
  --help              Show this help text.
EOF
}

AWS_PROFILE="nwac-prod"
AWS_REGION="ca-central-1"
ASG_NAME="nwac-prod-asg"
S3_BUCKET="nwac-prod-artifacts"
S3_KEY_PREFIX="ssm-sql"
DB_SECRET_ID="nwac-prod-db-credentials"
DB_HOST="nwac-prod-db.cluster-c3g4iamg8j38.ca-central-1.rds.amazonaws.com"
DB_NAME="iset_intake"
DB_PORT="3306"
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
    --s3-bucket)
      [[ $# -ge 2 ]] || fail "--s3-bucket requires a value"
      S3_BUCKET="$2"
      shift 2
      ;;
    --s3-key-prefix)
      [[ $# -ge 2 ]] || fail "--s3-key-prefix requires a value"
      S3_KEY_PREFIX="$2"
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

command -v aws >/dev/null 2>&1 || fail "aws CLI not found in PATH"

LOCAL_PY_BIN="python3"
if ! command -v "$LOCAL_PY_BIN" >/dev/null 2>&1; then
  LOCAL_PY_BIN="python"
fi
command -v "$LOCAL_PY_BIN" >/dev/null 2>&1 || fail "python3/python not found in PATH"

if [[ -n "$SQL_TEXT" && -n "$SQL_FILE" ]]; then
  fail "Use either --sql or --sql-file, not both"
fi

SQL_SOURCE_MODE="inline"
TEMP_SQL_S3_KEY=""

if [[ -n "$SQL_FILE" ]]; then
  [[ -f "$SQL_FILE" ]] || fail "SQL file not found: $SQL_FILE"
  SQL_SOURCE_MODE="s3-file"
elif [[ -z "$SQL_TEXT" && ! -t 0 ]]; then
  SQL_TEXT="$(cat)"
fi

if [[ "$SQL_SOURCE_MODE" == "inline" ]]; then
  [[ -n "$SQL_TEXT" ]] || fail "No SQL provided. Use --sql, --sql-file, or stdin."
fi

if [[ -z "$INSTANCE_ID" ]]; then
  INSTANCE_ID="$(discover_instance_id)" || fail "Unable to find an online SSM-managed instance in ASG '$ASG_NAME'"
fi

REMOTE_SQL="/tmp/codex-prod-sql-$(date +%s)-$$.sql"
PARAMS_FILE="$(mktemp)"
cleanup() {
  rm -f "$PARAMS_FILE"
  if [[ -n "$TEMP_SQL_S3_KEY" ]]; then
    aws s3 rm "s3://$S3_BUCKET/$TEMP_SQL_S3_KEY" \
      --region "$AWS_REGION" \
      --profile "$AWS_PROFILE" \
      --only-show-errors >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ "$SQL_SOURCE_MODE" == "s3-file" ]]; then
  TEMP_SQL_S3_KEY="$S3_KEY_PREFIX/$(date +%Y%m%d-%H%M%S)-$$-$(basename "$SQL_FILE")"
  aws s3 cp "$SQL_FILE" "s3://$S3_BUCKET/$TEMP_SQL_S3_KEY" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE" \
    --only-show-errors >/dev/null
fi

if [[ "$SQL_SOURCE_MODE" == "inline" ]]; then
  SQL_B64="$(printf '%s' "$SQL_TEXT" | base64 | tr -d '\n')"
  REMOTE_COMMANDS=(
    "set -euo pipefail"
    "if ! command -v mysql >/dev/null 2>&1; then if command -v dnf >/dev/null 2>&1; then sudo dnf install -y mariadb105 >/dev/null 2>&1 || sudo dnf install -y mariadb >/dev/null 2>&1; elif command -v yum >/dev/null 2>&1; then sudo yum install -y mariadb >/dev/null 2>&1; else echo 'mysql client not found on target host and no supported package manager is available' >&2; exit 127; fi; fi"
    "if ! command -v python3 >/dev/null 2>&1 && ! command -v python >/dev/null 2>&1; then echo 'python3/python not available on target host for secret parsing' >&2; exit 127; fi"
    "printf '%s' $(shell_quote "$SQL_B64") | base64 -d > $(shell_quote "$REMOTE_SQL")"
    "SECRET_PAYLOAD=\$(aws secretsmanager get-secret-value --secret-id $(shell_quote "$DB_SECRET_ID") --region $(shell_quote "$AWS_REGION") --query SecretString --output text)"
    "PY_BIN=python3; command -v python3 >/dev/null 2>&1 || PY_BIN=python"
    "DB_USER=\$(printf '%s' \"\$SECRET_PAYLOAD\" | \$PY_BIN -c 'import json,sys; print(json.loads(sys.stdin.read()).get(\"username\", \"\"))')"
    "DB_PASS=\$(printf '%s' \"\$SECRET_PAYLOAD\" | \$PY_BIN -c 'import json,sys; print(json.loads(sys.stdin.read()).get(\"password\", \"\"))')"
    "MYSQL_PWD=\"\$DB_PASS\" mysql -h $(shell_quote "$DB_HOST") -P $(shell_quote "$DB_PORT") -u \"\$DB_USER\" $(shell_quote "$DB_NAME") < $(shell_quote "$REMOTE_SQL")"
    "rm -f $(shell_quote "$REMOTE_SQL")"
  )
else
  REMOTE_COMMANDS=(
    "set -euo pipefail"
    "command -v aws >/dev/null 2>&1 || { echo 'aws CLI not found on target host' >&2; exit 127; }"
    "if ! command -v mysql >/dev/null 2>&1; then if command -v dnf >/dev/null 2>&1; then sudo dnf install -y mariadb105 >/dev/null 2>&1 || sudo dnf install -y mariadb >/dev/null 2>&1; elif command -v yum >/dev/null 2>&1; then sudo yum install -y mariadb >/dev/null 2>&1; else echo 'mysql client not found on target host and no supported package manager is available' >&2; exit 127; fi; fi"
    "if ! command -v python3 >/dev/null 2>&1 && ! command -v python >/dev/null 2>&1; then echo 'python3/python not available on target host for secret parsing' >&2; exit 127; fi"
    "aws s3 cp s3://$S3_BUCKET/$TEMP_SQL_S3_KEY $(shell_quote "$REMOTE_SQL") --region $(shell_quote "$AWS_REGION") --only-show-errors"
    "SECRET_PAYLOAD=\$(aws secretsmanager get-secret-value --secret-id $(shell_quote "$DB_SECRET_ID") --region $(shell_quote "$AWS_REGION") --query SecretString --output text)"
    "PY_BIN=python3; command -v python3 >/dev/null 2>&1 || PY_BIN=python"
    "DB_USER=\$(printf '%s' \"\$SECRET_PAYLOAD\" | \$PY_BIN -c 'import json,sys; print(json.loads(sys.stdin.read()).get(\"username\", \"\"))')"
    "DB_PASS=\$(printf '%s' \"\$SECRET_PAYLOAD\" | \$PY_BIN -c 'import json,sys; print(json.loads(sys.stdin.read()).get(\"password\", \"\"))')"
    "MYSQL_PWD=\"\$DB_PASS\" mysql -h $(shell_quote "$DB_HOST") -P $(shell_quote "$DB_PORT") -u \"\$DB_USER\" $(shell_quote "$DB_NAME") < $(shell_quote "$REMOTE_SQL")"
    "rm -f $(shell_quote "$REMOTE_SQL")"
  )
fi

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
  --comment "Codex prod DB SQL" \
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
