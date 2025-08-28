#!/usr/bin/env bash
set -euo pipefail
WS="${1:-dev}"
echo "Workspace: $WS"
./scripts/package-post-confirmation.sh
terraform init -upgrade
terraform workspace select "$WS" 2>/dev/null || terraform workspace new "$WS"
terraform fmt -check
terraform validate
if [ "${PLAN_ONLY:-false}" = "true" ]; then
  terraform plan
else
  terraform plan -out=plan.tfplan
  terraform apply -auto-approve plan.tfplan
fi
