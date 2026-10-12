$ErrorActionPreference = "Stop"
$version = if ($env:LINGVA_CLI_VERSION) { $env:LINGVA_CLI_VERSION } else { "latest" }
$installDir = if ($env:LINGVA_CLI_INSTALL_DIR) { $env:LINGVA_CLI_INSTALL_DIR } else { Join-Path $HOME ".lingva\bin" }
$assetBaseUrl = if ($env:LINGVA_CLI_ASSET_BASE_URL) { $env:LINGVA_CLI_ASSET_BASE_URL.TrimEnd("/") } else { "https://unpkg.com/@lingva/cli@$version/assets" }
$target = switch ("$([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture)") {
  "X64" { "x86_64-pc-windows-msvc" }
  default { throw "Unsupported Lingva CLI Windows architecture." }
}
$asset = "lingva-$target.zip"
$temp = Join-Path ([System.IO.Path]::GetTempPath()) "lingva-$([System.Guid]::NewGuid())"
New-Item -ItemType Directory -Path $temp | Out-Null
$staging = $null
$lock = $null
try {
  Invoke-WebRequest "$assetBaseUrl/$asset" -OutFile "$temp\$asset"
  Invoke-WebRequest "$assetBaseUrl/SHA256SUMS" -OutFile "$temp\SHA256SUMS"
  $lines = @(Get-Content "$temp\SHA256SUMS" | Where-Object { $_ -match "\s\*?$([regex]::Escape($asset))$" })
  if ($lines.Count -ne 1 -or $lines[0] -notmatch "^([a-fA-F0-9]{64})\s+\*?$([regex]::Escape($asset))$") { throw "Missing, duplicate, or malformed checksum for $asset" }
  $expected = $Matches[1].ToLowerInvariant()
  $actual = (Get-FileHash "$temp\$asset" -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $expected) { throw "Checksum mismatch for $asset" }
  New-Item -ItemType Directory -Force -Path $installDir | Out-Null
  # An exclusive OS handle releases even after process termination. Stage on
  # the destination filesystem; never extract archive paths into the live bin.
  $lock = [IO.File]::Open((Join-Path $installDir ".lingva-install.lock"), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  $staging = Join-Path $installDir ".lingva-install-$([Guid]::NewGuid())"
  New-Item -ItemType Directory -Path $staging | Out-Null
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [IO.Compression.ZipFile]::OpenRead("$temp\$asset")
  try {
    if ($zip.Entries.Count -ne 1 -or $zip.Entries[0].FullName -ne "lingva.exe" -or (($zip.Entries[0].ExternalAttributes -shr 16) -band 61440) -eq 40960) { throw "Archive must contain one regular Lingva executable" }
    if ($zip.Entries[0].Length -le 0 -or $zip.Entries[0].Length -gt 209715200) { throw "Invalid Lingva executable size" }
    $binary = Join-Path $staging "lingva.exe"
    [IO.Compression.ZipFileExtensions]::ExtractToFile($zip.Entries[0], $binary)
  } finally {
    $zip.Dispose()
  }
  $destination = Join-Path $installDir "lingva.exe"
  if ([IO.File]::Exists($destination)) {
    [IO.File]::Replace($binary, $destination, $null)
  } else {
    [IO.File]::Move($binary, $destination)
  }
  Write-Host "Installed Lingva CLI to $installDir\lingva.exe"
} finally {
  if ($lock) { $lock.Dispose() }
  if ($staging) { Remove-Item -Recurse -Force $staging }
  Remove-Item -Recurse -Force $temp
}
