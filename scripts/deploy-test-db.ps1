param(
    [Parameter(Mandatory = $true)]
    [string]$DumpPath,

    [string]$Region = "ca-central-1",
    [string]$InstanceId = "i-0d52610f86e7d41d4",
    [string]$DbHost = "nwac-test-db.cluster-cn4yoy2s4w5t.ca-central-1.rds.amazonaws.com",
    [string]$DbName = "iset_intake",
    [string]$DbUser = "app_admin",
    [System.Security.SecureString]$DbPassword = (ConvertTo-SecureString 'iNmVn0zIFUP16QeJ-^zE' -AsPlainText -Force),
    [switch]$SkipRestart
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$plainPassword = $null
function Get-PlainText {
    param([System.Security.SecureString]$Secure)
    if (-not $Secure) { return '' }
    $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
    try {
        return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

if (-not (Test-Path -LiteralPath $DumpPath)) {
    throw "Dump path '$DumpPath' not found."
}

function Invoke-AwsCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Command,
        [int]$RetryCount = 3,
        [int]$DelaySeconds = 3
    )

    for ($attempt = 1; $attempt -le $RetryCount; $attempt++) {
        try {
            return Invoke-Expression $Command
        } catch {
            if ($attempt -eq $RetryCount) { throw }
            Start-Sleep -Seconds $DelaySeconds
        }
    }
}

$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$workRoot = Join-Path ([System.IO.Path]::GetTempPath()) "deploy-test-db-$timestamp"
New-Item -ItemType Directory -Path $workRoot | Out-Null

try {
    $rawSql = Get-Content -LiteralPath $DumpPath -Raw
    $sanitizedSql = $rawSql -replace "DEFINER=`[^`]+`@`[^`]+` ", ""
    $sanitizedPath = Join-Path $workRoot "dump.sql"
    Set-Content -LiteralPath $sanitizedPath -Value $sanitizedSql -Encoding UTF8

    $bucketName = ("nwac-test-db-import-{0}" -f ([Guid]::NewGuid().ToString("N").Substring(0, 12))).ToLower()
    Invoke-AwsCommand "aws s3 mb s3://$bucketName --region $Region" | Out-Null
    try {
        Invoke-AwsCommand "aws s3 cp `"$sanitizedPath`" s3://$bucketName/dump.sql --region $Region" | Out-Null
        $presignedUrl = Invoke-AwsCommand "aws s3 presign s3://$bucketName/dump.sql --region $Region --expires-in 3600"

        $plainPassword = Get-PlainText $DbPassword
        $dropCreate = ('mysql -h {0} -u {1} -p''{2}'' -e "DROP DATABASE IF EXISTS {3}; CREATE DATABASE {3};"' -f $DbHost, $DbUser, $plainPassword, $DbName)
        $importCmd = ('mysql -h {0} -u {1} -p''{2}'' {3} < /tmp/dump.sql' -f $DbHost, $DbUser, $plainPassword, $DbName)

        $commands = @(
            "curl -L `"$presignedUrl`" -o /tmp/dump.sql",
            $dropCreate,
            $importCmd,
            "rm /tmp/dump.sql"
        )

        $payloadPath = Join-Path $workRoot "ssm-payload.json"
        @{ commands = $commands } | ConvertTo-Json -Compress | Set-Content -LiteralPath $payloadPath -Encoding UTF8

        $sendCmd = "aws ssm send-command --region $Region --instance-ids $InstanceId --document-name `"AWS-RunShellScript`" --parameters file://$payloadPath --query `"Command.CommandId`" --output text"
        $commandId = Invoke-AwsCommand $sendCmd

        do {
            Start-Sleep -Seconds 5
            $statusRaw = Invoke-AwsCommand "aws ssm get-command-invocation --region $Region --command-id $commandId --instance-id $InstanceId --output json"
            $status = $statusRaw | ConvertFrom-Json
        } while ($status.Status -eq "InProgress" -or $status.Status -eq "Pending" -or $status.Status -eq "Delayed")

        if ($status.Status -ne "Success") {
            throw "Import failed: $($status.Status). StdErr: $($status.StandardErrorContent)"
        }

        if (-not $SkipRestart.IsPresent) {
            $restartPayload = @{ commands = @("cd /opt/nwac/admin-dashboard","pm2 restart nwac-admin") } | ConvertTo-Json -Compress
            $restartPath = Join-Path $workRoot "restart.json"
            Set-Content -LiteralPath $restartPath -Value $restartPayload -Encoding UTF8
            $restartSend = "aws ssm send-command --region $Region --instance-ids $InstanceId --document-name `"AWS-RunShellScript`" --parameters file://$restartPath --query `"Command.CommandId`" --output text"
            $restartId = Invoke-AwsCommand $restartSend
            do {
                Start-Sleep -Seconds 3
                $restartStatusRaw = Invoke-AwsCommand "aws ssm get-command-invocation --region $Region --command-id $restartId --instance-id $InstanceId --output json"
                $restartStatus = $restartStatusRaw | ConvertFrom-Json
            } while ($restartStatus.Status -eq "InProgress" -or $restartStatus.Status -eq "Pending" -or $restartStatus.Status -eq "Delayed")

            if ($restartStatus.Status -ne "Success") {
                throw "PM2 restart failed: $($restartStatus.Status). StdErr: $($restartStatus.StandardErrorContent)"
            }
        }
    }
    finally {
        Invoke-AwsCommand "aws s3 rm s3://$bucketName/dump.sql --region $Region" 2>$null | Out-Null
        Invoke-AwsCommand "aws s3 rb s3://$bucketName --region $Region" 2>$null | Out-Null
    }
}
finally {
    if ($plainPassword) { $plainPassword = $null }
    Remove-Item -LiteralPath $workRoot -Recurse -Force -ErrorAction SilentlyContinue
}