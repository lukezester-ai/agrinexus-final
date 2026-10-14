# Prove the existing 001-012 baseline, then apply the Intent v1 command boundary
# and run the focused app_user/authenticated equivalence suite.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$container = "agrinexus-013-gate"
$password = "password"
$db = "ubc_test"
$port = "55439"

function Invoke-SqlFile([string]$path) {
    Write-Host "SQL $path"
    Get-Content -Raw -LiteralPath $path | docker exec -i $container psql -U postgres -d $db -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { throw "SQL failed: $path" }
}

$previousPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
docker rm -f $container 2>$null | Out-Null
$ErrorActionPreference = $previousPreference

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
docker exec $container psql -U postgres -d $db -v ON_ERROR_STOP=1 -c "GRANT CONNECT ON DATABASE $db TO app_user, authenticated;"
if ($LASTEXITCODE -ne 0) { throw "GRANT CONNECT failed" }

@(
    "migrations\001_core_tables.sql",
    "migrations\002_enums.sql",
    "migrations\003_audit.sql",
    "migrations\004_verification.sql",
    "migrations\005_rls.sql",
    "migrations\006_business_intents.sql",
    "migrations\007_opportunities.sql",
    "migrations\008_matches.sql",
    "migrations\009_matching_engine.sql",
    "migrations\010_qualification_introduction.sql",
    "migrations\011_relationships.sql",
    "migrations\012_business_radar.sql"
) | ForEach-Object { Invoke-SqlFile (Join-Path $root $_) }

$env:DB_URL_SUPERUSER = "postgresql://postgres:${password}@127.0.0.1:${port}/${db}"
$env:DB_URL_APPUSER = "postgresql://app_user:app_password@127.0.0.1:${port}/${db}"
$env:DB_URL_AUTHENTICATED = "postgresql://authenticated:authenticated_password@127.0.0.1:${port}/${db}"

python -m pytest -q test_security_integration.py
if ($LASTEXITCODE -ne 0) { throw "001-012 regression suite failed" }

Invoke-SqlFile (Join-Path $root "migrations\013_business_intent_commands.sql")

python -m pytest -v test_business_intent_commands.py
$code = $LASTEXITCODE

if ($code -eq 0) {
    docker rm -f $container | Out-Null
} else {
    Write-Host "Container $container left running on port $port for inspection"
}
exit $code
