#!/usr/bin/env bash
#
# Bootstrap script for NWAC test environment application instances.
# This script is designed to be used as EC2 user data (AL2023) or invoked manually via SSM.
#
# Responsibilities:
#   - Install runtime prerequisites (Node.js, pm2, awscli, jq, unzip)
#   - Fetch environment configuration from SSM and Secrets Manager
#   - Render admin and portal `.env` files under /opt/nwac/*
#   - Download application artifacts from S3 and unpack them
#   - Start services under pm2 and expose /healthz
#
# NOTE: This script is drafted for review and testing; it is not yet wired into Terraform.

set -euo pipefail
IFS=$'\n\t'

LOG_FILE="/var/log/nwac-bootstrap.log"
mkdir -p "$(dirname "$LOG_FILE")"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "[$(date --iso-8601=seconds)] Starting NWAC bootstrap..."

ADMIN_ENV_PARAMETER="/nwac/test/admin/env"
PORTAL_ENV_PARAMETER="/nwac/test/portal/env"
DB_SECRET_ID="${DB_SECRET_ID:-nwac-test-db-credentials}"

# Pre-built artifacts (uploaded from workstation)
ADMIN_ARTIFACT_S3_URI="s3://nwac-test-artifacts/bootstrap/admin-dashboard-latest.zip"
PORTAL_ARTIFACT_S3_URI="s3://nwac-test-artifacts/bootstrap/portal-latest.zip"
SHARED_ARTIFACT_S3_URI="s3://nwac-test-artifacts/shared/shared-20251008155220.zip"

ADMIN_ROOT="/opt/nwac/admin-dashboard"
PORTAL_ROOT="/opt/nwac/portal"
SHARED_ROOT="/opt/nwac/shared"
CONFIG_DUMP_DIR="/opt/nwac/config"

AWS_REGION="${AWS_REGION:-ca-central-1}"
NODE_VERSION="${NODE_VERSION:-20.20.2}"
NODE_LINUX_X64_SHA256="${NODE_LINUX_X64_SHA256:-df770b2a6f130ed8627c9782c988fda9669fa23898329a61a871e32f965e007d}"

log() {
  echo "[$(date --iso-8601=seconds)] $*"
}

retry() {
  local attempts=$1
  local delay=$2
  shift 2
  local cmd=("$@")

  for attempt in $(seq 1 "$attempts"); do
    if "${cmd[@]}"; then
      return 0
    fi
    log "Command failed (attempt $attempt/$attempts): ${cmd[*]}"
    if [ "$attempt" -lt "$attempts" ]; then
      sleep "$delay"
    fi
  done

  return 1
}

ensure_packages() {
  log "Installing prerequisite packages..."
  sudo dnf update -y >/dev/null

  local node_archive node_install_dir npm_prefix
  node_archive="$(mktemp --suffix=.tar.xz)"
  node_install_dir="/usr/local/lib/nodejs/node-v${NODE_VERSION}-linux-x64"

  if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(`.`)[0]')" -ne 20 ]; then
    log "Installing verified Node.js ${NODE_VERSION} runtime..."
    retry 5 5 curl -fsSL \
      "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
      -o "$node_archive"
    echo "${NODE_LINUX_X64_SHA256}  ${node_archive}" | sha256sum -c -
    sudo mkdir -p /usr/local/lib/nodejs
    sudo tar -xJf "$node_archive" -C /usr/local/lib/nodejs
    sudo ln -sfn "${node_install_dir}/bin/node" /usr/local/bin/node
    sudo ln -sfn "${node_install_dir}/bin/npm" /usr/local/bin/npm
    sudo ln -sfn "${node_install_dir}/bin/npx" /usr/local/bin/npx
    sudo ln -sfn "${node_install_dir}/bin/corepack" /usr/local/bin/corepack
  fi
  rm -f "$node_archive"

  sudo dnf install -y awscli jq unzip >/dev/null
  sudo npm install -g pm2 >/dev/null
  npm_prefix="$(npm prefix -g)"
  sudo ln -sfn "${npm_prefix}/bin/pm2" /usr/local/bin/pm2
  sudo ln -sfn "${npm_prefix}/bin/pm2-runtime" /usr/local/bin/pm2-runtime
  sudo ln -sfn "${npm_prefix}/bin/pm2-dev" /usr/local/bin/pm2-dev
}

fetch_env_parameter() {
  local parameter_name="$1"
  retry 5 5 aws ssm get-parameter \
    --name "$parameter_name" \
    --with-decryption \
    --query 'Parameter.Value' \
    --output text \
    --region "$AWS_REGION"
}

render_env_file() {
  local env_json="$1"
  local output_path="$2"

  tmp="$(mktemp)"
  echo "$env_json" >"$tmp"
  jq -r 'to_entries[] | "\(.key)=\(.value)"' "$tmp" | sudo tee "$output_path" >/dev/null
  rm -f "$tmp"
}

merge_db_credentials() {
  local env_path="$1"
  local secret_json="$2"

  local user pass
  user="$(echo "$secret_json" | jq -r '.username')"
  pass="$(echo "$secret_json" | jq -r '.password')"

  sudo tee -a "$env_path" >/dev/null <<EOF
DB_USER=$user
DB_PASS=$pass
EOF
}

download_artifact() {
  local s3_uri="$1"
  local dest_dir="$2"

  sudo mkdir -p "$dest_dir"
  tmp_zip="$(mktemp)"
  log "Downloading artifact $s3_uri..."
  retry 5 5 aws s3 cp "$s3_uri" "$tmp_zip" --region "$AWS_REGION"
  sudo rm -rf "$dest_dir"
  sudo mkdir -p "$dest_dir"
  sudo unzip -q "$tmp_zip" -d "$dest_dir"
  rm -f "$tmp_zip"
}

download_shared() {
  local s3_uri="$1"
  local dest_dir="$2"

  tmp_dir="$(mktemp -d)"
  tmp_zip="$(mktemp)"
  log "Downloading shared artifact $s3_uri..."
  retry 5 5 aws s3 cp "$s3_uri" "$tmp_zip" --region "$AWS_REGION"
  unzip -q "$tmp_zip" -d "$tmp_dir"
  sudo rm -rf "$dest_dir"
  if [ -d "$tmp_dir/shared" ]; then
    sudo mv "$tmp_dir/shared" "$dest_dir"
  else
    # artifact may already contain files without top-level folder
    sudo mkdir -p "$dest_dir"
    sudo mv "$tmp_dir"/* "$dest_dir"/
  fi
  rm -rf "$tmp_dir" "$tmp_zip"
}

start_service() {
  local name="$1"
  local cwd="$2"
  local script="$3"

  log "Starting $name via pm2..."
  sudo pm2 start "$script" --name "$name" --cwd "$cwd" --update-env
}

main() {
  ensure_packages

  sudo mkdir -p "$ADMIN_ROOT" "$PORTAL_ROOT" "$CONFIG_DUMP_DIR"
  sudo mkdir -p "$(dirname "$SHARED_ROOT")"

  if ! admin_env_json="$(fetch_env_parameter "$ADMIN_ENV_PARAMETER")"; then
    log "Failed to fetch admin env parameter after retries"
    exit 1
  fi
  if ! portal_env_json="$(fetch_env_parameter "$PORTAL_ENV_PARAMETER")"; then
    log "Failed to fetch portal env parameter after retries"
    exit 1
  fi
  if ! db_secret_json="$(retry 5 5 aws secretsmanager get-secret-value --secret-id "$DB_SECRET_ID" --query 'SecretString' --output text --region "$AWS_REGION")"; then
    log "Failed to fetch DB secret after retries"
    exit 1
  fi

  sudo tee "$CONFIG_DUMP_DIR/admin-env.json" >/dev/null <<<"$admin_env_json"
  sudo tee "$CONFIG_DUMP_DIR/portal-env.json" >/dev/null <<<"$portal_env_json"

  download_artifact "$ADMIN_ARTIFACT_S3_URI" "$ADMIN_ROOT"
  download_artifact "$PORTAL_ARTIFACT_S3_URI" "$PORTAL_ROOT"
  download_shared "$SHARED_ARTIFACT_S3_URI" "$SHARED_ROOT"
  if [ -d "$ADMIN_ROOT/shared" ]; then
    log "Using the shared runtime bundled with the admin artifact..."
    sudo rm -rf "$SHARED_ROOT"
    sudo cp -R "$ADMIN_ROOT/shared" "$SHARED_ROOT"
  fi

  render_env_file "$admin_env_json" "$ADMIN_ROOT/.env"
  render_env_file "$portal_env_json" "$PORTAL_ROOT/.env"

  merge_db_credentials "$ADMIN_ROOT/.env" "$db_secret_json"
  merge_db_credentials "$PORTAL_ROOT/.env" "$db_secret_json"

  log "Linking portal artifact so admin server can resolve ../ISET-intake/* modules..."
  sudo ln -sfn "$PORTAL_ROOT" "/opt/nwac/ISET-intake"

  if [ -f "$ADMIN_ROOT/package.json" ]; then
    sudo rm -rf "$ADMIN_ROOT/node_modules"
    if [ -f "$ADMIN_ROOT/package-lock.json" ]; then
      log "Installing admin dependencies with npm ci (omit=dev)..."
      sudo npm ci --omit=dev --prefix "$ADMIN_ROOT" >/dev/null
    else
      log "Installing admin dependencies with npm install (omit=dev)..."
      sudo npm install --omit=dev --prefix "$ADMIN_ROOT" >/dev/null
    fi
  fi

  if [ -f "$PORTAL_ROOT/package.json" ]; then
    sudo rm -rf "$PORTAL_ROOT/node_modules"
    if [ -f "$PORTAL_ROOT/package-lock.json" ]; then
      log "Installing portal dependencies with npm ci (omit=dev)..."
      sudo npm ci --omit=dev --prefix "$PORTAL_ROOT" >/dev/null
    else
      log "Installing portal dependencies with npm install (omit=dev)..."
      sudo npm install --omit=dev --prefix "$PORTAL_ROOT" >/dev/null
    fi
  fi

  start_service "nwac-admin" "$ADMIN_ROOT" "isetadminserver.js"
  start_service "nwac-portal" "$PORTAL_ROOT" "server.js"

  sudo pm2 save >/dev/null

  log "Bootstrap complete. Current pm2 process list:"
  pm2 ls

  log "Reminder: ensure both services implement /healthz on the ALB target port."
}

main "$@"
