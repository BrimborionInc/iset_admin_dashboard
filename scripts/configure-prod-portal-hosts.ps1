<#
.SYNOPSIS
  Updates prod runtime configuration for the public portal hostname cutover.

.DESCRIPTION
  This script updates the prod SSM env parameters for the portal/admin apps and
  aligns the uploads bucket CORS policy so the public portal can run on a new
  primary hostname while optionally retaining the legacy hostname.

  It does not request ACM certificates, change ALB listener rules, or rotate the
  WAF CAPTCHA API key. The CAPTCHA key is a frontend build-time setting in the
  portal repo and must be handled separately.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$Profile = "nwac-prod",
    [string]$Region = "ca-central-1",
    [string]$PrimaryPortalUrl = "https://iset.nwac.ca",
    [string]$LegacyPortalUrl = "https://nwac-public.awentech.ca",
    [string]$AdminUrl = "https://nwac-console.awentech.ca",
    [string]$PortalEnvParameter = "/nwac/prod/portal/env",
    [string]$AdminEnvParameter = "/nwac/prod/admin/env",
    [string]$UploadsBucket = "nwac-prod-uploads-b6bb"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$env:AWS_CLI_AUTO_PROMPT = "off"
$env:AWS_PAGER = ""

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
    $allArgs = @($Args + @("--profile", $Profile, "--no-cli-pager"))
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

function Set-JsonProperty {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)]$Value
    )

    $existing = $Object.PSObject.Properties[$Name]
    if ($null -ne $existing) {
        $existing.Value = $Value
    }
    else {
        Add-Member -InputObject $Object -NotePropertyName $Name -NotePropertyValue $Value
    }
}

function Get-UniqueList {
    param([string[]]$Values)

    $seen = New-Object 'System.Collections.Generic.HashSet[string]'
    $out = New-Object System.Collections.ArrayList
    foreach ($value in $Values) {
        if ([string]::IsNullOrWhiteSpace($value)) { continue }
        $trimmed = $value.Trim()
        if ($seen.Add($trimmed)) {
            [void]$out.Add($trimmed)
        }
    }
    return [string[]]$out
}

function Get-JsonParameter {
    param([string]$Name)

    $raw = (Invoke-Aws ssm get-parameter --region $Region --with-decryption --name $Name --query Parameter.Value --output text | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($raw)) {
        throw "Parameter $Name returned an empty value."
    }

    $parsed = $raw | ConvertFrom-Json
    if ($null -eq $parsed) {
        throw "Parameter $Name could not be parsed as JSON."
    }

    return $parsed
}

function Put-JsonParameter {
    param(
        [string]$Name,
        $Object
    )

    $json = $Object | ConvertTo-Json -Depth 20 -Compress
    Invoke-Aws ssm put-parameter --region $Region --name $Name --type SecureString --value $json --overwrite | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $PSScriptRoot "..\\tmp\\prod-fixes\\portal-hostnames-$timestamp"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$primaryPortalRoot = $PrimaryPortalUrl.TrimEnd('/')
$legacyPortalRoot = $LegacyPortalUrl.TrimEnd('/')
$adminRoot = $AdminUrl.TrimEnd('/')

$portalOrigins = Get-UniqueList @($primaryPortalRoot, $legacyPortalRoot, $adminRoot)
$adminOrigins = Get-UniqueList @($adminRoot, $primaryPortalRoot, $legacyPortalRoot)
$uploadsOrigins = Get-UniqueList @($primaryPortalRoot, $legacyPortalRoot)

$portalEnv = Get-JsonParameter -Name $PortalEnvParameter
$adminEnv = Get-JsonParameter -Name $AdminEnvParameter
$currentCors = Invoke-Aws s3api get-bucket-cors --region $Region --bucket $UploadsBucket

$portalEnv | ConvertTo-Json -Depth 20 | Set-Content -Path (Join-Path $backupDir "portal-env.json")
$adminEnv | ConvertTo-Json -Depth 20 | Set-Content -Path (Join-Path $backupDir "admin-env.json")
$currentCors | Set-Content -Path (Join-Path $backupDir "uploads-cors.json")

Set-JsonProperty -Object $portalEnv -Name "ALLOWED_ORIGIN" -Value ($portalOrigins -join ",")
Set-JsonProperty -Object $portalEnv -Name "COGNITO_REDIRECT_URI" -Value "$primaryPortalRoot/auth/callback"
Set-JsonProperty -Object $portalEnv -Name "COGNITO_LOGOUT_URI" -Value "$primaryPortalRoot/"
Set-JsonProperty -Object $portalEnv -Name "PUBLIC_PORTAL_BASE_URL" -Value $primaryPortalRoot
Set-JsonProperty -Object $portalEnv -Name "APPLICANT_PORTAL_BASE" -Value $primaryPortalRoot

Set-JsonProperty -Object $adminEnv -Name "ALLOWED_ORIGIN" -Value ($adminOrigins -join ",")
Set-JsonProperty -Object $adminEnv -Name "REACT_APP_PORTAL_URL" -Value "$primaryPortalRoot/"

$corsConfig = @{
    CORSRules = @(
        @{
            AllowedOrigins = $uploadsOrigins
            AllowedMethods = @("PUT", "GET", "HEAD")
            AllowedHeaders = @("*")
            ExposeHeaders  = @("ETag", "x-amz-request-id", "x-amz-id-2")
            MaxAgeSeconds  = 3000
        }
    )
}

if ($PSCmdlet.ShouldProcess($PortalEnvParameter, "Update prod portal env")) {
    Put-JsonParameter -Name $PortalEnvParameter -Object $portalEnv
}

if ($PSCmdlet.ShouldProcess($AdminEnvParameter, "Update prod admin env")) {
    Put-JsonParameter -Name $AdminEnvParameter -Object $adminEnv
}

if ($PSCmdlet.ShouldProcess($UploadsBucket, "Update uploads bucket CORS")) {
    $corsJson = $corsConfig | ConvertTo-Json -Depth 10 -Compress
    $corsFile = Join-Path $backupDir "uploads-cors-new.json"
    [System.IO.File]::WriteAllText($corsFile, $corsJson, (New-Object System.Text.UTF8Encoding($false)))
    Invoke-Aws s3api put-bucket-cors --region $Region --bucket $UploadsBucket --cors-configuration "file://$corsFile" | Out-Null
}

Write-Host "Backups written to $backupDir" -ForegroundColor Cyan
Write-Host "Primary portal URL: $primaryPortalRoot" -ForegroundColor Cyan
Write-Host "Legacy portal URL:  $legacyPortalRoot" -ForegroundColor Cyan
Write-Host "Admin URL:          $adminRoot" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next:" -ForegroundColor Cyan
Write-Host "1. Request/validate the ACM certificate for $primaryPortalRoot."
Write-Host "2. Apply the Terraform prod changes."
Write-Host "3. Update the portal WAF CAPTCHA API key in X:\\ISET\\ISET-intake\\.env.production if you rotate it."
Write-Host "4. Rebuild/redeploy the portal artifact and refresh prod instances."
