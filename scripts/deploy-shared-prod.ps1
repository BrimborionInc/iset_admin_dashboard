<#
  Packages and uploads the shared repo for the NWAC prod environment.

.PARAMETER Region
  AWS region for all CLI calls. Defaults to ca-central-1.

.PARAMETER Profile
  AWS CLI profile to use. Defaults to default.

.PARAMETER Bucket
  S3 bucket used to stage deployment artefacts. Defaults to nwac-prod-artifacts.

.PARAMETER KeyPrefix
  Folder prefix inside the bucket. Defaults to shared.

.PARAMETER ArtifactName
  Zip name to upload (the bootstrap script expects shared-latest.zip).
#>
[CmdletBinding()]
param(
    [string]$Profile = "default",
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
    $allArgs = @($normalizedArgs + @("--profile", $Profile, "--no-cli-pager"))
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
    [void](Resolve-AwsCli)
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
    if ($tempRoot -and (Test-Path -LiteralPath $tempRoot)) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
