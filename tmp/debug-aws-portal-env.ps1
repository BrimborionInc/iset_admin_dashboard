$ErrorActionPreference = 'Stop'
$env:AWS_PAGER = ''
$env:AWS_CLI_AUTO_PROMPT = 'off'
$aws = 'C:\Program Files\Amazon\AWSCLIV2\aws.exe'
& $aws ssm get-parameter --region ca-central-1 --with-decryption --name /nwac/prod/portal/env --query Parameter.Value --output text --profile nwac-prod-direct --no-cli-pager
Write-Host ('LASTEXIT=' + $LASTEXITCODE)
