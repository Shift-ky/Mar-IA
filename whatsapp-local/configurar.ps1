param([string]$SiteUrl='https://financas-familia-robson.merryscout8.chatgpt.site')
$ErrorActionPreference='Stop'
Set-Location -LiteralPath $PSScriptRoot
$taskConfig=Join-Path $env:LOCALAPPDATA 'MarIA/WhatsApp/config.env'
if(Test-Path -LiteralPath $taskConfig){Write-Host 'A configuração já existe. Use iniciar.ps1 para continuar.';exit 0}
New-Item -ItemType Directory -Path (Split-Path $taskConfig) -Force | Out-Null
function New-MarSecret { $taskBytes=New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($taskBytes); return -join ($taskBytes | ForEach-Object {$_.ToString('x2')}) }
$taskSecure=Read-Host 'Segredo EVOLUTION_BRIDGE_SECRET configurado na Mar IA' -AsSecureString
$taskPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecure)
try{$taskSecret=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPointer)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPointer)}
if($taskSecret -notmatch '^[a-f0-9]{64}$'){throw 'Use o segredo de 64 caracteres fornecido na configuração segura.'}
$taskValues=@("MAR_SITE_URL=$SiteUrl",'EVOLUTION_INSTANCE=mar-ia',"EVOLUTION_BRIDGE_SECRET=$taskSecret",('EVOLUTION_API_KEY='+(New-MarSecret)),('POSTGRES_PASSWORD='+(New-MarSecret)),('EVOLUTION_LOCAL_SECRET='+(New-MarSecret)))
[IO.File]::WriteAllLines($taskConfig,$taskValues)
icacls $taskConfig /inheritance:r /grant:r "${env:USERNAME}:(F)" | Out-Null
$taskSecret=$null
Write-Host 'Configuração local salva na área privada do usuário. Agora execute iniciar.ps1.'
