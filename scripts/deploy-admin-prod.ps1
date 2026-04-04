<#
  Builds, packages, and uploads the admin dashboard for the NWAC prod environment.

.DESCRIPTION
  This script mirrors the test build packaging flow but only uploads the artifact
  to the prod artifacts bucket. Instances will pull the latest zip during boot
  via the Terraform user data + bootstrap script.

.PARAMETER Region
  AWS region for all CLI calls. Defaults to ca-central-1.

.PARAMETER Profile
  AWS CLI profile to use. Defaults to nwac-prod.

.PARAMETER Bucket
  S3 bucket used to stage deployment artefacts. Defaults to nwac-prod-artifacts.

.PARAMETER KeyPrefix
  Folder prefix inside the bucket. Defaults to admin.

.PARAMETER ArtifactName
  Zip name to upload (the bootstrap script expects admin-dashboard-latest.zip).

.PARAMETER SkipBuild
  Skips the build step (useful when re-uploading an existing build artefact).

.PARAMETER ReleaseId
  Optional release/build identifier to stamp into the frontend bundle.
#>
[CmdletBinding()]
param(
    [string]$Profile = "nwac-prod",
    [string]$Region = "ca-central-1",
    [string]$Bucket = "nwac-prod-artifacts",
    [string]$KeyPrefix = "admin",
    [string]$ArtifactName = "admin-dashboard-latest.zip",
    [string]$ReleaseId = "",
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

function Resolve-NpmCli {
    $candidates = @(@(
        (Join-Path ${env:ProgramFiles} "nodejs\npm.cmd"),
        (Join-Path ${env:ProgramFiles} "nodejs\npm"),
        ((Get-Command npm -ErrorAction SilentlyContinue).Source)
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) })

    if ($candidates.Count -gt 0) {
        return $candidates[0]
    }

    throw "npm was not found in PATH or the standard installation locations."
}

function Resolve-CmdExe {
    $candidates = @(@(
        ${env:ComSpec},
        "C:\Windows\System32\cmd.exe"
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) })

    if ($candidates.Count -gt 0) {
        return $candidates[0]
    }

    throw "cmd.exe was not found."
}

function Resolve-AwsCli {
    $cmd = Get-Command aws -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    $candidates = @(@(
        (Join-Path ${env:ProgramFiles} "Amazon\AWSCLIV2\aws.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Amazon\AWSCLIV2\aws.exe")
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) })

    if ($candidates.Count -gt 0) {
        return $candidates[0]
    }

    throw "AWS CLI was not found in PATH or the standard installation locations."
}

function Invoke-Aws {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Args
    )

    $awsCli = Resolve-AwsCli
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = New-Object System.Diagnostics.ProcessStartInfo
    $process.StartInfo.FileName = $awsCli
    $normalizedArgs = @($Args | ForEach-Object {
            if ($_ -match '^".*"$') {
                $_.Substring(1, $_.Length - 2)
            }
            else {
                $_
            }
        })
    $allArgs = @($normalizedArgs)
    if ([string]::IsNullOrWhiteSpace($env:AWS_ACCESS_KEY_ID)) {
        $allArgs += @("--profile", $Profile)
    }
    $allArgs += @("--no-cli-pager")
    $process.StartInfo.Arguments = [string]::Join(' ', ($allArgs | ForEach-Object {
                if ($_ -match '[\s"]') {
                    '"' + ($_ -replace '"', '\"') + '"'
                }
                else {
                    $_
                }
            }))
    $process.StartInfo.UseShellExecute = $false
    $process.StartInfo.RedirectStandardOutput = $true
    $process.StartInfo.RedirectStandardError = $true
    $process.StartInfo.CreateNoWindow = $true

    [void]$process.Start()
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    if ($process.ExitCode -ne 0) {
        $message = ("AWS CLI command failed with exit code {0}: aws {1}" -f $process.ExitCode, ($Args -join ' '))
        if (-not [string]::IsNullOrWhiteSpace($stderr)) {
            $message = "$message`n$stderr"
        }
        throw $message
    }

    return $stdout.TrimEnd("`r", "`n")
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
    [void](Resolve-NpmCli)
    [void](Resolve-AwsCli)

    $buildPath = Join-Path $repoRoot "build"

    if (-not $SkipBuild) {
        Write-Section "Building React app for prod"
        if (Test-Path -LiteralPath $buildPath) {
            Remove-Item -LiteralPath $buildPath -Recurse -Force -ErrorAction SilentlyContinue
        }
        $env:PATH_DEPLOY_ENV = "prod"
        if ([string]::IsNullOrWhiteSpace($ReleaseId)) {
            Remove-Item Env:PATH_RELEASE_ID -ErrorAction SilentlyContinue
        } else {
            $env:PATH_RELEASE_ID = $ReleaseId
        }
        & (Resolve-CmdExe) /c ('"{0}" run build:production' -f (Resolve-NpmCli))
        $lastExitVar = Get-Variable -Name LASTEXITCODE -ErrorAction SilentlyContinue
        $exitCode = if ($null -ne $lastExitVar) { [int]$lastExitVar.Value } else { 0 }
        if ($exitCode -ne 0) {
            throw "Build failed with exit code $exitCode. Deployment aborted."
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
    Invoke-Aws s3 cp "`"$archivePath`"" ("s3://{0}/{1}" -f $Bucket, $s3Key) --region $Region | Out-Host

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
