<#
.SYNOPSIS
    Deploy the NWAC test database snapshot.

.DESCRIPTION
    This script is being rebuilt incrementally. Each section will be added, tested,
    and extended to safely restore the test database and restart the application
    services.
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

### Configuration #############################################################
$SnapshotPath    = 'X:\ISET\admin-dashboard\docs\data\snapshot.sql'
$Region          = 'ca-central-1'
$Bucket          = 'nwac-test-artifacts'
$KeyPrefix       = 'db'
$DbName          = 'iset_intake'
$SecretId        = 'arn:aws:secretsmanager:ca-central-1:124355655255:secret:nwac-test-db-credentials-ZHQOaz'
$RestoreInstance = 'i-0cb3962e4999c5b22'  # Instance with network access to Aurora + SSM access

### Helpers ###################################################################
function Write-Section {
    param(
        [Parameter(Mandatory = $true)][string]$Message
    )

    Write-Host ''
    Write-Host ("=== {0} ===" -f $Message) -ForegroundColor Cyan
}

function Ensure-Tool {
    param(
        [Parameter(Mandatory = $true)][string]$Name
    )

    if (-not (Get-Command -Name $Name -ErrorAction SilentlyContinue)) {
        throw "Required tool '$Name' not found in PATH."
    }
}

function Invoke-AwsCli {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    $renderedArgs = $Arguments -join ' '
    $previousErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'

    try {
        $output = & aws @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    } catch {
        $exitCode = 1
        $output = $_.Exception.Message
    } finally {
        $ErrorActionPreference = $previousErrorPreference
    }

    if ($exitCode -ne 0) {
        throw "aws $renderedArgs failed: $output"
    }

    if ($output -is [System.Array]) {
        return ($output -join [Environment]::NewLine)
    }

    return [string]$output
}

function Wait-SsmCommand {
    param(
        [Parameter(Mandatory = $true)][string]$CommandId,
        [Parameter(Mandatory = $true)][string]$InstanceId,
        [Parameter(Mandatory = $true)][string]$Region,
        [int]$PollSeconds = 5
    )

    while ($true) {
        Start-Sleep -Seconds $PollSeconds

        $statusJson = Invoke-AwsCli -Arguments @(
            'ssm', 'get-command-invocation',
            '--command-id', $CommandId,
            '--instance-id', $InstanceId,
            '--region', $Region,
            '--output', 'json'
        )

        $status = $statusJson | ConvertFrom-Json
        switch ($status.Status) {
            'Pending'   { continue }
            'InProgress'{ continue }
            'Delayed'   { continue }
            'Success'   {
                if ($status.StandardOutputContent) {
                    Write-Host $status.StandardOutputContent.Trim()
                }
                if ($status.StandardErrorContent) {
                    Write-Warning $status.StandardErrorContent.Trim()
                }
                return
            }
            'Cancelled' { throw "SSM command $CommandId was cancelled." }
            'TimedOut'  { throw "SSM command $CommandId timed out." }
            default     {
                $stderr = $status.StandardErrorContent
                throw "SSM command $CommandId failed on $InstanceId. Status=$($status.Status). StdErr=$stderr"
            }
        }
    }
}

function Invoke-RemoteRestore {
    param(
        [Parameter(Mandatory = $true)][string]$InstanceId,
        [Parameter(Mandatory = $true)][string]$Region,
        [Parameter(Mandatory = $true)][string]$Bucket,
        [Parameter(Mandatory = $true)][string]$Key,
        [Parameter(Mandatory = $true)][string]$SecretId,
        [Parameter(Mandatory = $true)][string]$DbName
    )

    $scriptTemplate = @'
#!/bin/bash
set -euo pipefail

SNAP_BUCKET="__BUCKET__"
SNAP_KEY="__KEY__"
REGION="__REGION__"
SECRET_ID="__SECRET__"
TARGET_DB="__DBNAME__"
RESTORE_FILE="/tmp/$(basename "$SNAP_KEY")"
ORIGINAL_RESTORE_FILE="$RESTORE_FILE"

log() {
  echo "[restore] $1"
}

cleanup() {
  rm -f "$RESTORE_FILE" "$ORIGINAL_RESTORE_FILE" 2>/dev/null || true
}
trap cleanup EXIT

if [[ -z "$SNAP_BUCKET" || -z "$SNAP_KEY" ]]; then
  log "snapshot location not provided"
  exit 1
fi

log "ensuring mysql client"
if ! command -v mysql >/dev/null 2>&1; then
  if command -v dnf >/dev/null 2>&1; then
    PKG="dnf"
  elif command -v yum >/dev/null 2>&1; then
    PKG="yum"
  else
    log "no dnf/yum available; cannot install mysql client"
    exit 2
  fi
  if [[ $(id -u) -ne 0 ]]; then
    SUDO="sudo"
  else
    SUDO=""
  fi
  $SUDO $PKG install -y dnf-plugins-core || true
  $SUDO $PKG install -y https://repo.mysql.com/mysql80-community-release-el9-1.noarch.rpm || true
  $SUDO $PKG install -y mysql-community-client
else
  log "mysql client already present"
fi

log "downloading s3://$SNAP_BUCKET/$SNAP_KEY -> $RESTORE_FILE"
aws s3 cp "s3://$SNAP_BUCKET/$SNAP_KEY" "$RESTORE_FILE" --region "$REGION"

if [[ "$RESTORE_FILE" == *.gz ]]; then
  log "decompressing gzip snapshot"
  gunzip -f "$RESTORE_FILE"
  RESTORE_FILE="${RESTORE_FILE%.gz}"
fi

if ! command -v python3 >/dev/null 2>&1; then
  if command -v python >/dev/null 2>&1; then
    PY_BIN="python"
  else
    log "python3/python not available for secret parsing"
    exit 3
  fi
else
  PY_BIN="python3"
fi

SECRET_PAYLOAD=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ID" \
  --region "$REGION" \
  --query SecretString \
  --output text)

if [[ -z "$SECRET_PAYLOAD" ]]; then
  log "retrieved empty secret payload"
  exit 4
fi

mapfile -t CREDS < <(printf '%s' "$SECRET_PAYLOAD" | "$PY_BIN" - <<'PY'
import json, sys
secret = json.loads(sys.stdin.read())
print(secret.get("host", ""))
print(secret.get("username", ""))
print(secret.get("password", ""))
print(secret.get("dbname", ""))
PY
)

DB_HOST="${CREDS[0]}"
DB_USER="${CREDS[1]}"
DB_PASS="${CREDS[2]}"
DB_NAME_OVERRIDE="${CREDS[3]}"

if [[ -z "$DB_HOST" || -z "$DB_USER" || -z "$DB_PASS" ]]; then
  log "secret missing required fields"
  exit 5
fi

if [[ -n "$DB_NAME_OVERRIDE" ]]; then
  TARGET_DB="$DB_NAME_OVERRIDE"
fi

log "starting restore into database '$TARGET_DB' on '$DB_HOST'"
mysql --host "$DB_HOST" \
      --user "$DB_USER" \
      --password="$DB_PASS" \
      --ssl-mode=REQUIRED \
      --database "$TARGET_DB" < "$RESTORE_FILE"

log "restore completed successfully"
'@

    $scriptBody = (
        $scriptTemplate.
            Replace('__BUCKET__', $Bucket).
            Replace('__KEY__', $Key).
            Replace('__REGION__', $Region).
            Replace('__SECRET__', $SecretId).
            Replace('__DBNAME__', $DbName)
    ).Replace("`r`n", "`n")

    $scriptLines = $scriptBody -split "`n"
    $remoteCommands = @("cat <<'EOF' > /tmp/nwac-restore.sh")
    $remoteCommands += $scriptLines
    $remoteCommands += @(
        'EOF',
        'chmod +x /tmp/nwac-restore.sh',
        'bash /tmp/nwac-restore.sh',
        'rm -f /tmp/nwac-restore.sh'
    )

    $commandsJson    = $remoteCommands | ConvertTo-Json -Compress -Depth 5
    $parametersValue = 'commands=' + $commandsJson

    $result = Invoke-AwsCli -Arguments @(
        'ssm', 'send-command',
        '--instance-ids', $InstanceId,
        '--document-name', 'AWS-RunShellScript',
        '--parameters', $parametersValue,
        '--region', $Region,
        '--comment', "NWAC test DB restore from $Key",
        '--output', 'json'
    ) | ConvertFrom-Json

    $commandId = $result.Command.CommandId
    $consoleUrl = "https://$Region.console.aws.amazon.com/systems-manager/run-command/$commandId?region=$Region"
    Write-Host ("SSM command: {0}" -f $consoleUrl)
    Wait-SsmCommand -CommandId $commandId -InstanceId $InstanceId -Region $Region
}

### Pre-flight Checks #########################################################
Write-Section -Message 'Pre-flight checks'
Ensure-Tool -Name 'aws'

if (-not (Test-Path -LiteralPath $SnapshotPath)) {
    throw "Snapshot file not found at '$SnapshotPath'."
}

if ([string]::IsNullOrWhiteSpace($RestoreInstance)) {
    throw 'A restore instance ID must be configured.'
}

Write-Host 'Pre-flight checks passed.' -ForegroundColor Green

### Workspace Preparation #####################################################
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$tempRoot  = Join-Path ([System.IO.Path]::GetTempPath()) ("deploy-test-db-" + $timestamp)

try {
    Write-Section -Message 'Prepare workspace'

    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }

    New-Item -ItemType Directory -Path $tempRoot -ErrorAction Stop | Out-Null
    Write-Host ("Working directory: {0}" -f $tempRoot)

    Write-Section -Message 'Prepare snapshot'
    $sanitizedPath = Join-Path -Path $tempRoot -ChildPath 'snapshot.sql'
    $rawSql        = Get-Content -LiteralPath $SnapshotPath -Raw -ErrorAction Stop
    $sanitizedSql  = $rawSql -replace 'DEFINER=`[^`]+`@`[^`]+`', ''
    Set-Content -LiteralPath $sanitizedPath -Value $sanitizedSql -Encoding UTF8

    $rawBytes       = (Get-Item -LiteralPath $SnapshotPath -ErrorAction Stop).Length
    $sanitizedBytes = (Get-Item -LiteralPath $sanitizedPath -ErrorAction Stop).Length
    Write-Host ("Sanitized snapshot created at {0}" -f $sanitizedPath)
    Write-Host ("Original size:   {0:N0} bytes" -f $rawBytes)
    Write-Host ("Sanitized size:  {0:N0} bytes" -f $sanitizedBytes)

    Write-Section -Message 'Upload snapshot'
    $s3Key = '{0}/snapshot-{1}.sql' -f $KeyPrefix.TrimEnd('/'), $timestamp
    $s3Uri = 's3://{0}/{1}' -f $Bucket, $s3Key

    $uploadArgs = @('s3', 'cp', $sanitizedPath, $s3Uri, '--region', $Region)
    $uploadOutput = Invoke-AwsCli -Arguments $uploadArgs
    if ($uploadOutput) {
        Write-Host $uploadOutput
    }

    Write-Host ("Uploaded snapshot to {0}" -f $s3Uri)

    Write-Section -Message 'Remote restore'
    Invoke-RemoteRestore -InstanceId $RestoreInstance -Region $Region -Bucket $Bucket -Key $s3Key -SecretId $SecretId -DbName $DbName

    Write-Section -Message 'Done'
    Write-Host ("Snapshot restored from {0} via instance {1}." -f $s3Uri, $RestoreInstance)
}
finally {
    Write-Section -Message 'Cleanup'

    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host 'Temporary workspace removed.'
    } else {
        Write-Host 'No temporary workspace to remove.'
    }
}
