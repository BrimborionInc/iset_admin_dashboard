<#
  Starts an instance refresh for the NWAC prod Auto Scaling Group.

.PARAMETER Region
  AWS region for the Auto Scaling Group. Defaults to ca-central-1.

.PARAMETER Profile
  AWS CLI profile to use. Defaults to nwac-prod.

.PARAMETER AsgName
  Prod Auto Scaling Group name. Defaults to nwac-prod-asg.

.PARAMETER Preferences
  Instance refresh preferences passed straight to AWS CLI. Default warmup is 180 seconds
  because the prod portal/admin instances typically pass ALB health well before that.

.PARAMETER Wait
  Poll until the refresh reaches a terminal state.
#>
[CmdletBinding()]
param(
    [string]$Profile = "nwac-prod",
    [string]$Region = "ca-central-1",
    [string]$AsgName = "nwac-prod-asg",
    [string]$Preferences = "MinHealthyPercentage=100,InstanceWarmup=180,SkipMatching=false",
    [switch]$Wait
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$env:AWS_CLI_AUTO_PROMPT = "off"
$env:AWS_PAGER = ""

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

[void](Resolve-AwsCli)

function Invoke-Aws {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Args
    )

    $awsCli = Resolve-AwsCli
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = New-Object System.Diagnostics.ProcessStartInfo
    $process.StartInfo.FileName = $awsCli
    $allArgs = @($Args)
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

$refreshId = Invoke-Aws autoscaling start-instance-refresh `
    --region $Region `
    --auto-scaling-group-name $AsgName `
    --preferences $Preferences `
    --query "InstanceRefreshId" `
    --output text

if (-not $refreshId -or $refreshId -eq "None") {
    throw "Failed to start prod instance refresh."
}

Write-Host ("Started prod instance refresh: {0}" -f $refreshId) -ForegroundColor Cyan
Write-Host ("Check status: aws autoscaling describe-instance-refreshes --region {0} --auto-scaling-group-name {1} --instance-refresh-ids {2} --output table" -f $Region, $AsgName, $refreshId)

if (-not $Wait) {
    return
}

do {
    Start-Sleep -Seconds 15
    $refresh = Invoke-Aws autoscaling describe-instance-refreshes `
        --region $Region `
        --auto-scaling-group-name $AsgName `
        --instance-refresh-ids $refreshId `
        --query "InstanceRefreshes[0].{Status:Status,PercentageComplete:PercentageComplete,Reason:StatusReason}" `
        --output json | ConvertFrom-Json

    Write-Host ("Status: {0} ({1}% complete)" -f $refresh.Status, $refresh.PercentageComplete) -ForegroundColor Cyan
    if ($refresh.Reason) {
        Write-Host $refresh.Reason
    }
} while ($refresh.Status -in @("Pending", "InProgress", "Cancelling"))

if ($refresh.Status -ne "Successful") {
    throw ("Prod instance refresh ended with status: {0}" -f $refresh.Status)
}
