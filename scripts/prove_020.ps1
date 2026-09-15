$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$container = "agrinexus-020-gate"
$password = "password"
$db = "ubc_test"
$port = "60446"

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
docker exec $container psql -U postgres -d $db -v ON_ERROR_STOP=1 -c "DO `$`$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; END `$`$; GRANT CONNECT ON DATABASE $db TO app_user, authenticated, anon;"

$env:DB_URL_SUPERUSER = "postgresql://postgres:${password}@127.0.0.1:${port}/${db}"
$env:DB_URL_AUTHENTICATED = "postgresql://authenticated:authenticated_password@127.0.0.1:${port}/${db}"

Get-ChildItem (Join-Path $root "migrations\*.sql") |
    Where-Object { $_.Name -match '^00[1-9]_' -or $_.Name -match '^01[0-9]_' -or $_.Name -match '^020_' } |
    Sort-Object Name |
    ForEach-Object { Invoke-SqlFile $_.FullName }

python -m pytest -q test_verification_reviewer_boundary.py
$code = $LASTEXITCODE
if ($code -eq 0) {
    docker rm -f $container | Out-Null
} else {
    Write-Host "Container $container left running on port $port for inspection"
}
exit $code
