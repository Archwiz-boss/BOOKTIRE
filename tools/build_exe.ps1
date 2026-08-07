<#
.SYNOPSIS
    把 CPAMI 書表編輯器打包成單一個免安裝的 Windows 執行檔。

.DESCRIPTION
    產出 dist\CPAMI-Editor.exe。使用者不需要安裝 Python，
    只要雙擊該檔就會啟動本機服務並自動開啟瀏覽器。

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\tools\build_exe.ps1
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [string]$Name = 'CPAMI-Editor',
    [switch]$KeepBuildFiles
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$AppDir = Join-Path $RepoRoot 'cpami-form-editor'
$DistDir = Join-Path $RepoRoot 'dist'
$BuildDir = Join-Path $RepoRoot 'build'

if (-not (Test-Path (Join-Path $AppDir 'launcher.py'))) {
    throw "找不到 $AppDir\launcher.py，請確認腳本位於專案的 tools\ 目錄下。"
}

Write-Host '[1/4] 檢查 Python 與 PyInstaller…' -ForegroundColor Cyan
& $Python --version
& $Python -m PyInstaller --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host '      未安裝 PyInstaller，正在安裝…' -ForegroundColor Yellow
    & $Python -m pip install --disable-pip-version-check pyinstaller
    if ($LASTEXITCODE -ne 0) { throw 'PyInstaller 安裝失敗。' }
}

Write-Host '[2/4] 先跑一次回歸測試（不通過就不打包）…' -ForegroundColor Cyan
Push-Location $AppDir
try {
    foreach ($test in @(
            'tests\core_unit_test.py',
            'tests\sqlite_template_test.py',
            'tests\network_access_test.py')) {
        & $Python -X utf8 $test | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "測試失敗：$test" }
        Write-Host "      OK  $test"
    }
} finally {
    Pop-Location
}

Write-Host '[3/4] 執行 PyInstaller…' -ForegroundColor Cyan
Push-Location $AppDir
try {
    # --specpath 會改變相對 --add-data 的解析基準，來源一律用絕對路徑。
    $webDir = Join-Path $AppDir 'web'
    $schemaDir = Join-Path $AppDir 'schema'
    $sqliteSchema = Join-Path $RepoRoot 'sqlite\schema.sql'
    & $Python -m PyInstaller `
        --noconfirm --clean --onefile --console `
        --name $Name `
        --distpath $DistDir `
        --workpath (Join-Path $BuildDir 'pyinstaller') `
        --specpath $BuildDir `
        --add-data "$webDir;web" `
        --add-data "$schemaDir;schema" `
        --add-data "$sqliteSchema;sqlite" `
        --hidden-import sqlite_templates `
        --exclude-module tkinter `
        --exclude-module unittest `
        launcher.py
    if ($LASTEXITCODE -ne 0) { throw 'PyInstaller 打包失敗。' }
} finally {
    Pop-Location
}

Write-Host '[4/4] 驗證產出的執行檔…' -ForegroundColor Cyan
$exe = Join-Path $DistDir "$Name.exe"
if (-not (Test-Path $exe)) { throw "找不到產出的 $exe。" }

# 用 --no-browser 起一個臨時連接埠，確認打包後仍讀得到 web/ 與 schema/。
$proc = Start-Process -FilePath $exe -ArgumentList '--no-browser', '--port', '8799' `
    -PassThru -WindowStyle Hidden
try {
    $ok = $false
    foreach ($attempt in 1..30) {
        Start-Sleep -Milliseconds 500
        try {
            $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8799/api/health' -TimeoutSec 3
            if ($health.ok) { $ok = $true; break }
        } catch { }
    }
    if (-not $ok) { throw '打包後的執行檔無法回應 /api/health，請檢查 --add-data 設定。' }
    Write-Host '      OK  /api/health 正常回應'
} finally {
    if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
}

if (-not $KeepBuildFiles) {
    Remove-Item -Recurse -Force $BuildDir -ErrorAction SilentlyContinue
}

$sizeMb = [math]::Round((Get-Item $exe).Length / 1MB, 1)
Write-Host ''
Write-Host "完成：$exe（$sizeMb MB）" -ForegroundColor Green
Write-Host '這個檔案可以單獨複製給別人，對方不需要安裝 Python。' -ForegroundColor Green
