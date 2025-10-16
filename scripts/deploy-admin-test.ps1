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
  S3 bucket used to stage deployment artefacts. Defaults to nwac-admin-test-deploy.

.PARAMETER KeyPrefix
  Optional folder prefix inside the bucket. Defaults to admin-dashboard/test.

.PARAMETER SkipBuild
  Skips the `npm run build:test` step (useful when re-deploying an existing build artefact).
#>
[CmdletBinding()]
param(
    [string]$Region = "ca-central-1",
    [string]$AutoScalingGroup = "nwac-test-asg",
    [string]$Bucket = "nwac-test-artifacts",
    [string]$KeyPrefix = "admin-dashboard",
    [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Section([string]$Message) {
    Write-Host ""
    Write-Host ("=== {0} ===" -f $Message) -ForegroundColor Cyan
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

        $parsed = $raw | ConvertFrom-Json
        return $parsed.Command.CommandId
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

    while ($true) {
        Start-Sleep -Seconds 5
        $raw = aws ssm get-command-invocation `
            --region $Region `
            --command-id $CommandId `
            --instance-id $InstanceId `
            --output json `
            --query '{Status:Status,StatusDetails:StatusDetails,Error:StandardErrorContent}'

        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($raw)) {
            continue
        }

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
                $stderr = $parsed.StandardErrorContent
                if ([string]::IsNullOrWhiteSpace($stderr)) {
                    $stderr = "<no stderr provided>"
                }
                throw "SSM command $CommandId failed on $InstanceId. Error:`n$stderr"
            }
            "Success" {
                return $parsed
            }
            default {
                throw "Unknown SSM status '$($parsed.Status)' for command $CommandId."
            }
        }
    }
}

function Join-S3Key {
    param(
        [string]$Prefix,
        [string]$Name
    )
    if ([string]::IsNullOrWhiteSpace($Prefix)) { return $Name }
    $trimPrefix = $Prefix.TrimEnd('/')
    return "$trimPrefix/$Name"
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
    }
    else {
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
    $configDir = Join-Path $stagingPath "src/config"
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    Copy-Item -Path (Join-Path $repoRoot "src/config/roleMatrix.json") -Destination (Join-Path $configDir "roleMatrix.json") -Force

    $archiveName = "admin-dashboard-$timestamp.zip"
    $archivePath = Join-Path $tempRoot $archiveName
    Push-Location $stagingPath
    Compress-Archive -Path * -DestinationPath $archivePath -Force
    Pop-Location

    Write-Section "Uploading artefact to S3"
    $s3Key = Join-S3Key -Prefix $KeyPrefix -Name $archiveName
    $uploadCmd = @(
        "s3",
        "cp",
        "`"$archivePath`"",
        ("s3://{0}/{1}" -f $Bucket, $s3Key),
        "--region", $Region
    )
    aws @uploadCmd | Out-Host

    Write-Section "Discovering instances in Auto Scaling Group '$AutoScalingGroup'"
    $asgJson = aws autoscaling describe-auto-scaling-groups `
        --region $Region `
        --auto-scaling-group-names $AutoScalingGroup `
        --output json

    $asg = ($asgJson | ConvertFrom-Json).AutoScalingGroups
    if (-not $asg -or $asg.Count -eq 0) {
        throw "Auto Scaling Group '$AutoScalingGroup' not found in region $Region."
    }

    $instanceIds = $asg[0].Instances | Where-Object { $_.LifecycleState -eq "InService" -and $_.HealthStatus -eq "Healthy" } | Select-Object -ExpandProperty InstanceId
    if (-not $instanceIds -or $instanceIds.Count -eq 0) {
        throw "No healthy, in-service instances found in Auto Scaling Group '$AutoScalingGroup'."
    }

    Write-Host ("Instances: {0}" -f ($instanceIds -join ", "))

    $commands = @(
        'set -euo pipefail',
        'STAMP=$(date +%s)',
        'TMPDIR="/tmp/admin-deploy-$STAMP"',
        'mkdir -p "$TMPDIR"',
        ("aws s3 cp s3://{0}/{1} /tmp/admin.zip --region {2}" -f $Bucket, $s3Key, $Region),
        'if ! unzip -qo /tmp/admin.zip -d "$TMPDIR"; then code=$?; if [ "$code" -ne 1 ]; then exit "$code"; fi; fi',
        'mkdir -p /home/ec2-user/admin-dashboard',
        'mkdir -p /opt/nwac/admin-dashboard',
        'rm -rf /home/ec2-user/admin-dashboard/build',
        'rm -rf /opt/nwac/admin-dashboard/build',
        'cp -r "$TMPDIR/build" /home/ec2-user/admin-dashboard/',
        'cp -r "$TMPDIR/build" /opt/nwac/admin-dashboard/',
        'cp "$TMPDIR/isetadminserver.js" /opt/nwac/admin-dashboard/isetadminserver.js',
        'cp "$TMPDIR/package.json" /opt/nwac/admin-dashboard/package.json',
        'cp "$TMPDIR/package-lock.json" /opt/nwac/admin-dashboard/package-lock.json',
        'cp "$TMPDIR/.env.test" /home/ec2-user/admin-dashboard/.env',
        'cp "$TMPDIR/.env.test" /opt/nwac/admin-dashboard/.env',
        'cp "$TMPDIR/.env.test" /opt/nwac/admin-dashboard/.env.test',
        'mkdir -p /opt/nwac/admin-dashboard/src/config',
        'cp "$TMPDIR/src/config/roleMatrix.json" /opt/nwac/admin-dashboard/src/config/roleMatrix.json',
        'cd /opt/nwac/admin-dashboard',
        'echo "Skipping dependency install (npm ci/npm install) per maintenance override."',
        'export NODE_ENV=production',
        'export HOME=/root',
        'export PM2_HOME=/root/.pm2',
        'pm2 restart nwac-admin --update-env',
        'rm -rf "$TMPDIR" /tmp/admin.zip'
    )

    $commandResults = @()
    foreach ($instance in $instanceIds) {
        Write-Section ("Deploying to {0}" -f $instance)
        $commandId = Start-SsmCommand -Region $Region -InstanceId $instance -Commands $commands
        Write-Host ("Started SSM command {0}" -f $commandId)
        $result = Wait-SsmCommand -Region $Region -CommandId $commandId -InstanceId $instance
        $commandResults += $result
        Write-Host ("Instance {0} completed with status {1}" -f $instance, $result.Status) -ForegroundColor Green
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
