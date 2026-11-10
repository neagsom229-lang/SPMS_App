# mutation.ps1
$mutantsPath = Join-Path $PSScriptRoot "mutants.ps1"
if (-not (Test-Path $mutantsPath)) {
    Write-Host "no mutants"
    exit 1
}

$lines = Get-Content $mutantsPath | Where-Object { $_.Trim() -ne "" -and -not $_.Trim().StartsWith("#") }
if ($lines.Count -eq 0) {
    Write-Host "no mutants"
    exit 1
}

. $mutantsPath
