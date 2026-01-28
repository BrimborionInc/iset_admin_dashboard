<#
  Packages and uploads the shared repo for the NWAC prod environment.

.PARAMETER Region
  AWS region for all CLI calls. Defaults to ca-central-1.

.PARAMETER Bucket
  S3 bucket used to stage deployment artefacts. Defaults to nwac-prod-artifacts.

.PARAMETER KeyPrefix
  Folder prefix inside the bucket. Defaults to shared.

.PARAMETER ArtifactName
  Zip name to upload (the bootstrap script expects shared-latest.zip).
#>
[CmdletBinding()]
param(
    [string]$Region = "ca-central-1",
    [string]$Bucket = "nwac-prod-artifacts",
    [string]$KeyPrefix = "shared",
    [string]$ArtifactName = "shared-latest.zip"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:AWS_CLI_AUTO_PROMPT = "off"
$env:AWS_PAGER = ""

function Write-Section([string]$Message) {
    Write-Host ""
    Write-Host ("=== {0} ===" -f $Message) -ForegroundColor Cyan
}

function Ensure-Tool([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required tool '$Name' was not found in PATH."
    }
}

function Join-S3Key {
    param(
        [string]$Prefix,
        [string]$Name
    )
    if ([string]::IsNullOrWhiteSpace($Prefix)) { return $Name }
    return ($Prefix.TrimEnd('/') + '/' + $Name)
}

$tempRoot = $null

try {
    $repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
    $sharedSource = Join-Path $repoRoot "..\\shared"

    Write-Section "Pre-flight checks"
    Ensure-Tool "aws"
    if (-not (Get-Command "Compress-Archive" -ErrorAction SilentlyContinue)) {
        throw "Compress-Archive cmdlet not available. PowerShell 5.1 or later is required."
    }

    if (-not (Test-Path -LiteralPath $sharedSource)) {
        throw "Shared repo not found at '$sharedSource'."
    }

    Write-Section "Packaging shared artefact"
    $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("shared-deploy-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
    New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
    $archivePath = Join-Path $tempRoot $ArtifactName
    Compress-Archive -Path $sharedSource -DestinationPath $archivePath -Force

    Write-Section "Uploading artefact to S3"
    $s3Key = Join-S3Key -Prefix $KeyPrefix -Name $ArtifactName
    aws s3 cp "`"$archivePath`"" ("s3://{0}/{1}" -f $Bucket, $s3Key) --region $Region | Out-Host

    Write-Section "Upload complete"
    Write-Host ("Artefact uploaded to s3://{0}/{1}" -f $Bucket, $s3Key)
}
catch {
    Write-Host ""
    Write-Error $_
    exit 1
}
finally {
    if ($tempRoot -and (Test-Path -LiteralPath $tempRoot)) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
