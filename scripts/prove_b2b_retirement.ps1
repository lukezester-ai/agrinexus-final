# B2B DB retirement gate.
# Disposable Supabase only. Applies 001-013, then 014, then the same app_user + GoTrue
# Core suite as prove_minimal_core.ps1. Does not edit 001-013. Does not start Finance.
# 009 and 014 run as supabase_admin because local postgres cannot own or drop
# run_matching_engine_v1(), which belongs to intent_matcher.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$work = Join-Path $env:TEMP "ubc-b2b-retirement"
$dbContainer = "supabase_db_ubc-b2b-retirement"
$authContainer = "supabase_auth_ubc-b2b-retirement"
$network = "supabase_network_ubc-b2b-retirement"

function Invoke-Native([scriptblock]$command) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $command | Out-Host
        return $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prev
    }
}

function Invoke-SqlFile([string]$path) {
    Write-Host "SQL $path"
    $sqlPath = $path
    $container = $dbContainer
    $block = { Get-Content -Raw -LiteralPath $sqlPath | docker exec -i $container psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 }.GetNewClosure()
    $code = Invoke-Native $block
    if ($code -ne 0) { throw "SQL failed: $path" }
}

function Get-CoreFingerprint {
    $sqlPath = Join-Path $root "scripts\sql\core_surface_fingerprint.sql"
    $container = $dbContainer
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $raw = & { Get-Content -Raw -LiteralPath $sqlPath | docker exec -i $container psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -t -A } | Out-String
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prev
    if ($code -ne 0) { throw "core fingerprint failed" }
    $match = [regex]::Match($raw, "FINGERPRINT=([0-9a-f]+)")
    if (-not $match.Success) { throw "core fingerprint missing: $raw" }
    return $match.Groups[1].Value
}

if (-not (Test-Path (Join-Path $work "supabase\config.toml"))) {
    New-Item -ItemType Directory -Force -Path $work | Out-Null
    Push-Location $work
    $code = Invoke-Native { npx --yes supabase@2.118.0 init --yes }
    if ($code -ne 0) { throw "supabase init failed" }
    Pop-Location
}

Push-Location $work
$dbRunning = docker ps --filter "name=$dbContainer" --filter "status=running" --format "{{.Names}}"
if ($dbRunning -ne $dbContainer) {
    $code = Invoke-Native { npx --yes supabase@2.118.0 start --yes -x studio -x realtime -x storage-api -x imgproxy -x mailpit -x postgres-meta -x edge-runtime -x logflare -x vector -x supavisor }
    if ($code -ne 0) { throw "supabase start failed" }
}

$prev = $ErrorActionPreference
$ErrorActionPreference = "Continue"
docker rm -f $authContainer 2>$null | Out-Null
$ErrorActionPreference = $prev
$code = Invoke-Native { npx --yes supabase@2.118.0 --yes db reset --local }
if ($code -ne 0) { throw "supabase db reset failed" }

$prev = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$statusRaw = npx --yes supabase@2.118.0 status -o env 2>$null | Out-String
$statusCode = $LASTEXITCODE
$ErrorActionPreference = $prev
if ($statusCode -ne 0) { throw "supabase status failed" }
Pop-Location

function Get-StatusValue([string]$key) {
    $match = [regex]::Match($statusRaw, "(?m)^$key=(.*)$")
    if (-not $match.Success) { throw "supabase status is missing $key" }
    return $match.Groups[1].Value.Trim().Trim('"')
}

$dbUrl = Get-StatusValue "DB_URL"
if ($dbUrl -notmatch '^postgres(?:ql)?://[^:]+:[^@]+@([^/]+)/([^?]+)') {
    throw "DB_URL could not be parsed"
}
$hostPort = $Matches[1]
$dbName = $Matches[2]

Invoke-SqlFile (Join-Path $root "scripts\sql\app_user_role.sql")
$grant = { docker exec $dbContainer psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c "GRANT CONNECT ON DATABASE $dbName TO app_user;" }.GetNewClosure()
$code = Invoke-Native $grant
if ($code -ne 0) { throw "GRANT CONNECT failed" }

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
    "migrations\012_business_radar.sql",
    "migrations\013_matching_engine_invocation.sql"
) | ForEach-Object { Invoke-SqlFile (Join-Path $root $_) }

Invoke-SqlFile (Join-Path $root "scripts\sql\assert_b2b_graph_before_retirement.sql")
$before = Get-CoreFingerprint
Write-Host "CORE_FINGERPRINT_BEFORE $before"

Invoke-SqlFile (Join-Path $root "migrations\014_b2b_retirement.sql")
$after = Get-CoreFingerprint
Write-Host "CORE_FINGERPRINT_AFTER $after"
if ($before -ne $after) { throw "Core surface changed during B2B retirement" }
Invoke-SqlFile (Join-Path $root "scripts\sql\assert_b2b_retired.sql")

$prev = $ErrorActionPreference
$ErrorActionPreference = "Continue"
docker rm -f $authContainer 2>$null | Out-Null
$ErrorActionPreference = $prev
$alterAuth = { docker exec $dbContainer psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c "GRANT USAGE ON SCHEMA auth TO app_user; GRANT EXECUTE ON FUNCTION auth.uid() TO app_user; ALTER ROLE supabase_auth_admin WITH LOGIN PASSWORD 'local-gate-auth';" }.GetNewClosure()
$code = Invoke-Native $alterAuth
if ($code -ne 0) { throw "auth admin login failed" }
$startAuth = {
    docker run -d --name $authContainer `
        --network $network `
        -p 54325:9999 `
        -e GOTRUE_API_HOST=0.0.0.0 `
        -e GOTRUE_API_PORT=9999 `
        -e API_EXTERNAL_URL=http://127.0.0.1:54325 `
        -e GOTRUE_DB_DRIVER=postgres `
        -e "GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:local-gate-auth@${dbContainer}:5432/postgres?sslmode=disable" `
        -e GOTRUE_SITE_URL=http://127.0.0.1:3000 `
        -e GOTRUE_URI_ALLOW_LIST=* `
        -e GOTRUE_DISABLE_SIGNUP=false `
        -e GOTRUE_JWT_ADMIN_ROLES=service_role `
        -e GOTRUE_JWT_AUD=authenticated `
        -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated `
        -e GOTRUE_JWT_EXP=3600 `
        -e GOTRUE_JWT_SECRET=local-minimal-core-gate-jwt-secret-32b `
        -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true `
        -e GOTRUE_MAILER_AUTOCONFIRM=true `
        public.ecr.aws/supabase/gotrue:v2.197.0
}.GetNewClosure()
$code = Invoke-Native $startAuth
if ($code -ne 0) { throw "GoTrue failed to start" }
$authReady = $false
for ($i = 0; $i -lt 40; $i++) {
    try {
        $health = Invoke-WebRequest -Uri "http://127.0.0.1:54325/health" -UseBasicParsing -TimeoutSec 2
        if ($health.StatusCode -eq 200) { $authReady = $true; break }
    } catch {}
    Start-Sleep -Seconds 1
}
if (-not $authReady) { throw "GoTrue did not become ready" }

python -m pip install --quiet pytest psycopg2-binary
$env:DB_URL_SUPERUSER = $dbUrl
$env:DB_URL_APPUSER = "postgresql://app_user:app_password@${hostPort}/${dbName}"
$env:SUPABASE_AUTH_URL = "http://127.0.0.1:54325"
$env:SUPABASE_JWT_SECRET = "local-minimal-core-gate-jwt-secret-32b"

function Stop-Gate([int]$code) {
    if ($code -eq 0) {
        Push-Location $work
        npx --yes supabase@2.118.0 stop | Out-Null
        Pop-Location
        Write-Host "B2B DB RETIREMENT v1 VERIFIED. 001-013 then 014 left only Core. GoTrue session bound auth.uid() as app_user. POST /auth/token was not called."
    } else {
        Write-Host "B2B retirement gate failed. Supabase project left at $work"
    }
    exit $code
}

python (Join-Path $root "scripts\assert_minimal_core_gate.py") --phase schema
if ($LASTEXITCODE -ne 0) { Stop-Gate $LASTEXITCODE }

python (Join-Path $root "scripts\assert_supabase_session.py")
if ($LASTEXITCODE -ne 0) { Stop-Gate $LASTEXITCODE }

$coreTests = @(
    "test_app_role_is_not_privileged",
    "test_auth_uid_reads_transaction_claim",
    "test_owner_can_read_own_organization",
    "test_member_can_read_organization",
    "test_outsider_cannot_read_organization",
    "test_owner_can_read_own_org_private_data",
    "test_member_can_read_org_private_data",
    "test_user_cannot_read_other_org_private_data",
    "test_viewer_can_read_org_private_data",
    "test_viewer_cannot_insert",
    "test_viewer_cannot_update",
    "test_viewer_cannot_delete",
    "test_member_can_insert_for_self_in_own_org",
    "test_member_cannot_spoof_creator",
    "test_user_cannot_insert_into_other_org"
) | ForEach-Object { "test_security_integration.py::$_" }

python -m pytest -v @coreTests
if ($LASTEXITCODE -ne 0) { Stop-Gate $LASTEXITCODE }

python (Join-Path $root "scripts\assert_minimal_core_gate.py") --phase behavior
Stop-Gate $LASTEXITCODE
