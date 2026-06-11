# make-composites.ps1 - Compone capturas crudas sobre lienzo 1280x800 para CWS
# Uso: powershell -ExecutionPolicy Bypass -File make-composites.ps1 [-Version v0.5.0]
# Edita el bloque $map al final para mapear capturas crudas -> nombre final.
# NOTA: mantener este archivo en ASCII puro (PowerShell 5.1 lo lee como ANSI sin BOM).

param([string]$Version = 'v0.5.0')

Add-Type -AssemblyName System.Drawing

$root = Join-Path $PSScriptRoot "screenshots\$Version"
$outDir = Join-Path $root 'final'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory $outDir | Out-Null }

# Fondo: azul oscuro de la app DPM
$bgColor = [System.Drawing.ColorTranslator]::FromHtml('#0B1423')
$canvasW = 1280; $canvasH = 800
$marginX = 32;  $marginY = 32   # area util: 1216x736

function New-Composite([string]$srcName, [string]$dstName, [int[]]$crop) {
    $srcPath = Join-Path $root $srcName
    if (-not (Test-Path $srcPath)) { Write-Warning "No existe: $srcName - omitido"; return }

    $src = [System.Drawing.Image]::FromFile($srcPath)

    # Recorte opcional (x, y, ancho, alto) para eliminar bordes de pagina/toolbar
    if ($crop) {
        $rect = New-Object System.Drawing.Rectangle($crop[0], $crop[1], $crop[2], $crop[3])
        $cropped = (New-Object System.Drawing.Bitmap($src)).Clone($rect, $src.PixelFormat)
        $src.Dispose()
        $src = $cropped
    }
    $bmp = New-Object System.Drawing.Bitmap($canvasW, $canvasH)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear($bgColor)

    # Escalar (up o down) para encajar en el area util conservando proporcion
    $maxW = $canvasW - 2 * $marginX
    $maxH = $canvasH - 2 * $marginY
    $scale = [Math]::Min($maxW / $src.Width, $maxH / $src.Height)
    $w = [int]($src.Width * $scale)
    $h = [int]($src.Height * $scale)
    $x = [int](($canvasW - $w) / 2)
    $y = [int](($canvasH - $h) / 2)

    $g.DrawImage($src, $x, $y, $w, $h)
    $g.Dispose(); $src.Dispose()

    $dstPath = Join-Path $outDir $dstName
    $bmp.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "OK  $dstName  (1280x800)"
}

function New-I18nCollage([object[]]$items, [string]$dstName) {
    # items: lista de @{ file='...'; crop=@(x,y,w,h); label='ES' }
    $bmp = New-Object System.Drawing.Bitmap($canvasW, $canvasH)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
    $g.Clear($bgColor)

    $targetH = 600; $gap = 36; $labelH = 46
    $font = New-Object System.Drawing.Font('Segoe UI', 22, [System.Drawing.FontStyle]::Bold)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#7FD3F7'))
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = [System.Drawing.StringAlignment]::Center

    # Cargar, recortar y calcular anchos escalados
    $imgs = @()
    foreach ($it in $items) {
        $src = [System.Drawing.Image]::FromFile((Join-Path $root $it.file))
        if ($it.crop) {
            $rect = New-Object System.Drawing.Rectangle($it.crop[0], $it.crop[1], $it.crop[2], $it.crop[3])
            $c = (New-Object System.Drawing.Bitmap($src)).Clone($rect, $src.PixelFormat)
            $src.Dispose(); $src = $c
        }
        $imgs += @{ img = $src; w = [int]($src.Width * $targetH / $src.Height); label = $it.label }
    }
    $totalW = ($imgs | ForEach-Object { $_.w } | Measure-Object -Sum).Sum + $gap * ($imgs.Count - 1)
    $scaleAll = [Math]::Min(1.0, ($canvasW - 2 * $marginX) / $totalW)
    $h = [int]($targetH * $scaleAll)
    $x = [int](($canvasW - $totalW * $scaleAll) / 2)
    $y = [int](($canvasH - $h - $labelH) / 2)

    foreach ($i in $imgs) {
        $w = [int]($i.w * $scaleAll)
        $g.DrawImage($i.img, $x, $y, $w, $h)
        $g.DrawString($i.label, $font, $brush, ($x + $w / 2), ($y + $h + 10), $fmt)
        $i.img.Dispose()
        $x += $w + [int]($gap * $scaleAll)
    }
    $g.Dispose()
    $dstPath = Join-Path $outDir $dstName
    $bmp.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "OK  $dstName  (1280x800 collage)"
}

# -- Mapeo captura cruda -> screenshot final del listing ---------------------
# crop = x, y, ancho, alto sobre la captura cruda (elimina toolbar/bordes de pagina)
New-Composite 'Screenshot 2026-06-10 191953.png' '01-popup-home.png' @(14, 30, 361, 460)
New-Composite 'Screenshot 2026-06-10 192044.png' '02-vault.png'
New-Composite 'Screenshot 2026-06-10 192153.png' '03-generator.png'
New-Composite 'Screenshot 2026-06-10 192253.png' '05-sync-byoc.png'

# 04-i18n: popup en ES (home) + EN (lock) + PT-BR (home)
New-I18nCollage @(
    @{ file = 'Screenshot 2026-06-10 191953.png'; crop = @(14, 30, 361, 460); label = 'ES' },
    @{ file = 'Screenshot 2026-06-10 193607.png'; crop = @(11, 29, 359, 457); label = 'EN' },
    @{ file = 'Screenshot 2026-06-10 193856.png'; crop = @(8, 28, 362, 464);  label = 'PT-BR' }
) '04-i18n.png'
