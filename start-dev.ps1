# Generates VS Code tasks that open named integrated terminals. Use -ExternalWindows
# to fall back to the old behavior of launching separate PowerShell windows.
param(
    [int]$DelayMilliseconds = 300,
    [switch]$ExternalWindows
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

$tasksDir = Join-Path $root '.vscode'
$tasksPath = Join-Path $tasksDir 'tasks.json'

$tasks = @(
    @{
        label = 'Public Frontend'
        type = 'shell'
        command = 'npm start'
        options = @{ cwd = (Join-Path $root 'ISET-intake') }
        presentation = @{ panel = 'new'; reveal = 'always' }
        problemMatcher = @()
    },
    @{
        label = 'Public Backend'
        type = 'shell'
        command = 'nodemon server.js'
        options = @{ cwd = (Join-Path $root 'ISET-intake') }
        presentation = @{ panel = 'new'; reveal = 'always' }
        problemMatcher = @()
    },
    @{
        label = 'MinIO'
        type = 'shell'
        command = 'npm run MinIO'
        options = @{ cwd = (Join-Path $root 'ISET-intake') }
        presentation = @{ panel = 'new'; reveal = 'always' }
        problemMatcher = @()
    },
    @{
        label = 'Admin Frontend'
        type = 'shell'
        command = 'npm start'
        options = @{ cwd = (Join-Path $root 'admin-dashboard') }
        presentation = @{ panel = 'new'; reveal = 'always' }
        problemMatcher = @()
    },
    @{
        label = 'Admin Backend'
        type = 'shell'
        command = 'nodemon isetadminserver.js'
        options = @{ cwd = (Join-Path $root 'admin-dashboard') }
        presentation = @{ panel = 'new'; reveal = 'always' }
        problemMatcher = @()
    },
    @{
        label = 'dev:all'
        dependsOrder = 'parallel'
        dependsOn = @(
            'Public Frontend'
            'Public Backend'
            'MinIO'
            'Admin Frontend'
            'Admin Backend'
        )
        problemMatcher = @()
    }
)

if (-not (Test-Path $tasksDir)) {
    New-Item -ItemType Directory -Path $tasksDir -Force | Out-Null
}

@{
    version = '2.0.0'
    tasks = $tasks
} | ConvertTo-Json -Depth 6 | Set-Content -Path $tasksPath -Encoding ascii

Write-Host "VS Code tasks written to $tasksPath"
Write-Host "Open VS Code, then run Terminal -> Run Task -> dev:all (or individual tasks) to launch named integrated terminals."

if (-not $ExternalWindows) {
    return
}

$processes = @(
    @{
        Title    = 'ISET-intake | npm start'
        Dir      = Join-Path $root 'ISET-intake'
        Command  = 'npm start'
    },
    @{
        Title    = 'ISET-intake | nodemon server.js'
        Dir      = Join-Path $root 'ISET-intake'
        Command  = 'nodemon server.js'
    },
    @{
        Title    = 'ISET-intake | npm run MinIO'
        Dir      = Join-Path $root 'ISET-intake'
        Command  = 'npm run MinIO'
    },
    @{
        Title    = 'admin-dashboard | npm start'
        Dir      = Join-Path $root 'admin-dashboard'
        Command  = 'npm start'
    },
    @{
        Title    = 'admin-dashboard | nodemon isetadminserver.js'
        Dir      = Join-Path $root 'admin-dashboard'
        Command  = 'nodemon isetadminserver.js'
    }
)

function Start-DevProcess {
    param(
        [string]$Title,
        [string]$Dir,
        [string]$Command
    )

    if (-not (Test-Path $Dir)) {
        Write-Warning "Skipping $Title because '$Dir' was not found."
        return
    }

    Write-Host "Starting $Title"
    $psCommand = "Set-Location `"$Dir`"; $Command"

    Start-Process -FilePath 'powershell.exe' `
        -ArgumentList '-NoExit', '-Command', $psCommand `
        -WorkingDirectory $Dir `
        -WindowStyle Normal `
        | Out-Null
}

foreach ($process in $processes) {
    Start-DevProcess @process
    Start-Sleep -Milliseconds $DelayMilliseconds
}
