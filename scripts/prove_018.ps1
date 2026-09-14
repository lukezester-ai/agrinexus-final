$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$container = "agrinexus-018-gate"
$password = "password"
$db = "ubc_test"
$port = "60444"

function Invoke-SqlFile([string]$path) {
    Write-Host "SQL $path"
    Get-Content -Raw -LiteralPath $path | docker exec -i $container psql -U postgres -d $db -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { throw "SQL failed: $path" }
}

$oldPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
docker rm -f $container 2>$null | Out-Null
$ErrorActionPreference = $oldPreference

docker run -d --name $container -e POSTGRES_PASSWORD=$password -e POSTGRES_DB=$db -p "${port}:5432" postgres:16 | Out-Null
$ready = $false
$oldPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
for ($i = 0; $i -lt 40; $i++) {
    docker exec $container psql -U postgres -d $db -c "SELECT 1" 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
}
$ErrorActionPreference = $oldPreference
if (-not $ready) { throw "Postgres in $container did not become ready" }

Invoke-SqlFile (Join-Path $root "scripts\sql\pg_rls_test_helpers.sql")
docker exec $container psql -U postgres -d $db -v ON_ERROR_STOP=1 -c "GRANT CONNECT ON DATABASE $db TO app_user, authenticated;"

$env:DB_URL_SUPERUSER = "postgresql://postgres:${password}@127.0.0.1:${port}/${db}"
$env:DB_URL_APPUSER = "postgresql://app_user:app_password@127.0.0.1:${port}/${db}"
$env:DB_URL_AUTHENTICATED = "postgresql://authenticated:authenticated_password@127.0.0.1:${port}/${db}"

Get-ChildItem (Join-Path $root "migrations\*.sql") |
    Where-Object { $_.Name -match '^00[1-9]_' -or $_.Name -match '^01[0-2]_' } |
    Sort-Object Name |
    ForEach-Object { Invoke-SqlFile $_.FullName }

python -m pytest -q test_security_integration.py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Invoke-SqlFile (Join-Path $root "migrations\013_business_intent_commands.sql")
python -m pytest -q test_business_intent_commands.py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Invoke-SqlFile (Join-Path $root "migrations\014_matching_product_boundary.sql")
Invoke-SqlFile (Join-Path $root "migrations\015_matching_command_boundary_hardening.sql")
python -m pytest -q test_matching_product_boundary.py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Invoke-SqlFile (Join-Path $root "migrations\016_trust_verification_integration.sql")
python -m pytest -q test_trust_verification_integration.py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Invoke-SqlFile (Join-Path $root "migrations\017_business_opportunity_commands.sql")
python -m pytest -q test_business_opportunity_commands.py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Invoke-SqlFile (Join-Path $root "migrations\018_introduction_actor_capabilities.sql")
python -m pytest -q test_introduction_actor_capabilities.py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Invoke-SqlFile (Join-Path $root "migrations\019_notification_return_loop.sql")
python -m pytest -q test_notification_return_loop.py
$code = $LASTEXITCODE

if ($code -eq 0) {
    docker rm -f $container | Out-Null
} else {
    Write-Host "Container $container left running on port $port for inspection"
}
exit $code
