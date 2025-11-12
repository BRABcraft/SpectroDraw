# tools/bundle-pro-ui.ps1
param()
# Config - tweak paths / kv key here if you want
$input = "public\pro-bundles\pro-ui.html"
$output = "public\pro-bundles\pro-ui.bundle.html"
$kvKey = "pro-bundles/pro-ui.67cd93d4d3.html"   # the KV key you want to overwrite
$projectRoot = (Get-Location).ProviderPath
$baseDir = Split-Path -Path $input -Parent

function Get-MimeType($p) {
  switch ([io.path]::GetExtension($p).ToLower()) {
    ".png"  { "image/png"; break }
    ".jpg"  { "image/jpeg"; break }
    ".jpeg" { "image/jpeg"; break }
    ".gif"  { "image/gif"; break }
    ".svg"  { "image/svg+xml"; break }
    ".webp" { "image/webp"; break }
    ".mp3"  { "audio/mpeg"; break }
    ".wav"  { "audio/wav"; break }
    ".ogg"  { "audio/ogg"; break }
    ".css"  { "text/css"; break }
    ".js"   { "application/javascript"; break }
    ".json" { "application/json"; break }
    ".woff" { "font/woff"; break }
    ".woff2"{ "font/woff2"; break }
    ".ttf"  { "font/ttf"; break }
    ".otf"  { "font/otf"; break }
    default { "application/octet-stream" }
  }
}

function Resolve-AssetPath($ref) {
  # skip absolute web urls
  if ($ref -match '^(https?:)?//') { return $null }
  # if starts with / treat as project-root relative
  if ($ref.StartsWith("/")) {
    $candidate = Join-Path $projectRoot ($ref.TrimStart("/"))
  } else {
    $candidate = Join-Path $baseDir $ref
  }
  $resolved = $null
  try { $resolved = (Resolve-Path -Path $candidate -ErrorAction Stop).ProviderPath } catch { $null }
  return $resolved
}

function To-DataUri($path) {
  $bin = [IO.File]::ReadAllBytes($path)
  $b64 = [Convert]::ToBase64String($bin)
  $mime = Get-MimeType $path
  return "data:$mime;base64,$b64"
}

Write-Host "Bundling $input -> $output (this may take a second)..."

if (-Not (Test-Path $input)) {
  Write-Error "Input HTML not found: $input"
  exit 1
}

# load HTML
$content = Get-Content -Raw -Encoding UTF8 $input

# 1) Inline <link rel="stylesheet" href="...">
$cssLinkPattern = '<link[^>]+rel=["'']stylesheet["''][^>]*href=["'']([^"'']+)["''][^>]*>'
$content = [regex]::Replace($content, $cssLinkPattern, {
  param($m)
  $href = $m.Groups[1].Value
  $path = Resolve-AssetPath $href
  if ($path) {
    $css = Get-Content -Raw -Encoding UTF8 $path
    # inline any url(...) references inside the css
    $css = [regex]::Replace($css, 'url\((["'']?)([^)"'']+)\1\)', {
      param($mm)
      $ref = $mm.Groups[2].Value
      $p = Resolve-AssetPath $ref
      if ($p) { return "url('" + (To-DataUri $p) + "')" } else { return $mm.Value }
    })
    return "<style>`n$css`n</style>"
  } else {
    return $m.Value
  }
})

# 2) Inline <script src="..."></script>
$scriptPattern = '<script[^>]*src=["'']([^"'']+)["''][^>]*>\s*</script>'
$content = [regex]::Replace($content, $scriptPattern, {
  param($m)
  $src = $m.Groups[1].Value
  $path = Resolve-AssetPath $src
  if ($path) {
    $js = Get-Content -Raw -Encoding UTF8 $path
    return "<script>`n$js`n</script>"
  } else {
    return $m.Value
  }
})

# 3) Inline <img src="..."> (replace src with data-uri)
$imgPattern = '(<img[^>]+src=["''])([^"'']+)(["''][^>]*>)'
$content = [regex]::Replace($content, $imgPattern, {
  param($m)
  $prefix = $m.Groups[1].Value
  $src = $m.Groups[2].Value
  $suffix = $m.Groups[3].Value
  $path = Resolve-AssetPath $src
  if ($path) {
    $data = To-DataUri $path
    return $prefix + $data + $suffix
  } else {
    return $m.Value
  }
})

# 4) Inline remaining url(...) occurrences (e.g. style attributes or embedded CSS)
$content = [regex]::Replace($content, 'url\((["'']?)([^)"'']+)\1\)', {
  param($m)
  $ref = $m.Groups[2].Value
  $path = Resolve-AssetPath $ref
  if ($path) { return "url('" + (To-DataUri $path) + "')" } else { return $m.Value }
})

# write bundled HTML
Set-Content -Path $output -Value $content -Encoding UTF8
Write-Host "Wrote $output"

# 5) Upload to KV using wrangler (requires wrangler/npx in PATH)
try {
  Write-Host "Uploading to KV key $kvKey ..."
  & npx wrangler kv key put --binding=__spectrodraw-api-workers_sites_assets $kvKey --path $output
  if ($LASTEXITCODE -ne 0) { throw "wrangler failed with exit code $LASTEXITCODE" }
  Write-Host "Uploaded $kvKey to KV."
} catch {
  Write-Error "Failed to upload to KV: $_"
  exit 2
}

exit 0
