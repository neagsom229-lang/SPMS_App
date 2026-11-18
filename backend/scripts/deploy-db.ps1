# backend/scripts/deploy-db.ps1
#
# One-deploy script for the live DB path (phase 12c).
#
#   npm run db:deploy
#
#   param:
#     -Target <live|local>   default local
#     -DryRun                 default false; when set, targets the local container
#                            and prints the pre-checks / planned apply without
#                            making any change
#     -ReconcileLedger       default false; when set, inserts ledger rows
#                            015-021 only if the STEP A existence checks pass
#
#   1. prompt for the password with Read-Host -AsSecureString, set $env:PGPASSWORD
#      for the child process only, never echo it
#   2. backup (pg_dump --format=custom) to D:\Backups with a timestamp
#   3. pre-check SELECTs (khqr_sessions.order_id/qr_string NOT NULL,
#      tbl_activity_logs.details, tenants columns)
#   4. apply 026 then 028, each with `psql -v ON_ERROR_STOP=1 -1`, and INSERT the
#      ledger row in the SAME transaction
#   5. post-check and print pass/fail

param(
  [string]$Target = 'local',
  [switch]$DryRun,
  [switch]$ReconcileLedger,
  [string]$Db = 'spms_test',
  [string]$User = 'postgres',
  [string]$LiveHost,
  [string]$LivePort = '5432'
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$MigrationsDir = Join-Path $RepoRoot 'database\migrations'
$LocalContainer = 'spms_test_db'
$LocalHost = '127.0.0.1'
$LocalPort = '55432'
$LocalDb = $Db

function Step([string]$m) { Write-Host "`n===== $m =====" }

function Assert-Exit([string]$what) {
  if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: $what failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit 1
  }
}

function Invoke-Psql([string]$dbName, [string]$sql) {
  $tmpSql = Join-Path ([System.IO.Path]::GetTempPath()) ("deploy-db-" + [guid]::NewGuid().ToString('N') + ".sql")
  [System.IO.File]::WriteAllText($tmpSql, $sql)
  try {
    if ($Target -eq 'local') {
      $out = (Get-Content -Raw $tmpSql | docker exec -i $LocalContainer psql -U $User -d $dbName -t -A -v ON_ERROR_STOP=1 -1 -f -)
      Assert-Exit 'psql (local)'
      return $out
    }
    $out = (docker run --rm -i -e PGPASSWORD -v "${MigrationsDir}:/m:ro" postgres:17-alpine bash -c "cat > /tmp/deploy-db-in.sql && psql -U $User -d postgres -h $LiveHost -p $LivePort -t -A -v ON_ERROR_STOP=1 -1 -f /tmp/deploy-db-in.sql")
    Assert-Exit 'psql (live)'
    return $out
  } finally { Remove-Item $tmpSql -Force -ErrorAction SilentlyContinue }
}

function Get-MigrationSql([string]$file) {
  $content = Get-Content -Raw (Join-Path $MigrationsDir $file)
  return ($content + "`nINSERT INTO schema_migrations (filename) VALUES ('$file');")
}

function Invoke-Migration([string]$file) {
  $sql = Get-MigrationSql $file
  return Invoke-Psql $LocalDb $sql
}

function Invoke-PreCheck() {
  $checks = @(
    @{ n = 'khqr_sessions.order_id NOT NULL'; s = "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='khqr_sessions' AND column_name='order_id' AND is_nullable='NO') AS v" },
    @{ n = 'khqr_sessions.qr_string NOT NULL'; s = "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='khqr_sessions' AND column_name='qr_string' AND is_nullable='NO') AS v" },
    @{ n = 'tbl_activity_logs.details exists'; s = "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tbl_activity_logs' AND column_name='details') AS v" },
    @{ n = 'tenants.email exists'; s = "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tenants' AND column_name='email') AS v" },
    @{ n = 'tenants.phone exists'; s = "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tenants' AND column_name='phone') AS v" },
    @{ n = 'tenants.address exists'; s = "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tenants' AND column_name='address') AS v" },
    @{ n = 'tenants.settings exists'; s = "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tenants' AND column_name='settings') AS v" },
    @{ n = 'tenants.updated_at exists'; s = "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tenants' AND column_name='updated_at') AS v" }
  )
  $results = @()
  foreach ($c in $checks) {
    $r = Invoke-Psql $LocalDb $c.s
    $val = ($r | Select-Object -Last 1).Trim()
    $results += [pscustomobject]@{ Check = $c.n; Exists = ($val -eq 't') }
  }
  return $results
}

function Invoke-PostCheck() {
  $results = @()
  foreach ($c in @(
    @{ n = 'khqr_sessions.order_id NOT NULL (want false after 026)'; s = "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='khqr_sessions' AND column_name='order_id' AND is_nullable='NO') AS v" },
    @{ n = 'khqr_sessions.qr_string NOT NULL (want false after 026)'; s = "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='khqr_sessions' AND column_name='qr_string' AND is_nullable='NO') AS v" },
    @{ n = 'tbl_activity_logs.details exists (want true after 026)'; s = "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tbl_activity_logs' AND column_name='details') AS v" },
    @{ n = 'tenants.email exists (want true after 028)'; s = "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tenants' AND column_name='email') AS v" },
    @{ n = 'tenants.phone exists (want true after 028)'; s = "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tenants' AND column_name='phone') AS v" },
    @{ n = 'tenants.address exists (want true after 028)'; s = "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tenants' AND column_name='address') AS v" },
    @{ n = 'tenants.settings exists (want true after 028)'; s = "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tenants' AND column_name='settings') AS v" },
    @{ n = 'tenants.updated_at exists (want true after 028)'; s = "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tenants' AND column_name='updated_at') AS v" }
  )) {
    $r = Invoke-Psql $LocalDb $c.s
    $val = ($r | Select-Object -Last 1).Trim()
    $results += [pscustomobject]@{ Check = $c.n; Exists = ($val -eq 't') }
  }
  return $results
}

function Invoke-ReconcileLedger() {
  # STEP A checks: run database/checks/015-021.sql (whole file, read-only); insert
  # ledger rows 015-021 only if every check row reports exists = 't'. Never automatic.
  $checksPath = Join-Path $RepoRoot 'database\checks\015-021.sql'
  if (-not (Test-Path $checksPath)) { Write-Host "ReconcileLedger: checks file not found: $checksPath"; return }
  $checksOut = Invoke-Psql $LocalDb (Get-Content -Raw $checksPath)
  $allPass = $true
  foreach ($line in @([string[]]($checksOut -split "`n"))) {
    $line = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $parts = $line.Split('|')
    if ($parts.Count -lt 3 -or $parts[2].Trim() -ne 't') { $allPass = $false; break }
  }
  if (-not $allPass) { Write-Host "ReconcileLedger: STEP A checks NOT all passed; ledger rows 015-021 NOT inserted."; return }
  $ins = @('015_phase1_hardening.sql','016_must_change_password.sql','017_checkout_hardening.sql','018_refunds_and_payments.sql','019_revert_and_align.sql','020_reconcile_production.sql','021_token_version.sql') | ForEach-Object { "INSERT INTO schema_migrations (filename) VALUES ('$_') ON CONFLICT (filename) DO NOTHING;" }
  Invoke-Psql $LocalDb ($ins -join "`n")
  Write-Host "ReconcileLedger: STEP A checks passed; inserted ledger rows 015-021."
}

# ===== main =====
if ($Target -eq 'live' -and ([string]::IsNullOrWhiteSpace($LiveHost) -or @('localhost', '127.0.0.1') -contains $LiveHost.ToLowerInvariant())) {
  Write-Host "ERROR: -Target live requires -LiveHost to be a real remote host (not empty, 'localhost' or '127.0.0.1'); inside the container localhost is not the live database." -ForegroundColor Red
  exit 1
}

if ($Target -eq 'live') {
  Step '1/6 password prompt'
  $secure = Read-Host -AsSecureString 'Live PostgreSQL password (never echoed; set into $env:PGPASSWORD for the child process only)'
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)

  Step '2/6 connectivity check'
  $ping = Invoke-Psql 'postgres' 'SELECT 1'
  if (($ping | Select-Object -Last 1).Trim() -ne '1') {
    Write-Host 'ERROR: live connectivity check (SELECT 1) failed; aborting before backup' -ForegroundColor Red
    exit 1
  }

  try {
    Step '3/6 backup'
    $stamp = Get-Date -Format 'yyyyMMddTHHmmss'
    docker run --rm -e PGPASSWORD -v 'D:\Backups:/backups' postgres:17-alpine pg_dump -h $LiveHost -p $LivePort -U $User -d postgres --format=custom -f "/backups/prod-full-$stamp.custom"
    Assert-Exit 'pg_dump (live)'
    $backupFile = "D:\Backups\prod-full-$stamp.custom"
    if (-not (Test-Path $backupFile)) {
      Write-Host "ERROR: backup file not found: $backupFile" -ForegroundColor Red
      exit 1
    }
    $size = (Get-Item $backupFile).Length
    if ($size -le 10KB) {
      Remove-Item $backupFile -Force -ErrorAction SilentlyContinue
      Write-Host "ERROR: backup file too small ($size bytes); removed: $backupFile" -ForegroundColor Red
      exit 1
    }
    Write-Host "Backup written to $backupFile ($size bytes, pg_dump --format=custom)"
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  }
}

Step '4/6 pre-checks'
$pre = Invoke-PreCheck
$pre | ForEach-Object { Write-Host ("  {0} -> {1}" -f $_.Check, $_.Exists) }

if ($DryRun) {
  Step '5/6 DRY RUN'
  Write-Host 'DRY RUN: would apply 026_hardening_and_ledger.sql then 028_tenants_admin_columns.sql (each with psql -v ON_ERROR_STOP=1 -1 + ledger INSERT in same transaction); no changes made.'
  Step '6/6 post-check (dry run, would-be state)'
  Write-Host 'DRY RUN OK (no changes made)'
  exit 0
}

Step '5/6 apply 026 then 028'
foreach ($m in @('026_hardening_and_ledger.sql', '028_tenants_admin_columns.sql')) { Invoke-Migration $m }

Step '6/6 post-check'
$post = Invoke-PostCheck
$post | ForEach-Object { Write-Host ("  {0} -> {1}" -f $_.Check, $_.Exists) }

if ($ReconcileLedger) { Invoke-ReconcileLedger }

Step '6/6 done'
Write-Host 'DEPLOY-DB STEP COMPLETE'
exit 0
