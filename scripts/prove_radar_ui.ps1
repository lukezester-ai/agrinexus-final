# Apply 001-012, seed the Radar E2E funnel, and leave Postgres + Next ready for browser smoke.
# Requires Docker Desktop. Next listens on 3012.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$container = "agrinexus-radar-ui-gate"
$password = "password"
$db = "ubc_test"
$port = "55439"
$secret = "radar-e2e-local"
$nextPort = "3012"

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
Start-Sleep -Seconds 2

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
    "migrations\007_opportunities.sql",
    "migrations\008_matches.sql",
    "migrations\009_matching_engine.sql",
    "migrations\010_qualification_introduction.sql",
    "migrations\011_relationships.sql",
    "migrations\012_business_radar.sql"
) | ForEach-Object { Invoke-SqlFile (Join-Path $root $_) }

python -m pip install --quiet psycopg2-binary
$env:DB_URL_SUPERUSER = "postgresql://postgres:${password}@127.0.0.1:${port}/${db}"
$env:DB_URL_APPUSER = "postgresql://app_user:app_password@127.0.0.1:${port}/${db}"
$env:DB_URL_SUPERUSER = $env:DB_URL_SUPERUSER
$env:DB_URL_APPUSER = $env:DB_URL_APPUSER
python (Join-Path $root "scripts\prove_radar_e2e.py") seed
if ($LASTEXITCODE -ne 0) { throw "seed failed" }
python (Join-Path $root "scripts\prove_radar_e2e.py") roles
if ($LASTEXITCODE -ne 0) { throw "role assertions failed" }

$env:RADAR_E2E_DATABASE_URL = $env:DB_URL_APPUSER
$env:RADAR_E2E_SECRET = $secret
$env:NEXT_PUBLIC_SUPABASE_URL = "https://placeholder.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "placeholder_key"
Set-Location (Join-Path $root "apps\web")
if (-not (Test-Path "node_modules")) { npm install }
Write-Host "Starting Next on $nextPort for Radar browser smoke"
npx --yes next dev -p $nextPort
