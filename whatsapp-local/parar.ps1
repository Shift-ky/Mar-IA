$ErrorActionPreference='Stop'
Set-Location -LiteralPath $PSScriptRoot
$taskConfig=Join-Path $env:LOCALAPPDATA 'MarIA/WhatsApp/config.env'
docker compose --env-file $taskConfig stop
Write-Host 'WhatsApp parado. Dados e conexão foram preservados. O Telegram não foi alterado.'
