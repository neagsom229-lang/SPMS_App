# run-mutants.ps1
# Dot-sources mutation.ps1 and the owner's mutants.ps1, then prints killed K/N.
# Exits 1 on no mutants, or on any SURVIVED / SKIPPED / ERROR result.
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'mutation.ps1')
$script:MutationResults = @()

$mutantsPath = Join-Path $PSScriptRoot 'mutants.ps1'
if (Test-Path $mutantsPath) {
  . $mutantsPath
}

# Also accept $script:Mutants = @(@{File=...;Find=...;Replace=...}, ...).
if ($null -ne $script:Mutants -and @($script:Mutants).Count -gt 0 -and $script:MutationResults.Count -eq 0) {
  foreach ($m in $script:Mutants) {
    Test-Mutation -File $m.File -Find $m.Find -Replace $m.Replace | Out-Null
  }
}

$results = @($script:MutationResults)
if ($results.Count -eq 0) {
  Write-Host 'no mutants'
  exit 1
}

$killed = @($results | Where-Object { $_.status -eq 'KILLED' }).Count
Write-Host ("killed {0}/{1}" -f $killed, $results.Count)

$bad = @($results | Where-Object { $_.status -ne 'KILLED' })
if ($bad.Count -gt 0) {
  $bad | ForEach-Object { Write-Host ("  {0}: {1}" -f $_.status, $_.file) }
  exit 1
}

exit 0
