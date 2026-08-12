<#
.SYNOPSIS
    驗收打包後的 CPAMI-Editor.exe：在沒有 Python 的環境下仍能正確解析與匯出。

.DESCRIPTION
    build_exe.ps1 只驗到 /api/health 有回應，證明打包沒漏檔，但沒有證明格式行為
    在凍結後仍然正確。這支補上那一段：位元組級 roundtrip、ZIP roundtrip、
    共用範本的 CRUD 與重建，全部打真正的 HTTP API。

    啟動 exe 前會清掉 PYTHONHOME／PYTHONPATH 並把 PATH 縮到只剩系統目錄，
    藉此逼近「乾淨機沒有安裝 Python」的情境——凍結漏包的模組如果剛好能從
    開發機的 site-packages 撿到，這裡就會露餡。

.PARAMETER UseSource
    改用原始碼的 launcher.py 啟動，供沒有 PyInstaller 的環境驗證 HTTP 斷言本身。
    這個模式不做環境隔離，**不能取代 exe 驗收**。

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\tools\Test-PortableExe.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\tools\Test-PortableExe.ps1 -UseSource
#>
[CmdletBinding()]
param(
    [string]$ExePath = '',
    [string]$FixturePath = '',
    [int]$PortBase = 18765,
    [string]$Python = 'python',
    [switch]$UseSource,
    [switch]$SelfTestOccupiedPort
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$RepoRoot = Split-Path -Parent $PSScriptRoot
$AppDir = Join-Path $RepoRoot 'cpami-form-editor'
if ([string]::IsNullOrWhiteSpace($ExePath)) { $ExePath = Join-Path $RepoRoot 'dist\CPAMI-Editor.exe' }
if ([string]::IsNullOrWhiteSpace($FixturePath)) { $FixturePath = Join-Path $AppDir 'tests\fixtures\sample_data.txt' }

function Assert-That([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }

function Get-Sha256([byte[]]$Bytes) {
    $hash = [Security.Cryptography.SHA256]::Create()
    try { ([BitConverter]::ToString($hash.ComputeHash($Bytes))).Replace('-', '').ToLowerInvariant() }
    finally { $hash.Dispose() }
}

function Get-Json([byte[]]$Bytes) {
    $text = [Text.Encoding]::UTF8.GetString($Bytes)
    try { $text | ConvertFrom-Json }
    catch { throw "回應不是合法 JSON：$($text.Substring(0, [Math]::Min(200, $text.Length)))" }
}

function Invoke-Http([string]$Uri, [string]$Method = 'GET', [byte[]]$Body = $null, [string]$ContentType = $null) {
    try {
        $request = [Net.HttpWebRequest]::Create($Uri)
        $request.Method = $Method
        $request.Timeout = 15000
        $request.ReadWriteTimeout = 15000
        if ($null -ne $Body) {
            $request.ContentType = $ContentType
            $request.ContentLength = $Body.Length
            $stream = $request.GetRequestStream()
            try { $stream.Write($Body, 0, $Body.Length) } finally { $stream.Dispose() }
        }
        $response = [Net.HttpWebResponse]$request.GetResponse()
    } catch [Net.WebException] {
        if ($_.Exception.Response) { $response = [Net.HttpWebResponse]$_.Exception.Response }
        else { throw "HTTP $Method $Uri 失敗：$($_.Exception.Message)" }
    }
    try {
        $out = New-Object IO.MemoryStream
        $stream = $response.GetResponseStream()
        try { $stream.CopyTo($out) } finally { $stream.Dispose() }
        [pscustomobject]@{ Status = [int]$response.StatusCode; Bytes = $out.ToArray() }
    } finally { if ($response) { $response.Dispose() } }
}

function Invoke-Json([string]$Base, [string]$Path, [string]$Method = 'GET', $Payload = $null) {
    $body = $null
    if ($null -ne $Payload) { $body = [Text.Encoding]::UTF8.GetBytes(($Payload | ConvertTo-Json -Depth 100 -Compress)) }
    $result = Invoke-Http "$Base$Path" $Method $body 'application/json; charset=utf-8'
    [pscustomobject]@{ Status = $result.Status; Json = (Get-Json $result.Bytes); Bytes = $result.Bytes }
}

function Assert-PortsAvailable([int]$BasePort) {
    if ($BasePort -lt 1 -or $BasePort -ge 65535) { throw "PortBase 必須留得下兩個埠（1..65534），實得 $BasePort" }
    foreach ($port in @($BasePort, $BasePort + 1)) {
        $listener = $null
        try {
            $listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, $port)
            $listener.Start()
            $listener.Stop()
        } catch {
            if ($listener) { $listener.Stop() }
            throw "需要的連接埠被占用：$port；$($_.Exception.Message)"
        }
    }
}

function Invoke-OccupiedPortSelfTest([int]$BasePort) {
    # 沒有這個負向測試，Assert-PortsAvailable 壞掉時整份驗收會靜悄悄地全過。
    $listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, $BasePort)
    try {
        $listener.Start()
        $rejected = $false
        try { Assert-PortsAvailable $BasePort }
        catch {
            $rejected = $true
            if ($_.Exception.Message -notmatch [regex]::Escape("$BasePort")) { throw $_ }
        }
        if (-not $rejected) { throw "占用埠自我測試沒有如預期失敗：$BasePort" }
        [pscustomobject]@{ status = 'pass'; occupiedPortRejected = $BasePort } | ConvertTo-Json -Compress
    } finally { $listener.Stop() }
}

function Start-Target([int]$Port, [switch]$NoSqlite) {
    $arguments = @('--host', '127.0.0.1', '--port', "$Port", '--no-browser')
    if ($NoSqlite) { $arguments += '--no-sqlite' }

    if ($UseSource) {
        return Start-Process -FilePath $Python `
            -ArgumentList (@('-X', 'utf8', (Join-Path $AppDir 'launcher.py')) + $arguments) `
            -WorkingDirectory $AppDir -WindowStyle Hidden -PassThru
    }

    $savedPath = $env:PATH
    $savedHome = $env:PYTHONHOME
    $savedPythonPath = $env:PYTHONPATH
    try {
        Remove-Item Env:PYTHONHOME -ErrorAction SilentlyContinue
        Remove-Item Env:PYTHONPATH -ErrorAction SilentlyContinue
        $env:PATH = "$env:WINDIR\System32;$env:WINDIR;$env:WINDIR\System32\Wbem"
        Start-Process -FilePath $ExePath -ArgumentList $arguments -WindowStyle Hidden -PassThru
    } finally {
        $env:PATH = $savedPath
        if ($null -eq $savedHome) { Remove-Item Env:PYTHONHOME -ErrorAction SilentlyContinue } else { $env:PYTHONHOME = $savedHome }
        if ($null -eq $savedPythonPath) { Remove-Item Env:PYTHONPATH -ErrorAction SilentlyContinue } else { $env:PYTHONPATH = $savedPythonPath }
    }
}

function Wait-Server([string]$Base, [Diagnostics.Process]$Process) {
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    $port = ([Uri]$Base).Port
    do {
        if ($Process.HasExited) { throw "服務在 bootstrap 前就結束了（埠 $port，exitCode=$($Process.ExitCode)）" }
        try {
            $r = Invoke-Http "$Base/api/bootstrap"
            if ($r.Status -eq 200) { return (Get-Json $r.Bytes) }
        } catch { }
        Start-Sleep -Milliseconds 250
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "等待服務啟動逾時（埠 $port）"
}

function Stop-Target($Process) {
    if (-not $Process -or $Process.HasExited) { return }
    # onefile 的 exe 是 bootloader 父進程再帶一個真正執行 Python 的子進程，
    # Stop-Process 只殺得掉父進程，子進程會變成孤兒繼續佔著連接埠——
    # 下一輪驗收就會卡在埠檢查，或更糟：打到上一輪殘留的服務。
    # 用 cmd 包住 taskkill 是為了讓它的輸出留在 cmd 裡，不要變成 ErrorRecord。
    & cmd.exe /c "taskkill /PID $($Process.Id) /T /F >nul 2>&1"
    $Process.WaitForExit(10000) | Out-Null
}

function New-TestZip([byte[]]$Fixture) {
    $memory = New-Object IO.MemoryStream
    $archive = New-Object IO.Compression.ZipArchive($memory, [IO.Compression.ZipArchiveMode]::Create, $true)
    try {
        $entry = $archive.CreateEntry('package/data.txt')
        $stream = $entry.Open()
        try { $stream.Write($Fixture, 0, $Fixture.Length) } finally { $stream.Dispose() }
        $entry = $archive.CreateEntry('attachments/note.bin')
        $stream = $entry.Open()
        try { $bytes = [byte[]](1, 2, 3, 4, 5); $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
    } finally { $archive.Dispose() }
    $memory.ToArray()
}

function New-MultipartBody([byte[]]$CaseJson, [byte[]]$Archive, [string]$Boundary) {
    $prefix = [Text.Encoding]::ASCII.GetBytes(
        "--$Boundary`r`nContent-Disposition: form-data; name=`"case`"; filename=`"case.json`"`r`nContent-Type: application/json`r`n`r`n")
    $middle = [Text.Encoding]::ASCII.GetBytes(
        "`r`n--$Boundary`r`nContent-Disposition: form-data; name=`"archive`"; filename=`"fixture.zip`"`r`nContent-Type: application/zip`r`n`r`n")
    $suffix = [Text.Encoding]::ASCII.GetBytes("`r`n--$Boundary--`r`n")
    $form = New-Object IO.MemoryStream
    $prefix, $CaseJson, $middle, $Archive, $suffix | ForEach-Object { $form.Write($_, 0, $_.Length) }
    $form.ToArray()
}

$process = $null
$createdRuntime = $false
try {
    if ($SelfTestOccupiedPort) { Invoke-OccupiedPortSelfTest $PortBase; exit 0 }

    if (-not $UseSource) {
        Assert-That (Test-Path -LiteralPath $ExePath -PathType Leaf) "找不到執行檔：$ExePath（請先跑 tools\build_exe.ps1）"
    }
    Assert-PortsAvailable $PortBase
    $fixture = [IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $FixturePath).Path)

    # 凍結後可寫根目錄是 exe 所在資料夾；原始碼模式則是專案根目錄（app_paths.writable_root）。
    $writableRoot = if ($UseSource) { $RepoRoot } else { Split-Path -Parent (Resolve-Path -LiteralPath $ExePath).Path }
    $runtimeDir = Join-Path $writableRoot 'runtime'
    $database = Join-Path $runtimeDir 'sqlite\cpami_templates.db'
    $runtimeExisted = Test-Path -LiteralPath $runtimeDir

    # ── 第一階段：一般模式（不寫入硬碟）────────────────────────────────
    $base = "http://127.0.0.1:$PortBase"
    $process = Start-Target $PortBase -NoSqlite
    $bootstrap = Wait-Server $base $process

    # 新建空白案件沒有原檔版面，用的就是模板；13 表 596 欄在這裡仍然成立
    # （載入既有檔案時表的集合改以原檔為準，那條走的是 documentLayout，不是這裡）。
    Assert-That ($bootstrap.tableOrder.Count -eq 13) "bootstrap 應為 13 表，實得 $($bootstrap.tableOrder.Count)"
    $fieldCount = 0
    $bootstrap.fieldOrder.psobject.Properties | ForEach-Object { $fieldCount += $_.Value.Count }
    Assert-That ($fieldCount -eq 596) "bootstrap 應為 596 欄，實得 $fieldCount"

    $import = Invoke-Http "$base/api/import-data-txt" 'POST' $fixture 'text/plain'
    Assert-That ($import.Status -eq 200) "import-data-txt 應回 200，實得 $($import.Status)"
    $imported = Get-Json $import.Bytes

    $exportBody = [Text.Encoding]::UTF8.GetBytes(($imported | ConvertTo-Json -Depth 100 -Compress))
    $export = Invoke-Http "$base/api/export" 'POST' $exportBody 'application/json; charset=utf-8'
    Assert-That ($export.Status -eq 200) "export 應回 200，實得 $($export.Status)"
    Assert-That ([Linq.Enumerable]::SequenceEqual([byte[]]$fixture, [byte[]]$export.Bytes)) `
        "未修改的匯出必須逐位元組相同；原檔 $(Get-Sha256 $fixture)，匯出 $(Get-Sha256 $export.Bytes)"

    $sourceZip = New-TestZip $fixture
    $zipImport = Invoke-Http "$base/api/import-zip" 'POST' $sourceZip 'application/zip'
    Assert-That ($zipImport.Status -eq 200) "import-zip 應回 200，實得 $($zipImport.Status)"
    $zipImported = Get-Json $zipImport.Bytes

    # documentLayout 與 passthroughTables 要一起送回去，否則匯出會退回模板版面，
    # 二維封包多帶的表就會被丟掉（見 CLAUDE.md §2 第 1 條）。
    $extra = @{}
    $bootstrap.extraTableOrder | ForEach-Object { $extra[$_] = @() }
    $casePayload = @{
        schemaVersion     = $bootstrap.schemaVersion
        formSet           = 'A'
        tables            = $zipImported.tables
        extraTables       = $extra
        documentLayout    = $zipImported.documentLayout
        passthroughTables = $zipImported.passthroughTables
    }

    $boundary = '----CPAMIW5' + [guid]::NewGuid().ToString('N')
    $caseJson = [Text.Encoding]::UTF8.GetBytes(($casePayload | ConvertTo-Json -Depth 100 -Compress))
    $zipExport = Invoke-Http "$base/api/export-zip" 'POST' (New-MultipartBody $caseJson $sourceZip $boundary) `
        "multipart/form-data; boundary=$boundary"
    Assert-That ($zipExport.Status -eq 200) "export-zip 應回 200，實得 $($zipExport.Status)"
    Assert-That ([Linq.Enumerable]::SequenceEqual([byte[]]$sourceZip, [byte[]]$zipExport.Bytes)) `
        '未修改的 ZIP 必須逐位元組原樣回傳'

    $changed = ($casePayload | ConvertTo-Json -Depth 100 | ConvertFrom-Json)
    $changed.tables.BMSBASE[0].BUILDING_NAME = '驗收用建物名稱'
    $changedJson = [Text.Encoding]::UTF8.GetBytes(($changed | ConvertTo-Json -Depth 100 -Compress))
    $changedData = Invoke-Http "$base/api/export" 'POST' $changedJson 'application/json; charset=utf-8'
    Assert-That ($changedData.Status -eq 200) "改動後 export 應回 200，實得 $($changedData.Status)"
    $changedZip = Invoke-Http "$base/api/export-zip" 'POST' (New-MultipartBody $changedJson $sourceZip $boundary) `
        "multipart/form-data; boundary=$boundary"
    Assert-That ($changedZip.Status -eq 200) "改動後 export-zip 應回 200，實得 $($changedZip.Status)"

    $before = New-Object IO.MemoryStream(, $sourceZip)
    $after = New-Object IO.MemoryStream(, $changedZip.Bytes)
    $zipBefore = New-Object IO.Compression.ZipArchive($before, [IO.Compression.ZipArchiveMode]::Read)
    $zipAfter = New-Object IO.Compression.ZipArchive($after, [IO.Compression.ZipArchiveMode]::Read)
    try {
        $namesBefore = @($zipBefore.Entries | ForEach-Object { $_.FullName })
        $namesAfter = @($zipAfter.Entries | ForEach-Object { $_.FullName })
        Assert-That (($namesBefore -join '|') -eq ($namesAfter -join '|')) '改動後 ZIP 的項目清單不應變動'

        $dataName = $zipImported.package.dataTxtPath
        $entry = $zipAfter.GetEntry($dataName)
        $actual = New-Object IO.MemoryStream
        $stream = $entry.Open()
        try { $stream.CopyTo($actual) } finally { $stream.Dispose() }
        Assert-That ([Linq.Enumerable]::SequenceEqual([byte[]]$changedData.Bytes, [byte[]]$actual.ToArray())) `
            'ZIP 內的 data.txt 應與單獨匯出的結果一致'

        foreach ($name in $namesBefore | Where-Object { $_ -ne $dataName }) {
            $x = New-Object IO.MemoryStream
            $y = New-Object IO.MemoryStream
            $sx = $zipBefore.GetEntry($name).Open()
            $sy = $zipAfter.GetEntry($name).Open()
            try { $sx.CopyTo($x); $sy.CopyTo($y) } finally { $sx.Dispose(); $sy.Dispose() }
            Assert-That ([Linq.Enumerable]::SequenceEqual([byte[]]$x.ToArray(), [byte[]]$y.ToArray())) `
                "改動 data.txt 不應動到其他項目：$name"
        }
    } finally {
        $zipBefore.Dispose(); $zipAfter.Dispose(); $before.Dispose(); $after.Dispose()
    }

    # runtime\ 若在驗收開始前就存在（build_exe.ps1 的驗證步驟、或上一輪的殘留），
    # 這條就驗不出任何東西——據實跳過並在結果標明，不要拿它冤枉 --no-sqlite。
    if (-not $runtimeExisted) {
        Assert-That (-not (Test-Path -LiteralPath $runtimeDir)) `
            "--no-sqlite 模式不該寫入硬碟，卻出現了 $runtimeDir"
    }

    Stop-Target $process; $process = $null

    # ── 第二階段：共用範本模式（預設啟用）──────────────────────────────
    $sqlitePort = $PortBase + 1
    $sqliteBase = "http://127.0.0.1:$sqlitePort"
    $process = Start-Target $sqlitePort
    $sqliteBoot = Wait-Server $sqliteBase $process
    Assert-That ($sqliteBoot.templateStorage.mode -eq 'sqlite-templates') `
        "共用範本模式的 templateStorage.mode 應為 sqlite-templates，實得 $($sqliteBoot.templateStorage.mode)"
    if (-not $runtimeExisted) { $createdRuntime = Test-Path -LiteralPath $runtimeDir }

    $created = Invoke-Json $sqliteBase '/api/templates' 'POST' @{
        templateKind = 'designer'; name = '驗收用設計人範本'; isDefault = $false
        fields = @{ CNAME = '範例建設股份有限公司' }
    }
    Assert-That ($created.Status -eq 201) "建立範本應回 201，實得 $($created.Status)"
    $templateId = $created.Json.template.templateId

    $listed = Invoke-Json $sqliteBase '/api/templates?kind=designer'
    Assert-That ($listed.Status -eq 200) "列出範本應回 200，實得 $($listed.Status)"

    $updated = Invoke-Json $sqliteBase "/api/templates/$templateId" 'PUT' @{ name = '驗收用設計人範本（改）'; isDefault = $true }
    Assert-That ($updated.Status -eq 200 -and $updated.Json.template.name -eq '驗收用設計人範本（改）') '更新範本失敗'

    $deleted = Invoke-Json $sqliteBase "/api/templates/$templateId" 'DELETE'
    Assert-That ($deleted.Status -eq 200 -and $deleted.Json.ok) '刪除範本失敗'
    Assert-That (Test-Path -LiteralPath $database -PathType Leaf) "找不到範本資料庫：$database"

    Stop-Target $process; $process = $null

    # 資料庫被刪掉（例如使用者清掉 runtime/）之後必須能重建，不能開不起來。
    $rebuilt = $false
    if ($createdRuntime) {
        Remove-Item -LiteralPath $runtimeDir -Recurse -Force
        $process = Start-Target $sqlitePort
        $null = Wait-Server $sqliteBase $process
        Assert-That (Test-Path -LiteralPath $database -PathType Leaf) '刪掉 runtime/ 後重啟應自動重建資料庫'
        $rebuilt = $true
        Stop-Target $process; $process = $null
        Remove-Item -LiteralPath $runtimeDir -Recurse -Force
    }

    [pscustomobject]@{
        status         = 'pass'
        mode           = if ($UseSource) { 'source' } else { 'exe' }
        target         = if ($UseSource) { Join-Path $AppDir 'launcher.py' } else { (Resolve-Path -LiteralPath $ExePath).Path }
        fixtureSha256      = (Get-Sha256 $fixture)
        fixtureLength      = $fixture.Length
        exportSha256       = (Get-Sha256 $export.Bytes)
        noSqliteWriteCheck = if ($runtimeExisted) { 'skipped-runtime-existed' } else { 'checked' }
        runtimeRebuilt     = $rebuilt
        runtimeSkipped     = (-not $createdRuntime)
    } | ConvertTo-Json -Compress
    exit 0
} catch {
    [pscustomobject]@{ status = 'fail'; error = $_.Exception.Message } | ConvertTo-Json -Compress
    exit 1
} finally {
    Stop-Target $process
}
