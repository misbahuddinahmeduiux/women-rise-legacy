param(
  [Parameter(Mandatory = $true)]
  [string]$EnvPath
)

if (-not (Test-Path -LiteralPath $EnvPath)) {
  Write-Error "Environment file not found: $EnvPath"
  exit 2
}

$content = Get-Content -LiteralPath $EnvPath -Raw
if ($content -match '(?m)^PAYMENT_CREDENTIALS_ENCRYPTION_KEY=.+$') {
  Write-Host 'Payment credential encryption key already exists.'
  exit 0
}

$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$bytes = New-Object byte[] 32
$rng.GetBytes($bytes)
$rng.Dispose()
$key = -join ($bytes | ForEach-Object { $_.ToString('x2') })
[IO.File]::AppendAllText((Resolve-Path -LiteralPath $EnvPath), "`r`nPAYMENT_CREDENTIALS_ENCRYPTION_KEY=$key`r`n")
Write-Host 'Generated PAYMENT_CREDENTIALS_ENCRYPTION_KEY in server/.env.'
