$script:MutRepo   = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$script:MutReader = Join-Path $env:TEMP 'mut-read.js'
$script:MutBase   = $null
Set-Content -Path $script:MutReader -Encoding ASCII -Value @'
const r = require(process.argv[2]);
const a = r.testResults.flatMap(t => t.assertionResults);
const f = a.filter(x => x.status === 'failed');
const broken = r.testResults.filter(t => t.assertionResults.length === 0 && t.status === 'failed').length;
console.log(JSON.stringify({ total: a.length, failed: f.length, broken: broken, titles: f.slice(0, 6).map(x => x.title.slice(0, 90)) }));
'@

function Invoke-MutJest {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  $out = Join-Path $env:TEMP ("mut-" + [guid]::NewGuid().ToString('N') + ".json")
  Push-Location (Join-Path $script:MutRepo 'backend')
  try { npx jest --runInBand --silent --json --outputFile="$out" *> $null } finally { Pop-Location }
  if (-not (Test-Path $out)) { return [pscustomobject]@{ total = 0; failed = 0; broken = 1; titles = @() } }
  $res = (node $script:MutReader $out) | ConvertFrom-Json
  Remove-Item $out
  return $res
}

function Test-Mutation([string]$File, [string]$Find, [string]$Replace) {
  $p = (Resolve-Path (Join-Path $script:MutRepo $File)).Path
  if ($null -eq $script:MutBase) {
    Write-Host 'Baseline run (unmutated)...'
    $script:MutBase = Invoke-MutJest
    Write-Host ("Baseline: total={0} failed={1} broken={2}" -f $script:MutBase.total, $script:MutBase.failed, $script:MutBase.broken)
  }
  if ($script:MutBase.total -eq 0 -or $script:MutBase.failed -gt 0 -or $script:MutBase.broken -gt 0) {
    Write-Host 'ABORT: baseline is not green, so no mutation result can be trusted.'; return
  }
  $bytes = [IO.File]::ReadAllBytes($p)
  $hash  = (Get-FileHash $p).Hash
  $old   = [Text.Encoding]::UTF8.GetString($bytes)
  $hits  = [regex]::Matches($old, [regex]::Escape($Find)).Count
  if ($hits -lt 1) { Write-Host ("SKIPPED: pattern not found in {0}" -f $File); return }
  try {
    [IO.File]::WriteAllBytes($p, [Text.Encoding]::UTF8.GetBytes($old.Replace($Find, $Replace)))
    $m = Invoke-MutJest
    if ($m.failed -gt 0) { Write-Host ("KILLED by {0} test(s), {1} occurrence(s) mutated:" -f $m.failed, $hits); $m.titles | % { Write-Host (' - ' + $_) } }
    elseif ($m.broken -gt 0) { Write-Host 'ERROR: suites failed to run, not a kill (harness problem)' }
    else { Write-Host ("SURVIVED ({0} occurrence(s)): no test noticed this change" -f $hits) }
  } finally {
    [IO.File]::WriteAllBytes($p, $bytes)
    Write-Host ('restored: ' + ((Get-FileHash $p).Hash -eq $hash))
  }
}
