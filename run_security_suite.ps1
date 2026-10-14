# PowerShell script: run_security_suite.ps1
# ---------------------------------------------------------------
# This script sets up a virtual environment, installs test dependencies,
# configures two DSNs (super‑user and app user), creates minimal Supabase
# helpers required for plain PostgreSQL, applies the migrations, and runs
# the RLS test suite.
# ---------------------------------------------------------------

# ---- 1. Create and activate virtual environment --------------------------------
python -m venv .venv
& .\.venv\Scripts\Activate.ps1

# ---- 2. Install Python test dependencies ---------------------------------------
pip install --quiet pytest psycopg2-binary python-dotenv

# ---- 3. Set DSN environment variables (adjust passwords as needed) -----------
$env:DB_URL_SUPERUSER = "postgresql://postgres:password@localhost/ubc_test"
$env:DB_URL_APPUSER   = "postgresql://app_user:app_password@localhost/ubc_test"

# Safety check – the two DSNs must be different
if ($env:DB_URL_SUPERUSER -eq $env:DB_URL_APPUSER) {
    Write-Error "DB_URL_SUPERUSER and DB_URL_APPUSER must be different."
    exit 1
}

# ---- 4. Helper: create minimal Supabase‑compatible objects for plain PostgreSQL -----
# These statements are only needed when you run against a vanilla PostgreSQL
# instance (no Supabase extensions). They create the "auth" schema and a stub
# for auth.uid() that returns the JWT claim set via the GUC request.jwt.claims.sub.
Write-Host "\nEnsuring Supabase‑compatible helpers exist…"
$helperSql = @"
CREATE SCHEMA IF NOT EXISTS auth;

-- The auth.uid() function used in RLS policies.
-- It returns the UUID stored in the GUC request.jwt.claims.sub.
-- If the GUC is not set, we fall back to the current_user (as UUID) for safety.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
    SELECT CASE
        WHEN current_setting('request.jwt.claims.sub', true) IS NOT NULL THEN
            current_setting('request.jwt.claims.sub')::uuid
        ELSE
            current_user::uuid
    END;
$$ LANGUAGE sql STABLE;

-- Ensure the uuid generation function used in tables is available.
-- pgcrypto provides gen_random_uuid().
CREATE EXTENSION IF NOT EXISTS pgcrypto;
"@
# Execute the helper SQL using the super‑user DSN.
psql $env:DB_URL_SUPERUSER -c "$helperSql"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to create Supabase helpers (exit code $LASTEXITCODE)."
    exit $LASTEXITCODE
}

# ---- 5. Apply migrations (001‑006) --------------------------------------------
Write-Host "\nApplying migrations …"
$migrationFiles = @(
    "migrations\001_core_tables.sql",
    "migrations\002_enums.sql",
    "migrations\003_audit.sql",
    "migrations\004_verification.sql",
    "migrations\005_rls.sql",
    "migrations\006_business_intents.sql"
)
foreach ($file in $migrationFiles) {
    Write-Host "Executing $file …"
    psql $env:DB_URL_SUPERUSER -f $file
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Migration $file failed (exit code $LASTEXITCODE)."
        exit $LASTEXITCODE
    }
}

# ---- 6. Run the pytest suite ---------------------------------------------------
Write-Host "\nRunning security validation suite …"
pytest -v test_security_integration.py

Write-Host "\n=== Test run complete ==="
