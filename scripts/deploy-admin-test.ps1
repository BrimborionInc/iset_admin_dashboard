<#
  Builds, packages, uploads, and deploys the admin dashboard to the NWAC test environment.

.DESCRIPTION
  This script automates the deployment flow that was previously performed manually:
    - Runs `npm run build:test`
    - Packages the build output and server assets into a zip archive
    - Uploads the archive to the designated S3 bucket
    - Uses AWS Systems Manager to copy the archive onto each instance in the target Auto Scaling Group
    - Installs dependencies, updates static assets, and restarts the PM2 process with NODE_ENV=production
    - Waits for each remote command to finish and surfaces any errors

.PARAMETER Region
  AWS region for all CLI calls. Defaults to ca-central-1.

.PARAMETER AutoScalingGroup
  Name of the Auto Scaling Group hosting the admin app. Defaults to nwac-test-asg.

.PARAMETER Bucket
  S3 bucket used to stage deployment artefacts. Defaults to nwac-test-artifacts.

.PARAMETER KeyPrefix
  Optional folder prefix inside the bucket. Defaults to admin-dashboard.

.PARAMETER SkipBuild
  Skips the `npm run build:test` step (useful when re-deploying an existing build artefact).
#>
[CmdletBinding()]
param(
    [string]$Region = "ca-central-1",
    [string]$AutoScalingGroup = "nwac-test-asg",
    [string]$Bucket = "nwac-test-artifacts",
    [string]$KeyPrefix = "admin-dashboard",
    [switch]$SkipBuild,
    [switch]$ShowRemoteLogs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:AWS_CLI_AUTO_PROMPT = "off"
$env:AWS_PAGER = ""
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"
try {
    chcp.com 65001 > $null
} catch {
    # chcp not available (non-Windows host); ignore
}

function Write-Section([string]$Message) {
    Write-Host ""
    Write-Host ("=== {0} ===" -f $Message) -ForegroundColor Cyan
}

function Sanitize-Output([string]$Text) {
    if ([string]::IsNullOrWhiteSpace($Text)) {
        return $Text
    }
    return ($Text -replace '[^\u0009\u000A\u000D\u0020-\u007E]', '?')
}

function Ensure-Tool([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required tool '$Name' was not found in PATH."
    }
}

function Start-SsmCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Region,
        [Parameter(Mandatory = $true)][string]$InstanceId,
        [Parameter(Mandatory = $true)][string[]]$Commands
    )

    $payload = @{
        DocumentName = "AWS-RunShellScript"
        InstanceIds  = @($InstanceId)
        Parameters   = @{ commands = $Commands }
        CloudWatchOutputConfig = @{
            CloudWatchOutputEnabled = $false
        }
    }

    $json = $payload | ConvertTo-Json -Depth 6
    $tempFile = [System.IO.Path]::GetTempFileName()
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    try {
        [System.IO.File]::WriteAllText($tempFile, $json, $utf8NoBom)
        $raw = aws ssm send-command `
            --region $Region `
            --cli-input-json ("file://{0}" -f $tempFile) `
            --output json

        ($raw | ConvertFrom-Json).Command.CommandId
    }
    finally {
        Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
    }
}

function Wait-SsmCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Region,
        [Parameter(Mandatory = $true)][string]$CommandId,
        [Parameter(Mandatory = $true)][string]$InstanceId
    )

    $failureCount = 0
    while ($true) {
        Start-Sleep -Seconds 5
        $raw = aws ssm get-command-invocation `
            --region $Region `
            --command-id $CommandId `
            --instance-id $InstanceId `
            --output json `
            --query '{Status:Status,StatusDetails:StatusDetails,Stdout:StandardOutputContent,Stderr:StandardErrorContent}' 2>&1

        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($raw)) {
            $failureCount++
            if ($failureCount -ge 10) {
                $message = if ([string]::IsNullOrWhiteSpace($raw)) { "(no output captured)" } else { Sanitize-Output($raw) }
                throw "Failed to poll SSM command $CommandId after $failureCount attempts. Last error: $message"
            }
            continue
        }

        $failureCount = 0
        $parsed = $raw | ConvertFrom-Json
        if (($parsed.PSObject.Properties.Match("Status")).Count -eq 0) {
            continue
        }

        switch ($parsed.Status) {
            "Pending" { continue }
            "InProgress" { continue }
            "Delayed" { continue }
            "Cancelled" { throw "SSM command $CommandId was cancelled." }
            "TimedOut" { throw "SSM command $CommandId timed out." }
            "Failed" {
                $stderr = Sanitize-Output($parsed.Stderr)
                if ([string]::IsNullOrWhiteSpace($stderr)) { $stderr = "<no stderr provided>" }
                $stdout = Sanitize-Output($parsed.Stdout)
                if (-not [string]::IsNullOrWhiteSpace($stdout)) {
                    $stderr = "$stderr`n--- STDOUT ---`n$stdout"
                }
                throw "SSM command $CommandId failed on $InstanceId. Error:`n$stderr"
            }
            "Success" { return $parsed }
            default { throw "Unknown SSM status '$($parsed.Status)' for command $CommandId." }
        }
    }
}

function Join-S3Key {
    param(
        [string]$Prefix,
        [string]$Name
    )

    if ([string]::IsNullOrWhiteSpace($Prefix)) {
        return $Name
    }
    $Prefix.TrimEnd('/') + '/' + $Name
}

$tempRoot = $null

try {
    $repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
    Push-Location $repoRoot

    Write-Section "Pre-flight checks"
    Ensure-Tool "npm"
    Ensure-Tool "aws"
    if (-not (Get-Command "Compress-Archive" -ErrorAction SilentlyContinue)) {
        throw "Compress-Archive cmdlet not available. PowerShell 5.1 or later is required."
    }

    if (-not $SkipBuild) {
        Write-Section "Building React app for test"
        npm run build:test | Out-Host
    } else {
        Write-Section "Skipping build step (per flag)"
    }

    $buildPath = Join-Path $repoRoot "build"
    if (-not (Test-Path -LiteralPath $buildPath)) {
        throw "Build output not found at '$buildPath'. Ensure the build step completed successfully."
    }

    Write-Section "Packaging artefact"
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("admin-deploy-" + $timestamp)
    $stagingPath = Join-Path $tempRoot "staging"
    New-Item -ItemType Directory -Path $stagingPath -Force | Out-Null

    Copy-Item -Path (Join-Path $repoRoot "build") -Destination (Join-Path $stagingPath "build") -Recurse -Force
    Copy-Item -Path (Join-Path $repoRoot "isetadminserver.js") -Destination (Join-Path $stagingPath "isetadminserver.js") -Force
    Copy-Item -Path (Join-Path $repoRoot "package.json") -Destination (Join-Path $stagingPath "package.json") -Force
    Copy-Item -Path (Join-Path $repoRoot "package-lock.json") -Destination (Join-Path $stagingPath "package-lock.json") -Force
    Copy-Item -Path (Join-Path $repoRoot ".env.test") -Destination (Join-Path $stagingPath ".env.test") -Force

    $directoriesToStage = @("src", "shared", "templates", "blocksteps")
    $stagedDirectories = @()
    foreach ($dir in $directoriesToStage) {
        $sourceDir = Join-Path $repoRoot $dir
        if (Test-Path -LiteralPath $sourceDir) {
            Copy-Item -Path $sourceDir -Destination (Join-Path $stagingPath $dir) -Recurse -Force
            $stagedDirectories += $dir
        }
    }

    # Manually stage the shared repo (lives outside admin-dashboard)
    $sharedSource = Join-Path $repoRoot "..\shared"
    if (Test-Path -LiteralPath $sharedSource) {
        $sharedDest = Join-Path $stagingPath "shared"
        New-Item -ItemType Directory -Path $sharedDest -Force | Out-Null
        Copy-Item -Path (Join-Path $sharedSource "*") -Destination $sharedDest -Recurse -Force
        if ($stagedDirectories -notcontains 'shared') {
            $stagedDirectories += 'shared'
        }
    } else {
        Write-Warning "Shared repo not found at '$sharedSource'; skipping shared staging."
    }

    $archiveName = "admin-dashboard-$timestamp.zip"
    $archivePath = Join-Path $tempRoot $archiveName
    Push-Location $stagingPath
    Compress-Archive -Path * -DestinationPath $archivePath -Force
    Pop-Location

    Write-Section "Uploading artefact to S3"
    $s3Key = Join-S3Key -Prefix $KeyPrefix -Name $archiveName
    aws s3 cp "`"$archivePath`"" ("s3://{0}/{1}" -f $Bucket, $s3Key) --region $Region | Out-Host

    Write-Section "Discovering instances in Auto Scaling Group '$AutoScalingGroup'"
    $asgJson = aws autoscaling describe-auto-scaling-groups `
        --region $Region `
        --auto-scaling-group-names $AutoScalingGroup `
        --output json

    $asg = ($asgJson | ConvertFrom-Json).AutoScalingGroups
    if (-not $asg -or $asg.Count -eq 0) {
        throw "Auto Scaling Group '$AutoScalingGroup' not found in region $Region."
    }

    $instanceIds = $asg[0].Instances |
        Where-Object { $_.LifecycleState -eq "InService" -and $_.HealthStatus -eq "Healthy" } |
        Select-Object -ExpandProperty InstanceId

    if (-not $instanceIds -or $instanceIds.Count -eq 0) {
        throw "No healthy, in-service instances found in Auto Scaling Group '$AutoScalingGroup'."
    }

    Write-Host ("Instances: {0}" -f ($instanceIds -join ", "))

    $commandsList = [System.Collections.Generic.List[string]]::new()
    $commandsList.Add('set -euo pipefail')
    $commandsList.Add('STAMP=$(date +%s)')
    $commandsList.Add('TMPDIR="/tmp/admin-deploy-$STAMP"')
    $commandsList.Add('mkdir -p "$TMPDIR"')
    $commandsList.Add("aws s3 cp s3://$Bucket/$s3Key /tmp/admin.zip --region $Region")
    $commandsList.Add('if ! unzip -qo /tmp/admin.zip -d "$TMPDIR"; then code=$?; if [ "$code" -ne 1 ]; then exit "$code"; fi; fi')
    $commandsList.Add('mkdir -p /home/ec2-user/admin-dashboard')
    $commandsList.Add('mkdir -p /opt/nwac/admin-dashboard')
    $commandsList.Add('rm -rf /home/ec2-user/admin-dashboard/build')
    $commandsList.Add('rm -rf /opt/nwac/admin-dashboard/build')
    $commandsList.Add('cp -r "$TMPDIR/build" /home/ec2-user/admin-dashboard/')
    $commandsList.Add('cp -r "$TMPDIR/build" /opt/nwac/admin-dashboard/')
    $commandsList.Add('cp "$TMPDIR/isetadminserver.js" /opt/nwac/admin-dashboard/isetadminserver.js')
    $commandsList.Add('cp "$TMPDIR/package.json" /opt/nwac/admin-dashboard/package.json')
    $commandsList.Add('cp "$TMPDIR/package-lock.json" /opt/nwac/admin-dashboard/package-lock.json')
    $commandsList.Add('cp "$TMPDIR/.env.test" /home/ec2-user/admin-dashboard/.env')
    $commandsList.Add('cp "$TMPDIR/.env.test" /opt/nwac/admin-dashboard/.env')
    $commandsList.Add('cp "$TMPDIR/.env.test" /opt/nwac/admin-dashboard/.env.test')

    # Fetch OPENROUTER_API_KEY from Secrets Manager (test) and inject into env files
    $commandsList.Add('SECRET_NAME="nwac-test-admin-openrouter-api-key"')
    $commandsList.Add("SECRET_REGION=$Region")
    $commandsList.Add('echo "Fetching $SECRET_NAME from Secrets Manager..."')
    $commandsList.Add('SECRET_VAL_RAW=$(aws secretsmanager get-secret-value --region "$SECRET_REGION" --secret-id "$SECRET_NAME" --query SecretString --output text 2>/dev/null || true)')
    $commandsList.Add('SECRET_VAL="$SECRET_VAL_RAW"')
    $commandsList.Add('if echo "$SECRET_VAL_RAW" | grep -q "^{"; then')
    $commandsList.Add('  SECRET_VAL=$(SECRET_VAL_RAW="$SECRET_VAL_RAW" python3 - <<PY')
    $commandsList.Add('import json, os')
    $commandsList.Add('val = os.environ.get("SECRET_VAL_RAW", "")')
    $commandsList.Add('out = val')
    $commandsList.Add('try:')
    $commandsList.Add('    data = json.loads(val)')
    $commandsList.Add('    if isinstance(data, dict):')
    $commandsList.Add('        out = data.get("OPENROUTER_API_KEY") or data.get("openrouter_api_key")')
    $commandsList.Add('        if not out:')
    $commandsList.Add('            out = next((v for k, v in data.items() if "openrouter" in k.lower() and "key" in k.lower()), out)')
    $commandsList.Add('except Exception:')
    $commandsList.Add('    pass')
    $commandsList.Add('print(out or "")')
    $commandsList.Add('PY')
    $commandsList.Add('  )')
    $commandsList.Add('fi')
    $commandsList.Add('if [ -n "$SECRET_VAL" ]; then')
    $commandsList.Add('  # Remove existing OPENROUTER_API_KEY lines, then append the fetched value')
    $commandsList.Add('  for target in /home/ec2-user/admin-dashboard/.env /opt/nwac/admin-dashboard/.env; do')
    $commandsList.Add('    if [ -f "$target" ]; then')
    $commandsList.Add('      grep -v "^OPENROUTER_API_KEY=" "$target" > "$target.tmp" && mv "$target.tmp" "$target"')
    $commandsList.Add('    fi')
    $commandsList.Add('    echo "OPENROUTER_API_KEY=$SECRET_VAL" >> "$target"')
    $commandsList.Add('  done')
    $commandsList.Add('else')
    $commandsList.Add('  echo "WARNING: Secret $SECRET_NAME not found or empty; AI will remain disabled."')
    $commandsList.Add('fi')

    if ($stagedDirectories -contains 'src') {
        $commandsList.Add('rm -rf /opt/nwac/admin-dashboard/src')
        $commandsList.Add('cp -r "$TMPDIR/src" /opt/nwac/admin-dashboard/')
    }
    if ($stagedDirectories -contains 'shared') {
        $commandsList.Add('rm -rf /opt/nwac/admin-dashboard/shared')
        $commandsList.Add('cp -r "$TMPDIR/shared" /opt/nwac/admin-dashboard/')
        $commandsList.Add('rm -rf /opt/nwac/shared')
        $commandsList.Add('mkdir -p /opt/nwac')
        $commandsList.Add('cp -r "$TMPDIR/shared" /opt/nwac/')
    }
    if ($stagedDirectories -contains 'templates') {
        $commandsList.Add('rm -rf /opt/nwac/admin-dashboard/templates')
        $commandsList.Add('cp -r "$TMPDIR/templates" /opt/nwac/admin-dashboard/')
    }
    if ($stagedDirectories -contains 'blocksteps') {
        $commandsList.Add('rm -rf /opt/nwac/admin-dashboard/blocksteps')
        $commandsList.Add('cp -r "$TMPDIR/blocksteps" /opt/nwac/admin-dashboard/')
    }

    $commandsList.Add('NPM_BIN="$(command -v npm 2>/dev/null || command -v /usr/local/bin/npm 2>/dev/null || command -v /usr/bin/npm 2>/dev/null)"')
    $commandsList.Add('if [ -z "$NPM_BIN" ]; then')
    $commandsList.Add('  echo "npm not found on PATH; deployment aborting"')
    $commandsList.Add('  exit 1')
    $commandsList.Add('fi')
    $commandsList.Add('cd /opt/nwac/admin-dashboard')
    $commandsList.Add('if [ -d node_modules ]; then rm -rf node_modules; fi')
    $commandsList.Add('"$NPM_BIN" install --production')
    $commandsList.Add('PM2_BIN="$(command -v pm2 2>/dev/null || true)"')
    $commandsList.Add('if [ -z "$PM2_BIN" ]; then')
    $commandsList.Add('  echo "pm2 not found on PATH; installing globally"')
    $commandsList.Add('  "$NPM_BIN" install -g pm2')
    $commandsList.Add('  PM2_BIN="$(command -v pm2 2>/dev/null || echo /usr/bin/pm2)"')
    $commandsList.Add('fi')
    $commandsList.Add('if [ ! -x "$PM2_BIN" ]; then')
    $commandsList.Add('  echo "pm2 binary not executable at $PM2_BIN"')
    $commandsList.Add('  exit 1')
    $commandsList.Add('fi')
    $commandsList.Add('export NODE_ENV=production')
    $commandsList.Add('export HOME=/root')
    $commandsList.Add('export PM2_HOME=/root/.pm2')
    $commandsList.Add('"$PM2_BIN" restart nwac-admin --update-env')
    $commandsList.Add('sleep 10')
    $commandsList.Add('"$PM2_BIN" describe nwac-admin || true')
    $commandsList.Add('LOG_DIR="/root/.pm2/logs"')
    $commandsList.Add('echo "--- nwac-admin stderr (tail) ---"')
    $commandsList.Add('tail -n 200 "$LOG_DIR/nwac-admin-error.log" || true')
    $commandsList.Add('echo "--- nwac-admin stdout (tail) ---"')
    $commandsList.Add('tail -n 200 "$LOG_DIR/nwac-admin-out.log" || true')
    $commandsList.Add('rm -rf "$TMPDIR" /tmp/admin.zip')

    $commands = $commandsList.ToArray()

    $commandResults = @()
    foreach ($instance in $instanceIds) {
        Write-Section ("Deploying to {0}" -f $instance)
        $commandId = Start-SsmCommand -Region $Region -InstanceId $instance -Commands $commands
        Write-Host ("Started SSM command {0}" -f $commandId)
        $result = Wait-SsmCommand -Region $Region -CommandId $commandId -InstanceId $instance
        $commandResults += $result
        Write-Host ("Instance {0} completed with status {1}" -f $instance, $result.Status) -ForegroundColor Green

        $stdoutDisplay = Sanitize-Output($result.Stdout)
        $stderrDisplay = Sanitize-Output($result.Stderr)

        if ($ShowRemoteLogs -or $result.Status -ne "Success") {
            if ($stdoutDisplay -and -not [string]::IsNullOrWhiteSpace($stdoutDisplay)) {
                Write-Host ("--- Output from {0} ---" -f $instance) -ForegroundColor Yellow
                Write-Host $stdoutDisplay
            }
            if ($stderrDisplay -and -not [string]::IsNullOrWhiteSpace($stderrDisplay)) {
                Write-Host ("--- STDERR from {0} ---" -f $instance) -ForegroundColor Red
                Write-Host $stderrDisplay
            }
        }
    }

    Write-Section "Deployment complete"
    Write-Host ("Artefact uploaded to s3://{0}/{1}" -f $Bucket, $s3Key)
    Write-Host ("Instances updated: {0}" -f ($instanceIds -join ", "))
    Write-Host "Recommended: run a quick smoke test against https://nwac-console-test.awentech.ca"
}
catch {
    Write-Host ""
    Write-Error $_
    exit 1
}
finally {
    Pop-Location -ErrorAction SilentlyContinue
    if ($tempRoot -and (Test-Path -LiteralPath $tempRoot)) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
