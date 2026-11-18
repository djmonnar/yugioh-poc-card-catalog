# Card grid thumbnails for the authoring studio (index.html).
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/make-card-thumbs.ps1 [-Width 320] [-Quality 80] [-Force] [-Check]
#
# Reads assets/native<NNN>/cards/<id>.jpg and writes assets/native<NNN>/thumbs/<id>.jpg
# (same name, Width px wide, aspect kept, JPEG quality Quality, no metadata).
# Existing thumbnails are kept unless -Force is given, so reruns only add new cards.
# -Check writes nothing and fails when a thumbnail is missing, stale or not Width wide.
# The studio falls back to the original image when a thumbnail is missing.
param(
  [ValidateRange(64, 813)][int]$Width = 320,
  [ValidateRange(40, 95)][int]$Quality = 80,
  [switch]$Force,
  [switch]$Check
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$assets = Join-Path $root 'assets'
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$encoder = New-Object System.Drawing.Imaging.EncoderParameters 1
$encoder.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]$Quality)

$made = 0; $kept = 0; $problems = @(); $originalBytes = [long]0; $thumbBytes = [long]0; $count = 0
$packs = Get-ChildItem -LiteralPath $assets -Directory | Where-Object { $_.Name -match '^native\d{3}$' } | Sort-Object Name
foreach ($pack in $packs) {
  $cards = Join-Path $pack.FullName 'cards'
  if (-not (Test-Path -LiteralPath $cards)) { continue }
  $thumbs = Join-Path $pack.FullName 'thumbs'
  foreach ($file in (Get-ChildItem -LiteralPath $cards -File -Filter '*.jpg' | Where-Object { $_.Name -match '^\d{1,6}\.jpg$' } | Sort-Object Name)) {
    $count++
    $target = Join-Path $thumbs $file.Name
    $originalBytes += $file.Length
    $exists = Test-Path -LiteralPath $target
    if ($Check) {
      if (-not $exists) { $problems += "missing $($pack.Name)/thumbs/$($file.Name)"; continue }
      $info = Get-Item -LiteralPath $target
      $thumbBytes += $info.Length
      $image = [System.Drawing.Image]::FromFile($target)
      try { if ($image.Width -ne $Width) { $problems += "width $($image.Width) $($pack.Name)/thumbs/$($file.Name)" } } finally { $image.Dispose() }
      if ($info.LastWriteTimeUtc -lt $file.LastWriteTimeUtc) { $problems += "stale $($pack.Name)/thumbs/$($file.Name)" }
      continue
    }
    if ($exists -and -not $Force -and (Get-Item -LiteralPath $target).LastWriteTimeUtc -ge $file.LastWriteTimeUtc) {
      $kept++; $thumbBytes += (Get-Item -LiteralPath $target).Length; continue
    }
    if (-not (Test-Path -LiteralPath $thumbs)) { New-Item -ItemType Directory -Path $thumbs | Out-Null }
    $source = [System.Drawing.Image]::FromFile($file.FullName)
    try {
      $height = [int][Math]::Round($source.Height * $Width / $source.Width)
      $bitmap = New-Object System.Drawing.Bitmap $Width, $height, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
      try {
        $bitmap.SetResolution(72, 72)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
          $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
          $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
          $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
          $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
          $attributes = New-Object System.Drawing.Imaging.ImageAttributes
          $attributes.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
          $graphics.DrawImage($source, (New-Object System.Drawing.Rectangle 0, 0, $Width, $height), 0, 0, $source.Width, $source.Height, [System.Drawing.GraphicsUnit]::Pixel, $attributes)
          $attributes.Dispose()
        } finally { $graphics.Dispose() }
        $temporary = "$target.tmp"
        $bitmap.Save($temporary, $codec, $encoder)
        Move-Item -LiteralPath $temporary -Destination $target -Force
      } finally { $bitmap.Dispose() }
    } finally { $source.Dispose() }
    $made++; $thumbBytes += (Get-Item -LiteralPath $target).Length
  }
}
$summary = [ordered]@{ mode = $(if ($Check) { 'check' } else { 'build' }); cards = $count; made = $made; kept = $kept; width = $Width; quality = $Quality; originalBytes = $originalBytes; thumbBytes = $thumbBytes; problems = $problems.Count }
$summary | ConvertTo-Json -Compress
if ($problems.Count) { $problems | Select-Object -First 20 | ForEach-Object { Write-Host $_ }; exit 1 }
