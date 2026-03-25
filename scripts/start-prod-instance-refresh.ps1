<#
  Starts an instance refresh for the NWAC prod Auto Scaling Group.

.PARAMETER Region
  AWS region for the Auto Scaling Group. Defaults to ca-central-1.

.PARAMETER Profile
  AWS CLI profile to use. Defaults to default.

.PARAMETER AsgName
  Prod Auto Scaling Group name. Defaults to nwac-prod-asg.

.PARAMETER Preferences
  Instance refresh preferences passed straight to AWS CLI.

.PARAMETER Wait
  Poll until the refresh reaches a terminal state.
#>
[CmdletBinding()]
param(
    [string]$Profile = "default",
    [string]$Region = "ca-central-1",
    [string]$AsgName = "nwac-prod-asg",
    [string]$Preferences = "MinHealthyPercentage=100,InstanceWarmup=900,SkipMatching=false",
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

Ensure-Tool "aws"

function Invoke-Aws {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Args
    )

    & aws @Args --profile $Profile
    if ($LASTEXITCODE -ne 0) {
        throw ("AWS CLI command failed with exit code {0}: aws {1}" -f $LASTEXITCODE, ($Args -join ' '))
    }
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
