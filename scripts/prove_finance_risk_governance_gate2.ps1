# Risk governance v1 gate 2. Disposable Supabase, migrations 001-005 then 015 through 026.
# A stored policy is compared with metrics an existing book already recorded.
# Does not change human approval. Does not apply 006-014.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$work = Join-Path $env:TEMP "ubc-finance-risk-gate2"
$dbContainer = "supabase_db_ubc-finance-risk-gate2"
$authContainer = "supabase_auth_ubc-finance-risk-gate2"
$network = "supabase_network_ubc-finance-risk-gate2"

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
    "migrations\005_rls.sql"
) | ForEach-Object { Invoke-SqlFile (Join-Path $root $_) }

$before = Get-CoreFingerprint
Invoke-SqlFile (Join-Path $root "migrations\015_finance_foundation.sql")
$after015 = Get-CoreFingerprint
Invoke-SqlFile (Join-Path $root "migrations\016_finance_market_data.sql")
$after016 = Get-CoreFingerprint
Invoke-SqlFile (Join-Path $root "migrations\017_finance_strategy_dsl.sql")
$after017 = Get-CoreFingerprint
Invoke-SqlFile (Join-Path $root "migrations\018_finance_paper_book.sql")
$after018 = Get-CoreFingerprint
Invoke-SqlFile (Join-Path $root "migrations\019_finance_screener.sql")
$after019 = Get-CoreFingerprint
Invoke-SqlFile (Join-Path $root "migrations\020_finance_market_snapshot.sql")
$after020 = Get-CoreFingerprint
Invoke-SqlFile (Join-Path $root "migrations\021_finance_snapshot_strategy.sql")
$after021 = Get-CoreFingerprint
Invoke-SqlFile (Join-Path $root "migrations\022_finance_strategy_compiler.sql")
$after022 = Get-CoreFingerprint
Invoke-SqlFile (Join-Path $root "migrations\023_finance_compiled_strategy.sql")
$after023 = Get-CoreFingerprint
Invoke-SqlFile (Join-Path $root "migrations\024_finance_strategy_approval.sql")
$after024 = Get-CoreFingerprint
Invoke-SqlFile (Join-Path $root "migrations\025_finance_risk_policy.sql")
$after025 = Get-CoreFingerprint
Invoke-SqlFile (Join-Path $root "migrations\026_finance_risk_evaluation.sql")
$after = Get-CoreFingerprint
Write-Host "CORE_FINGERPRINT_BEFORE $before"
Write-Host "CORE_FINGERPRINT_AFTER_015 $after015"
Write-Host "CORE_FINGERPRINT_AFTER_016 $after016"
Write-Host "CORE_FINGERPRINT_AFTER_017 $after017"
Write-Host "CORE_FINGERPRINT_AFTER_018 $after018"
Write-Host "CORE_FINGERPRINT_AFTER_019 $after019"
Write-Host "CORE_FINGERPRINT_AFTER_020 $after020"
Write-Host "CORE_FINGERPRINT_AFTER_021 $after021"
Write-Host "CORE_FINGERPRINT_AFTER_022 $after022"
Write-Host "CORE_FINGERPRINT_AFTER_023 $after023"
Write-Host "CORE_FINGERPRINT_AFTER_024 $after024"
Write-Host "CORE_FINGERPRINT_AFTER_025 $after025"
Write-Host "CORE_FINGERPRINT_AFTER_026 $after"
if ($before -ne $after025 -or $after025 -ne $after) { throw "Core surface changed when risk evaluation was added" }

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
        -p 54337:9999 `
        -e GOTRUE_API_HOST=0.0.0.0 `
        -e GOTRUE_API_PORT=9999 `
        -e API_EXTERNAL_URL=http://127.0.0.1:54337 `
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
        $health = Invoke-WebRequest -Uri "http://127.0.0.1:54337/health" -UseBasicParsing -TimeoutSec 2
        if ($health.StatusCode -eq 200) { $authReady = $true; break }
    } catch {}
    Start-Sleep -Seconds 1
}
if (-not $authReady) { throw "GoTrue did not become ready" }

python -m pip install --quiet pytest psycopg2-binary
$env:PYTHONPATH = Join-Path $root "verticals\finance"
$env:DB_URL_SUPERUSER = $dbUrl
$env:DB_URL_APPUSER = "postgresql://app_user:app_password@${hostPort}/${dbName}"
$env:SUPABASE_AUTH_URL = "http://127.0.0.1:54337"
$env:SUPABASE_JWT_SECRET = "local-minimal-core-gate-jwt-secret-32b"

function Stop-Gate([int]$code) {
    if ($code -eq 0) {
        Push-Location $work
        npx --yes supabase@2.118.0 stop | Out-Null
        Pop-Location
        Write-Host "RISK GOVERNANCE V1 GATE 2 POLICY EVALUATION VERIFIED. Core unchanged. Approval unchanged. No broker."
    } else {
        Write-Host "Risk governance v1 gate 2 failed. Supabase project left at $work"
    }
    exit $code
}

python (Join-Path $root "scripts\assert_supabase_session.py")
if ($LASTEXITCODE -ne 0) { Stop-Gate $LASTEXITCODE }

python -m pytest -v (Join-Path $root "verticals\finance\engine\test_engine.py") (Join-Path $root "verticals\finance\engine\test_ingest.py") (Join-Path $root "verticals\finance\engine\test_dsl.py") (Join-Path $root "verticals\finance\engine\test_book.py") (Join-Path $root "verticals\finance\engine\test_screener.py") (Join-Path $root "verticals\finance\engine\test_snapshot.py") (Join-Path $root "verticals\finance\engine\test_copilot.py") (Join-Path $root "verticals\finance\engine\test_compiled_run.py") (Join-Path $root "verticals\finance\engine\test_policy.py") (Join-Path $root "verticals\finance\engine\test_evaluation.py") (Join-Path $root "verticals\finance\test_gate.py") (Join-Path $root "verticals\finance\test_market_gate.py") (Join-Path $root "verticals\finance\test_strategy_gate.py") (Join-Path $root "verticals\finance\test_book_gate.py") (Join-Path $root "verticals\finance\test_screener_gate.py") (Join-Path $root "verticals\finance\test_snapshot_gate.py") (Join-Path $root "verticals\finance\test_integration_gate.py") (Join-Path $root "verticals\finance\test_copilot_gate.py") (Join-Path $root "verticals\finance\test_copilot_engine_gate.py") (Join-Path $root "verticals\finance\test_approval_gate.py") (Join-Path $root "verticals\finance\test_risk_policy_gate.py") (Join-Path $root "verticals\finance\test_risk_evaluation_gate.py")
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
