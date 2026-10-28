param(
  [string]$Database = "",
  [string]$KeyFile = "",
  [string]$Group = "Das Archiv Browser Spiel mit integrierter KI",
  [string]$Cli = "E:\KeePassXC\keepassxc-cli.exe",
  [string]$EnvFile = "",
  [switch]$Interactive
)

$ErrorActionPreference = "Stop"

# --- Pfade -------------------------------------------------------------

if (-not $EnvFile) {
  $EnvFile = Join-Path $PSScriptRoot "..\.env"
}

if (-not (Test-Path $Cli)) {
  Write-Host "keepassxc-cli nicht gefunden: $Cli" -ForegroundColor Red
  exit 1
}

if (-not $Database) {
  $found = Get-ChildItem "E:\Tresor\*.kdbx" -File -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($found) {
    $Database = $found.FullName
  } else {
    $Database = Read-Host "Pfad zur .kdbx"
  }
}

if (-not (Test-Path $Database)) {
  Write-Host "Datenbank nicht gefunden: $Database" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "  DAS ARCHIV - Schluessel aus KeePassXC importieren"
Write-Host "  Datenbank: $Database"
Write-Host "  Gruppe:    $Group"
Write-Host ""

# --- Passwort -----------------------------------------------------------

$plain = $null

if (-not $Interactive) {
  $secure = Read-Host "Master-Passwort" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

  if (-not $plain) {
    Write-Host "Kein Passwort eingegeben." -ForegroundColor Red
    exit 1
  }

  # Ohne BOM an die CLI geben.
  $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
}

$cliArgs = @()
if ($KeyFile) { $cliArgs += @("-k", $KeyFile) }

function Run-Cli {
  param([string[]]$Arguments)

  if ($Interactive) {
    return (& $Cli @Arguments 2>$null)
  }
  return ($plain | & $Cli @Arguments 2>$null)
}

# --- Eintraege auflisten ------------------------------------------------

Write-Host ""
Write-Host "  Lese Gruppe ..."

$listing = Run-Cli (@("ls", "-R", "-f") + $cliArgs + @($Database, $Group))

if (-not $listing) {
  Write-Host ""
  Write-Host "  Konnte die Gruppe nicht lesen." -ForegroundColor Red
  Write-Host "  Moeglich: falsches Passwort, falscher Gruppenname oder Key-Datei noetig."
  Write-Host "  Mit Key-Datei:  import-keepass.ps1 -KeyFile `"E:\Tresor\Key KeePassXC.txt`""
  Write-Host "  Ohne Pipe:      import-keepass.ps1 -Interactive"
  $plain = $null
  exit 1
}

$entries = @()
foreach ($line in $listing) {
  $path = ("$line").Trim()
  if (-not $path -or $path.EndsWith("/")) { continue }
  if ($path -eq $Group) { continue }
  if (-not $path.Contains("/")) { $path = "$Group/$path" }
  $entries += [pscustomobject]@{ Title = ($path -split "/")[-1]; Path = $path }
}

if (-not $entries.Count) {
  Write-Host "  Keine Eintraege in dieser Gruppe gefunden." -ForegroundColor Yellow
  $plain = $null
  exit 1
}

Write-Host ""
Write-Host "  Gefundene Eintraege:"
foreach ($entry in $entries) { Write-Host "   - $($entry.Title)" }

# --- Drei Schluessel zuordnen ------------------------------------------

function Pick-Entry($list, $keyword, $envName) {
  $hit = $list | Where-Object { $_.Title -match $keyword } | Select-Object -First 1
  if ($hit) { return $hit }

  Write-Host ""
  Write-Host "  Kein Eintrag fuer $envName gefunden."
  $manual = Read-Host "  Exakter Eintragsname (leer = ueberspringen)"
  if ($manual) {
    return ($list | Where-Object { $_.Title -eq $manual } | Select-Object -First 1)
  }
  return $null
}

$targets = @(
  @{ Env = "GEMINI_API_KEY";     Keyword = "gemini" },
  @{ Env = "GROQ_API_KEY";       Keyword = "groq" },
  @{ Env = "OPENROUTER_API_KEY"; Keyword = "openrouter|open.?router" }
)

$results = @{}

foreach ($target in $targets) {
  $entry = Pick-Entry $entries $target.Keyword $target.Env
  if (-not $entry) { continue }

  $value = Run-Cli (@("show", "-s", "-a", "Password") + $cliArgs + @($Database, $entry.Path)) | Select-Object -First 1

  if ($value) {
    $results[$target.Env] = ("$value").Trim()
    Write-Host "  gelesen: $($entry.Title) -> $($target.Env)"
  } else {
    Write-Host "  Konnte $($target.Env) nicht lesen (Eintrag: $($entry.Title))." -ForegroundColor Yellow
  }
}

$plain = $null

if (-not $results.Count) {
  Write-Host ""
  Write-Host "  Keine Schluessel gelesen. Nichts geaendert." -ForegroundColor Red
  exit 1
}

# --- .env schreiben -----------------------------------------------------

$lines = @(
  "# DAS ARCHIV - Zugangsdaten",
  "# Automatisch aus KeePassXC importiert am $(Get-Date -Format 'yyyy-MM-dd HH:mm')",
  "# Diese Datei ist in .gitignore und wird nicht veroeffentlicht.",
  "",
  "ARCHIV_PROVIDER=gemini",
  "GEMINI_API_KEY=$($results['GEMINI_API_KEY'])",
  "GROQ_API_KEY=$($results['GROQ_API_KEY'])",
  "OPENROUTER_API_KEY=$($results['OPENROUTER_API_KEY'])",
  "CLOUDFLARE_API_TOKEN=",
  "CLOUDFLARE_ACCOUNT_ID=",
  ""
)

Set-Content -Path $EnvFile -Value $lines -Encoding UTF8

Write-Host ""
Write-Host "  Geschrieben: $EnvFile" -ForegroundColor Green
foreach ($key in ($results.Keys | Sort-Object)) {
  Write-Host ("   - {0}: gesetzt ({1} Zeichen)" -f $key, $results[$key].Length)
}
Write-Host ""
Write-Host "  Naechster Schritt:"
Write-Host "   node scripts/check-providers.mjs"
Write-Host ""
