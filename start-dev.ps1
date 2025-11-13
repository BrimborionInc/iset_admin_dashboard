# Starts each dev process in its own PowerShell window.
param(
    [int]$DelayMilliseconds = 300
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

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
