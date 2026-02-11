<#
  Builds, packages, and uploads the admin dashboard for the NWAC prod environment.

.DESCRIPTION
  This script mirrors the test build packaging flow but only uploads the artifact
  to the prod artifacts bucket. Instances will pull the latest zip during boot
  via the Terraform user data + bootstrap script.

.PARAMETER Region
  AWS region for all CLI calls. Defaults to ca-central-1.

.PARAMETER Bucket
  S3 bucket used to stage deployment artefacts. Defaults to nwac-prod-artifacts.

.PARAMETER KeyPrefix
  Folder prefix inside the bucket. Defaults to admin.

.PARAMETER ArtifactName
  Zip name to upload (the bootstrap script expects admin-dashboard-latest.zip).

.PARAMETER SkipBuild
  Skips the build step (useful when re-uploading an existing build artefact).
#>
[CmdletBinding()]
param(
    [string]$Region = "ca-central-1",
    [string]$Bucket = "nwac-prod-artifacts",
    [string]$KeyPrefix = "admin",
    [string]$ArtifactName = "admin-dashboard-latest.zip",
    [switch]$SkipBuild
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

function Ensure-Tool([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required tool '$Name' was not found in PATH."
    }
}

function New-PosixZip {
    param(
        [Parameter(Mandatory = $true)][string]$SourceDir,
        [Parameter(Mandatory = $true)][string]$DestinationZip
    )

    try { Add-Type -AssemblyName System.IO.Compression -ErrorAction Stop } catch {}
    try { Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction Stop } catch {}
    try { [void][System.IO.Compression.ZipArchiveMode]::Create } catch {
        throw "ZipArchive types unavailable in this PowerShell session. Ensure the System.IO.Compression assembly is loadable."
    }

    if (Test-Path -LiteralPath $DestinationZip) {
        Remove-Item -LiteralPath $DestinationZip -Force
    }

    $baseDir = (Resolve-Path -LiteralPath $SourceDir).Path
    $trimmedBase = $baseDir.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
    $basePrefix = $trimmedBase + [System.IO.Path]::DirectorySeparatorChar

    $zipStream = [System.IO.File]::Open($DestinationZip, [System.IO.FileMode]::Create)
    try {
        $archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
        try {
            Get-ChildItem -LiteralPath $trimmedBase -File -Recurse | ForEach-Object {
                $relativePath = $_.FullName.Substring($basePrefix.Length)
                $entryName = $relativePath -replace '\\', '/'
                $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
                $entryStream = $entry.Open()
                $fileStream = [System.IO.File]::OpenRead($_.FullName)
                try {
                    $fileStream.CopyTo($entryStream)
                } finally {
                    $fileStream.Dispose()
                    $entryStream.Dispose()
                }
            }
        } finally {
            $archive.Dispose()
        }
    } finally {
        $zipStream.Dispose()
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

    $buildPath = Join-Path $repoRoot "build"

    if (-not $SkipBuild) {
        Write-Section "Building React app for prod"
        if (Test-Path -LiteralPath $buildPath) {
            Remove-Item -LiteralPath $buildPath -Recurse -Force -ErrorAction SilentlyContinue
        }
        npm run build:production | Out-Host
        if ($LASTEXITCODE -ne 0) {
            throw "Build failed with exit code $LASTEXITCODE. Deployment aborted."
        }
    } else {
        Write-Section "Skipping build step (per flag)"
    }

    if (-not (Test-Path -LiteralPath $buildPath)) {
        throw "Build output not found at '$buildPath'. Ensure the build step completed successfully."
    }

    Write-Section "Packaging artefact"
    $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("admin-deploy-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
    $stagingPath = Join-Path $tempRoot "staging"
    New-Item -ItemType Directory -Path $stagingPath -Force | Out-Null

    Copy-Item -Path (Join-Path $repoRoot "build") -Destination (Join-Path $stagingPath "build") -Recurse -Force
    Copy-Item -Path (Join-Path $repoRoot "isetadminserver.js") -Destination (Join-Path $stagingPath "isetadminserver.js") -Force
    Copy-Item -Path (Join-Path $repoRoot "package.json") -Destination (Join-Path $stagingPath "package.json") -Force
    Copy-Item -Path (Join-Path $repoRoot "package-lock.json") -Destination (Join-Path $stagingPath "package-lock.json") -Force
    $envProdPath = Join-Path $repoRoot ".env.production"
    if (Test-Path -LiteralPath $envProdPath) {
        Copy-Item -Path $envProdPath -Destination (Join-Path $stagingPath ".env.production") -Force
    }
    Copy-Item -Path (Join-Path $repoRoot "tmp_assessment_template.html") -Destination (Join-Path $stagingPath "tmp_assessment_template.html") -Force
    Copy-Item -Path (Join-Path $repoRoot "tmp_application_form_template.html") -Destination (Join-Path $stagingPath "tmp_application_form_template.html") -Force
    Copy-Item -Path (Join-Path $repoRoot "tmp_financial_overview_template.html") -Destination (Join-Path $stagingPath "tmp_financial_overview_template.html") -Force
    Copy-Item -Path (Join-Path $repoRoot "tmp_cfa_template.html") -Destination (Join-Path $stagingPath "tmp_cfa_template.html") -Force

    $directoriesToStage = @("src", "shared", "templates", "blocksteps", "public", "sql")
    foreach ($dir in $directoriesToStage) {
        $sourceDir = Join-Path $repoRoot $dir
        if (Test-Path -LiteralPath $sourceDir) {
            Copy-Item -Path $sourceDir -Destination (Join-Path $stagingPath $dir) -Recurse -Force
        }
    }

    # Manually stage the shared repo (lives outside admin-dashboard)
    $sharedSource = Join-Path $repoRoot "..\shared"
    if (Test-Path -LiteralPath $sharedSource) {
        $sharedDest = Join-Path $stagingPath "shared"
        New-Item -ItemType Directory -Path $sharedDest -Force | Out-Null
        Copy-Item -Path (Join-Path $sharedSource "*") -Destination $sharedDest -Recurse -Force
    } else {
        Write-Warning "Shared repo not found at '$sharedSource'; skipping shared staging."
    }

    $archivePath = Join-Path $tempRoot $ArtifactName
    New-PosixZip -SourceDir $stagingPath -DestinationZip $archivePath

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
    Pop-Location -ErrorAction SilentlyContinue
    if ($tempRoot -and (Test-Path -LiteralPath $tempRoot)) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
