<#
.SYNOPSIS
    Deploy the NWAC test database snapshot.

.DESCRIPTION
    This script is being rebuilt incrementally. Each section will be added, tested,
    and extended to safely restore the test database and restart the application
    services.
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

### Configuration #############################################################
$SnapshotPath = 'X:\ISET\admin-dashboard\docs\data\snapshot.sql'
$Region       = 'ca-central-1'
$Bucket       = 'nwac-test-artifacts'
$KeyPrefix    = 'db'
$InstanceIds  = @(
    'i-0340a978855ebcad5',
    'i-0fea7caead932d11e'
)
$DbHost      = 'nwac-test-db.cluster-cn4yoy2s4w5t.ca-central-1.rds.amazonaws.com'
$DbName      = 'iset_intake'
$DbUser      = 'app_admin'
$DbPassword  = 'iNmVn0zIFUP16QeJ-^zE'

### Helpers ###################################################################
function Write-Section {
    param(
        [Parameter(Mandatory = $true)][string]$Message
    )

    Write-Host ''
    Write-Host ("=== {0} ===" -f $Message) -ForegroundColor Cyan
}

function Ensure-Tool {
    param(
        [Parameter(Mandatory = $true)][string]$Name
    )

    if (-not (Get-Command -Name $Name -ErrorAction SilentlyContinue)) {
        throw "Required tool '$Name' not found in PATH."
    }
}

function Invoke-AwsCli {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    $renderedArgs = $Arguments -join ' '
    $previousErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'

    try {
        $output = & aws @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    } catch {
        $exitCode = 1
        $output = $_.Exception.Message
    } finally {
        $ErrorActionPreference = $previousErrorPreference
    }

    if ($exitCode -ne 0) {
        throw "aws $renderedArgs failed: $output"
    }

    if ($output -is [System.Array]) {
        return ($output -join [Environment]::NewLine)
    }

    return [string]$output
}

function Wait-SsmCommand {
    param(
        [Parameter(Mandatory = $true)][string]$CommandId,
        [Parameter(Mandatory = $true)][string]$InstanceId,
        [Parameter(Mandatory = $true)][string]$Region,
        [int]$PollSeconds = 5
    )

    while ($true) {
        Start-Sleep -Seconds $PollSeconds

        $statusJson = Invoke-AwsCli -Arguments @(
            'ssm', 'get-command-invocation',
            '--command-id', $CommandId,
            '--instance-id', $InstanceId,
            '--region', $Region,
            '--output', 'json'
        )

        $status = $statusJson | ConvertFrom-Json
        switch ($status.Status) {
            'Pending'   { continue }
            'InProgress'{ continue }
            'Delayed'   { continue }
            'Success'   {
                if ($status.StandardOutputContent) {
                    Write-Host $status.StandardOutputContent.Trim()
                }
                if ($status.StandardErrorContent) {
                    Write-Warning $status.StandardErrorContent.Trim()
                }
                return
            }
            'Cancelled' { throw "SSM command $CommandId was cancelled." }
            'TimedOut'  { throw "SSM command $CommandId timed out." }
            default     {
                $stderr = $status.StandardErrorContent
                throw "SSM command $CommandId failed on $InstanceId. Status=$($status.Status). StdErr=$stderr"
            }
        }
    }
}

### Pre-flight Checks #########################################################
Write-Section -Message 'Pre-flight checks'
Ensure-Tool -Name 'aws'

if (-not (Test-Path -LiteralPath $SnapshotPath)) {
    throw "Snapshot file not found at '$SnapshotPath'."
}

if ($InstanceIds.Count -lt 1) {
    throw 'At least one instance ID must be configured.'
}

Write-Host 'Pre-flight checks passed.' -ForegroundColor Green

### Workspace Preparation #####################################################
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$tempRoot  = Join-Path ([System.IO.Path]::GetTempPath()) ("deploy-test-db-" + $timestamp)

try {
    Write-Section -Message 'Prepare workspace'

    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }

    New-Item -ItemType Directory -Path $tempRoot -ErrorAction Stop | Out-Null
    Write-Host ("Working directory: {0}" -f $tempRoot)

    Write-Section -Message 'Prepare snapshot'
    $sanitizedPath = Join-Path -Path $tempRoot -ChildPath 'snapshot.sql'
    $rawSql        = Get-Content -LiteralPath $SnapshotPath -Raw -ErrorAction Stop
    $sanitizedSql  = $rawSql -replace 'DEFINER=`[^`]+`@`[^`]+`', ''
    Set-Content -LiteralPath $sanitizedPath -Value $sanitizedSql -Encoding UTF8

    $rawBytes       = (Get-Item -LiteralPath $SnapshotPath -ErrorAction Stop).Length
    $sanitizedBytes = (Get-Item -LiteralPath $sanitizedPath -ErrorAction Stop).Length
    Write-Host ("Sanitized snapshot created at {0}" -f $sanitizedPath)
    Write-Host ("Original size:   {0:N0} bytes" -f $rawBytes)
    Write-Host ("Sanitized size:  {0:N0} bytes" -f $sanitizedBytes)

    Write-Section -Message 'Upload snapshot'
    $s3Key = '{0}/snapshot-{1}.sql' -f $KeyPrefix.TrimEnd('/'), $timestamp
    $s3Uri = 's3://{0}/{1}' -f $Bucket, $s3Key

    $uploadArgs = @('s3', 'cp', $sanitizedPath, $s3Uri, '--region', $Region)
    $uploadOutput = Invoke-AwsCli -Arguments $uploadArgs
    if ($uploadOutput) {
        Write-Host $uploadOutput
    }

    Write-Host ("Uploaded snapshot to {0}" -f $s3Uri)
    $global:DeployTestDb_State = [ordered]@{
        TempRoot = $tempRoot
        S3Uri    = $s3Uri
        S3Key    = $s3Key
        Snapshot = $sanitizedPath
    }

    Write-Section -Message 'Import database'
    $importInstance = $InstanceIds[0]
    Write-Host ("Using import instance {0}" -f $importInstance)

    $escapedPassword = $DbPassword.Replace('"', '\"')
    $importCommands = @(
        'set -euo pipefail',
        ('export MYSQL_PWD="{0}"' -f $escapedPassword),
        ('aws s3 cp {0} /tmp/snapshot.sql --region {1}' -f $s3Uri, $Region),
        ('mysql -h {0} -u {1} -e "DROP DATABASE IF EXISTS `{2}`;"' -f $DbHost, $DbUser, $DbName),
        ('mysql -h {0} -u {1} < /tmp/snapshot.sql' -f $DbHost, $DbUser),
        'rm -f /tmp/snapshot.sql',
        'unset MYSQL_PWD'
    )

    $importJson = $importCommands | ConvertTo-Json -Compress
    $escapedImportJson = $importJson.Replace([char]34, '"')
    $parameterValue = 'commands="' + $escapedImportJson + '"'

    $sendArgs = @(
        'ssm', 'send-command',
        '--document-name', 'AWS-RunShellScript',
        '--instance-ids', $importInstance,
        '--region', $Region,
        '--parameters', $parameterValue,
        '--query', 'Command.CommandId',
        '--output', 'text'
    )

    $commandId = (Invoke-AwsCli -Arguments $sendArgs).Trim()
    Write-Host ("SSM command submitted: {0}" -f $commandId)

    Wait-SsmCommand -CommandId $commandId -InstanceId $importInstance -Region $Region
    Write-Host 'Database import completed successfully.' -ForegroundColor Green
}
finally {
    Write-Section -Message 'Cleanup'

    if ($global:DeployTestDb_State -and $global:DeployTestDb_State.S3Uri) {
        try {
            $removeArgs = @('s3', 'rm', $global:DeployTestDb_State.S3Uri, '--region', $Region)
            Invoke-AwsCli -Arguments $removeArgs | Out-Null
            Write-Host ("Removed S3 object {0}" -f $global:DeployTestDb_State.S3Uri)
        } catch {
            Write-Warning ("Failed to remove S3 object {0}: {1}" -f $global:DeployTestDb_State.S3Uri, $_.Exception.Message)
        }
    }

    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host 'Temporary workspace removed.'
    } else {
        Write-Host 'No temporary workspace to remove.'
    }

    Remove-Variable -Name DeployTestDb_State -Scope Global -ErrorAction SilentlyContinue
}

Write-Section -Message 'Done'
Write-Host 'Database snapshot uploaded and import attempted.'
