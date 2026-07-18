# Start cloudflared, capture public URL, write api-config.js, push to gh-pages
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$log = Join-Path $env:TEMP "telephantim-cloudflared.log"
if (Test-Path $log) { Remove-Item $log -Force }

# Health check local API
$ok = $false
for ($i = 0; $i -lt 15; $i++) {
  try {
    $s = Invoke-RestMethod "http://127.0.0.1:8765/api/status" -TimeoutSec 2
    if ($s.server -eq "telephantim-ai") { $ok = $true; break }
  } catch { Start-Sleep -Seconds 1 }
}
if (-not $ok) {
  Write-Host "ERROR: server.py not responding on :8765"
  exit 1
}
Write-Host "Local dual API OK (Ollama minds when installed)."

# Run cloudflared; URL appears on stderr
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "cloudflared"
$psi.Arguments = "tunnel --url http://127.0.0.1:8765 --no-autoupdate"
$psi.UseShellExecute = $false
$psi.RedirectStandardError = $true
$psi.RedirectStandardOutput = $true
$psi.CreateNoWindow = $true
$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $psi
[void]$proc.Start()

$publicUrl = $null
$deadline = (Get-Date).AddSeconds(45)
while ((Get-Date) -lt $deadline -and -not $publicUrl) {
  Start-Sleep -Milliseconds 400
  $line = $proc.StandardError.ReadLine()
  if (-not $line) { continue }
  Add-Content -Path $log -Value $line
  if ($line -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
    $publicUrl = $Matches[0].TrimEnd('/')
    break
  }
}

if (-not $publicUrl) {
  # fallback: scan log file
  if (Test-Path $log) {
    $all = Get-Content $log -Raw
    if ($all -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
      $publicUrl = $Matches[0].TrimEnd('/')
    }
  }
}

if (-not $publicUrl) {
  Write-Host "ERROR: could not read tunnel URL. Is cloudflared installed?"
  try { $proc.Kill() } catch {}
  exit 1
}

Write-Host "Public API: $publicUrl"

# Probe tunnel -> dual API
$tunnelOk = $false
for ($i = 0; $i -lt 20; $i++) {
  try {
    $s = Invoke-RestMethod "$publicUrl/api/status" -TimeoutSec 5
    if ($s.server -eq "telephantim-ai") { $tunnelOk = $true; break }
  } catch { Start-Sleep -Seconds 1 }
}
if (-not $tunnelOk) {
  Write-Host "WARN: tunnel up but /api/status not ready yet — continuing publish"
}

$config = @"
// Auto-published by GO_PUBLIC_BRAINS.bat — dual Ollama minds for any browser
// Mjolnir -> llama3.2 | Caduceus -> hermes3 | while your PC tunnel is running
window.TELEPHANTIM_API = "$publicUrl";
"@

Set-Content -Path (Join-Path $root "api-config.js") -Value $config -Encoding UTF8
Set-Content -Path (Join-Path $root "public\api-config.js") -Value $config -Encoding UTF8
Write-Host "Wrote api-config.js -> $publicUrl"

# Publish api-config to gh-pages so telephantim.com picks it up
$deploy = Join-Path $env:TEMP "telephantim-gh-pages-pub"
if (Test-Path $deploy) { Remove-Item -Recurse -Force $deploy }
New-Item -ItemType Directory -Path $deploy | Out-Null
Copy-Item (Join-Path $root "public\*") $deploy -Force
Copy-Item (Join-Path $root "public\api-config.js") (Join-Path $deploy "api-config.js") -Force
Set-Content (Join-Path $deploy "CNAME") "telephantim.com" -Encoding ASCII
Set-Content (Join-Path $deploy ".nojekyll") "" -Encoding ASCII

Push-Location $deploy
git init -q
git checkout -b gh-pages
git add -A
git -c user.email="telephantix@users.noreply.github.com" -c user.name="telephantics-jpg" commit -m "Publish public dual-brain API $publicUrl" | Out-Null
git remote add origin https://github.com/telephantics-jpg/telephantim-hub.git
git push -f origin gh-pages
Pop-Location
Remove-Item -Recurse -Force $deploy

Write-Host ""
Write-Host "================================================"
Write-Host " PUBLIC brains live for any browser:"
Write-Host "  API:  $publicUrl"
Write-Host "  Site: https://telephantim.com/"
Write-Host " Keep this PC on. Tunnel PID: $($proc.Id)"
Write-Host "================================================"
Write-Host ""
Write-Host "Opening site..."
Start-Process "https://telephantim.com/?brains=1"

# Keep tunnel process attached to this window
Write-Host "Tunnel running — press Ctrl+C to stop public brains."
try {
  $proc.WaitForExit()
} finally {
  if (-not $proc.HasExited) { try { $proc.Kill() } catch {} }
}
