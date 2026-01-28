<#
  Run ad-hoc SQL against the prod database via SSM.

  Usage:
    .\scripts\run-prod-sql.ps1
    .\scripts\run-prod-sql.ps1 -SqlText "SELECT 1;"
    .\scripts\run-prod-sql.ps1 -SqlFile "X:\path\to\query.sql"
#>
[CmdletBinding()]
param(
    [string]$Profile = "nwac-prod",
    [string]$Region = "ca-central-1",
    [string]$AsgName = "nwac-prod-asg",
    [string]$Bucket = "nwac-prod-artifacts",
    [string]$DbSecretId = "nwac-prod-db-credentials",
    [string]$DbHost = "nwac-prod-db.cluster-c3g4iamg8j38.ca-central-1.rds.amazonaws.com",
    [string]$DbName = "iset_intake",
    [int]$DbPort = 3306,
    [string]$SqlFile,
    [string]$SqlText
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$env:AWS_PAGER = ""
$env:AWS_CLI_AUTO_PROMPT = "off"

function Ensure-Tool([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required tool '$Name' was not found in PATH."
    }
}

Ensure-Tool "aws"

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("prod-sql-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

try {
    if ([string]::IsNullOrWhiteSpace($SqlFile)) {
        if ([string]::IsNullOrWhiteSpace($SqlText)) {
            Write-Host "Paste SQL. End with a blank line." -ForegroundColor Cyan
            $lines = @()
            while ($true) {
                $line = Read-Host
                if ($line -eq '') { break }
                $lines += $line
            }
            if (-not $lines.Count) {
                throw "No SQL provided."
            }
            $SqlText = ($lines -join "`n")
        }
        $SqlFile = Join-Path $tempRoot "adhoc.sql"
        $SqlText | Set-Content -Path $SqlFile -Encoding ASCII
    } elseif (-not (Test-Path -LiteralPath $SqlFile)) {
        throw "SQL file not found: $SqlFile"
    }

    $sqlName = [System.IO.Path]::GetFileName($SqlFile)
    $s3Key = "db/adhoc-$($sqlName)"

    Write-Host "Uploading SQL to s3://$Bucket/$s3Key" -ForegroundColor Cyan
    aws s3 cp $SqlFile ("s3://{0}/{1}" -f $Bucket, $s3Key) --region $Region --profile $Profile | Out-Host

    $InstanceId = aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names $AsgName --region $Region --profile $Profile --query "AutoScalingGroups[0].Instances[0].InstanceId" --output text
    if (-not $InstanceId -or $InstanceId -eq "None") {
        throw "No instance found in ASG '$AsgName'."
    }

    $remoteSql = "/tmp/$sqlName"
    $cmd = @'
bash -lc 'set -euo pipefail; aws s3 cp s3://{0}/{1} {2} --region {3}; SECRET=$(aws secretsmanager get-secret-value --secret-id {4} --query SecretString --output text --region {3}); export SECRET; PY=python3; command -v python3 >/dev/null 2>&1 || PY=python; USER=$($PY -c "import json,os; print(json.loads(os.environ[\"SECRET\"]) [\"username\"])"); PASS=$($PY -c "import json,os; print(json.loads(os.environ[\"SECRET\"]) [\"password\"])"); HOST="{5}"; DB="{6}"; PORT={7}; command -v mysql >/dev/null 2>&1 || (sudo dnf install -y mariadb105 >/dev/null 2>&1 || sudo yum install -y mariadb >/dev/null 2>&1); MYSQL_PWD=$PASS mysql -h $HOST -u $USER -P $PORT $DB < {2}'
'@ -f $Bucket, $s3Key, $remoteSql, $Region, $DbSecretId, $DbHost, $DbName, $DbPort

    $payload = @{ commands = @($cmd) } | ConvertTo-Json -Compress
    $jsonPath = Join-Path $tempRoot "ssm-sql.json"
    $payload | Set-Content -Path $jsonPath -Encoding ASCII

    Write-Host "Running SQL via SSM on $InstanceId" -ForegroundColor Cyan
    $commandId = aws ssm send-command --document-name AWS-RunShellScript --targets "Key=instanceids,Values=$InstanceId" --region $Region --profile $Profile --parameters ("file://$jsonPath") --query "Command.CommandId" --output text
    if (-not $commandId) { throw "SSM command failed to start." }

    $status = ""
    do {
        Start-Sleep -Seconds 2
        $invocation = aws ssm get-command-invocation --command-id $commandId --instance-id $InstanceId --region $Region --profile $Profile --query "{Status:Status,StdOut:StandardOutputContent,StdErr:StandardErrorContent}" --output json | ConvertFrom-Json
        $status = $invocation.Status
    } while ($status -in @("Pending","InProgress","Delayed"))

    Write-Host ("Status: {0}" -f $status) -ForegroundColor Cyan
    if ($invocation.StdOut) { Write-Host $invocation.StdOut }
    if ($invocation.StdErr) { Write-Host $invocation.StdErr }

    if ($status -ne "Success") {
        throw "SSM command finished with status: $status"
    }
}
finally {
    if ($tempRoot -and (Test-Path -LiteralPath $tempRoot)) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
