$ErrorActionPreference='Stop'
Set-Location -LiteralPath $PSScriptRoot
if(-not(Get-Command docker -ErrorAction SilentlyContinue)){throw 'Instale e abra o Docker Desktop com suporte a contêineres Linux antes de iniciar.'}
$taskConfig=Join-Path $env:LOCALAPPDATA 'MarIA/WhatsApp/config.env'
if(-not(Test-Path -LiteralPath $taskConfig)){throw 'Execute configurar.ps1 primeiro.'}
docker compose --env-file $taskConfig up -d --build
if($LASTEXITCODE -ne 0){throw 'Não foi possível iniciar. Confirme que o Docker Desktop está aberto.'}
Write-Host 'Serviços iniciados. O primeiro início pode levar alguns minutos.'
Start-Process 'http://localhost:8790'
