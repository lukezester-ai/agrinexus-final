# Apply 001-007 on a clean Postgres 16 and run the RLS suite.
# Requires Docker Desktop.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$container = "agrinexus-007-gate"
$password = "password"
$db = "ubc_test"
$port = "55433"

function Invoke-SqlFile([string]$path) {
    Write-Host "SQL $path"
    Get-Content -Raw -LiteralPath $path | docker exec -i $container psql -U postgres -d $db -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { throw "SQL failed: $path" }
}

$prev = $ErrorActionPreference
$ErrorActionPreference = "Continue"
docker rm -f $container 2>$null | Out-Null
$ErrorActionPreference = $prev
docker run -d --name $container `
    -e POSTGRES_PASSWORD=$password `
    -e POSTGRES_DB=$db `
    -p "${port}:5432" `
    postgres:16 | Out-Null

$ready = $false
for ($i = 0; $i -lt 40; $i++) {
    docker exec $container pg_isready -U postgres -d $db | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
}
if (-not $ready) { throw "Postgres in $container did not become ready" }

Invoke-SqlFile (Join-Path $root "scripts\sql\pg_rls_test_helpers.sql")
docker exec $container psql -U postgres -d $db -v ON_ERROR_STOP=1 -c "GRANT CONNECT ON DATABASE $db TO app_user;"
if ($LASTEXITCODE -ne 0) { throw "GRANT CONNECT failed" }

@(
    "migrations\001_core_tables.sql",
    "migrations\002_enums.sql",
    "migrations\003_audit.sql",
    "migrations\004_verification.sql",
    "migrations\005_rls.sql",
    "migrations\006_business_intents.sql",
    "migrations\007_opportunities.sql"
) | ForEach-Object { Invoke-SqlFile (Join-Path $root $_) }

python -m pip install --quiet pytest psycopg2-binary
$env:DB_URL_SUPERUSER = "postgresql://postgres:${password}@127.0.0.1:${port}/${db}"
$env:DB_URL_APPUSER = "postgresql://app_user:app_password@127.0.0.1:${port}/${db}"
python -m pytest -v test_security_integration.py
$code = $LASTEXITCODE
if ($code -eq 0) {
    docker rm -f $container | Out-Null
} else {
    Write-Host "Container $container left running on port $port for inspection"
}
exit $code
