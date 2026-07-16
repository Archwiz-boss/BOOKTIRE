param(
    [Parameter(Mandatory = $true)]
    [string]$DatabaseRoot,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath,

    [Parameter(Mandatory = $false)]
    [string]$TaichungSectionsCsv,

    [Parameter(Mandatory = $false)]
    [string]$BuildDatabasePath,

    [Parameter(Mandatory = $false)]
    [string]$BuildPassword = $env:CPAMI_BUILD_MDB_PASSWORD
)

$ErrorActionPreference = 'Stop'

function Open-MdbConnection {
    param(
        [string]$Path,
        [string]$Password = ''
    )

    $connectionString = "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=$Path;"
    if ($Password) {
        $connectionString += "Jet OLEDB:Database Password=$Password;"
    }
    $connection = New-Object System.Data.OleDb.OleDbConnection($connectionString)
    $connection.Open()
    return $connection
}

function Read-String {
    param(
        [System.Data.OleDb.OleDbDataReader]$Reader,
        [int]$Index
    )
    if ($Reader.IsDBNull($Index)) { return '' }
    return ([string]$Reader.GetValue($Index)).Trim()
}

$bldcodePath = Join-Path $DatabaseRoot 'bldcode.mdb'
$landPath = Join-Path $DatabaseRoot 'land.mdb'
$codeTypes = [ordered]@{}
$codeRowCount = 0
$legacyPresets = $null

$connection = Open-MdbConnection -Path $bldcodePath
try {
    $command = $connection.CreateCommand()
    $command.CommandText = 'SELECT CODE_TYPE,CODE_SEQ,SUB_SEQ,SUB_SEQ1,CODE_DESC,MARK FROM Bldcode ORDER BY CODE_TYPE,SUB_SEQ1,SUB_SEQ,CODE_SEQ'
    $reader = $command.ExecuteReader()
    try {
        while ($reader.Read()) {
            $type = Read-String -Reader $reader -Index 0
            if (-not $type) { continue }
            if (-not $codeTypes.Contains($type)) {
                $codeTypes[$type] = New-Object System.Collections.ArrayList
            }
            $label = Read-String -Reader $reader -Index 4
            if ($label.Length -ge 2 -and $label.StartsWith("'") -and $label.EndsWith("'")) {
                $label = $label.Substring(1, $label.Length - 2)
            }
            [void]$codeTypes[$type].Add([ordered]@{
                code = Read-String -Reader $reader -Index 1
                sub = Read-String -Reader $reader -Index 2
                parent = Read-String -Reader $reader -Index 3
                label = $label
                mark = Read-String -Reader $reader -Index 5
            })
            $codeRowCount++
        }
    }
    finally {
        $reader.Close()
        $reader.Dispose()
        $command.Dispose()
    }
}
finally {
    $connection.Close()
    $connection.Dispose()
}

if ($BuildDatabasePath) {
    if (-not (Test-Path -LiteralPath $BuildDatabasePath)) {
        throw "Build database not found: $BuildDatabasePath"
    }
    if (-not $BuildPassword) {
        throw 'BuildPassword is required. Pass it as a parameter or set CPAMI_BUILD_MDB_PASSWORD.'
    }

    $legacyRows = New-Object System.Collections.ArrayList
    $connection = Open-MdbConnection -Path $BuildDatabasePath -Password $BuildPassword
    try {
        $command = $connection.CreateCommand()
        $command.CommandText = "SELECT CODE_TYPE,CODE_SEQ,SUB_SEQ,SUB_SEQ1,CODE_DESC,MARK FROM Bldcode WHERE CODE_TYPE IN ('RMK','BMLAW1','BMLAW2','MEMO') ORDER BY CODE_TYPE,SUB_SEQ1,SUB_SEQ,CODE_SEQ"
        $reader = $command.ExecuteReader()
        try {
            while ($reader.Read()) {
                $label = Read-String -Reader $reader -Index 4
                if ($label.Length -ge 2 -and $label.StartsWith("'") -and $label.EndsWith("'")) {
                    $label = $label.Substring(1, $label.Length - 2)
                }
                [void]$legacyRows.Add([pscustomobject][ordered]@{
                    type = Read-String -Reader $reader -Index 0
                    code = Read-String -Reader $reader -Index 1
                    sub = Read-String -Reader $reader -Index 2
                    parent = Read-String -Reader $reader -Index 3
                    label = $label
                    mark = Read-String -Reader $reader -Index 5
                })
            }
        }
        finally {
            $reader.Close()
            $reader.Dispose()
            $command.Dispose()
        }
    }
    finally {
        $connection.Close()
        $connection.Dispose()
    }

    $i80RmkRows = @($legacyRows | Where-Object { $_.type -eq 'RMK' -and $_.parent -eq 'I80' })
    $procedureRows = @($i80RmkRows | Where-Object { $_.code -match '^[0-5]$' } | Sort-Object @{ Expression = { [int]$_.code } }, sub)
    $memoRows = @($i80RmkRows | Where-Object { $_.code -notmatch '^[0-5]$' })
    $publicBuilding = -join ([char[]]@(0x516C, 0x6709, 0x5EFA, 0x7BC9, 0x7269))
    $publicArtBuilding = -join ([char[]]@(0x516C, 0x6709, 0x5EFA, 0x7BC9, 0x7269, 0x61C9, 0x8A2D, 0x7F6E, 0x516C, 0x5171, 0x85DD, 0x8853))
    $partialOccupancy = -join ([char[]]@(0x90E8, 0x5206, 0x4F7F, 0x7167))
    $legacyPartialOccupancy = -join ([char[]]@(0x90E8, 0x4EFD, 0x59CB, 0x7167))
    $markAliases = @{
        $publicBuilding = $publicArtBuilding
        $partialOccupancy = $legacyPartialOccupancy
    }
    $linkedMemoRows = New-Object System.Collections.Generic.HashSet[string]
    $categories = New-Object System.Collections.ArrayList
    foreach ($categoryCode in @('0', '1', '2', '3', '4', '5')) {
        $categoryProcedures = @($procedureRows | Where-Object { $_.code -eq $categoryCode })
        if (-not $categoryProcedures.Count) { continue }
        $procedures = New-Object System.Collections.ArrayList
        foreach ($procedure in $categoryProcedures) {
            $acceptedMarks = @($procedure.label)
            if ($markAliases.ContainsKey($procedure.label)) {
                $acceptedMarks += $markAliases[$procedure.label]
            }
            $templates = New-Object System.Collections.ArrayList
            foreach ($memo in @($memoRows | Where-Object { $acceptedMarks -contains $_.mark } | Sort-Object code, sub)) {
                [void]$linkedMemoRows.Add("$($memo.sub)|$($memo.code)|$($memo.mark)|$($memo.label)")
                [void]$templates.Add([ordered]@{
                    code = "$($memo.sub)$($memo.code)"
                    body = $memo.label
                    sourceMark = $memo.mark
                })
            }
            [void]$procedures.Add([ordered]@{
                id = "$categoryCode`:$($procedure.sub)"
                sub = $procedure.sub
                label = $procedure.label
                templates = $templates
            })
        }
        [void]$categories.Add([ordered]@{
            code = $categoryCode
            label = $categoryProcedures[0].mark
            procedures = $procedures
        })
    }

    $unmatchedMemoRows = New-Object System.Collections.ArrayList
    foreach ($memo in $memoRows) {
        $memoKey = "$($memo.sub)|$($memo.code)|$($memo.mark)|$($memo.label)"
        if (-not $linkedMemoRows.Contains($memoKey)) {
            [void]$unmatchedMemoRows.Add([ordered]@{
                code = "$($memo.sub)$($memo.code)"
                body = $memo.label
                sourceMark = $memo.mark
            })
        }
    }

    $laws = [ordered]@{}
    foreach ($lawType in @('BMLAW1', 'BMLAW2')) {
        $lawRows = New-Object System.Collections.ArrayList
        foreach ($row in @($legacyRows | Where-Object { $_.type -eq $lawType } | Sort-Object code)) {
            [void]$lawRows.Add([ordered]@{
                code = $row.code
                sub = $row.sub
                parent = $row.parent
                label = $row.label
                mark = $row.mark
            })
        }
        $laws[$lawType] = $lawRows
    }

    $commonText = New-Object System.Collections.ArrayList
    foreach ($row in @($legacyRows | Where-Object { $_.type -eq 'MEMO' } | Sort-Object code, sub)) {
        [void]$commonText.Add([ordered]@{
            code = $row.code
            sub = $row.sub
            parent = $row.parent
            label = $row.label
            mark = $row.mark
        })
    }

    $legacyPresets = [ordered]@{
        source = [ordered]@{
            build = 'cpami/Arch2016C/Build.mdb'
            city = 'I80'
            selectedRows = $legacyRows.Count
            regulatedNoteRows = $i80RmkRows.Count
        }
        regulatedNotes = [ordered]@{
            categories = $categories
            unmatchedTemplates = $unmatchedMemoRows
        }
        laws = $laws
        commonText = $commonText
    }
}

$landOldNew = New-Object System.Collections.ArrayList
$connection = Open-MdbConnection -Path $landPath
try {
    $command = $connection.CreateCommand()
    $command.CommandText = 'SELECT DATAID,OLDZON,OLDLAND,NEWZON,NEWLAND FROM LAND_OLD_NEW ORDER BY DATAID'
    $reader = $command.ExecuteReader()
    try {
        while ($reader.Read()) {
            [void]$landOldNew.Add([ordered]@{
                id = Read-String -Reader $reader -Index 0
                oldDistrict = Read-String -Reader $reader -Index 1
                oldSection = Read-String -Reader $reader -Index 2
                newDistrict = Read-String -Reader $reader -Index 3
                newSection = Read-String -Reader $reader -Index 4
            })
        }
    }
    finally {
        $reader.Close()
        $reader.Dispose()
        $command.Dispose()
    }
}
finally {
    $connection.Close()
    $connection.Dispose()
}

$officialSections = New-Object System.Collections.ArrayList
if ($TaichungSectionsCsv) {
    if (-not (Test-Path -LiteralPath $TaichungSectionsCsv)) {
        throw "Taichung land-section CSV not found: $TaichungSectionsCsv"
    }

    $districtCodes = @{}
    foreach ($zone in $codeTypes['ZON']) {
        if ($zone.parent -ne 'I80') { continue }
        $districtName = ([string]$zone.label).Substring(3)
        if ($districtName) { $districtCodes[$districtName] = [string]$zone.code }
    }

    $csvBytes = [System.IO.File]::ReadAllBytes($TaichungSectionsCsv)
    $csvText = [System.Text.Encoding]::UTF8.GetString($csvBytes).TrimStart([char]0xFEFF)
    $csvRows = @($csvText | ConvertFrom-Csv)
    $sectionSuffix = [string][char]0x6BB5
    $subsectionSuffix = ([string][char]0x5C0F) + ([string][char]0x6BB5)
    foreach ($row in $csvRows) {
        $columns = @($row.PSObject.Properties)
        $districtName = ([string]$columns[7].Value).Trim()
        if (-not $districtCodes.ContainsKey($districtName)) {
            throw "Cannot map Taichung district '$districtName' to a legacy ZON code."
        }

        $section = ([string]$columns[1].Value).Trim()
        $subsection = ([string]$columns[2].Value).Trim()
        $sectionCode = ([string]$columns[3].Value).Trim().PadLeft(4, '0')
        $label = if ($section.EndsWith($sectionSuffix)) { $section } else { $section + $sectionSuffix }
        if ($subsection) {
            $label += if ($subsection.EndsWith($subsectionSuffix)) { $subsection } else { $subsection + $subsectionSuffix }
        }

        [void]$officialSections.Add([ordered]@{
            code = $districtCodes[$districtName]
            sub = $sectionCode
            parent = 'I80'
            label = $label
            mark = ''
            source = 'taichung-open-data'
            district = $districtName
            section = $section
            subsection = $subsection
            officeCode = ([string]$columns[5].Value).Trim()
            officeName = ([string]$columns[8].Value).Trim()
        })
    }
}

$source = [ordered]@{
    bldcode = 'cpami/Arch2016C/bldcode.mdb'
    bldcodeRows = $codeRowCount
    codeTypeCount = $codeTypes.Count
    land = 'cpami/Arch2016C/land.mdb'
    landOldNewRows = $landOldNew.Count
}
if ($TaichungSectionsCsv) {
    $source['taichungSections'] = [ordered]@{
        dataset = 'Taichung City land-section code table'
        provider = 'Taichung City Government Land Administration Bureau'
        metadataUpdated = '2026-05-12'
        resource = 'Taichung land-section CSV, dated 2026-05-11'
        url = 'https://data.gov.tw/dataset/84391'
        rows = $officialSections.Count
    }
}

$result = [ordered]@{
    version = 3
    source = $source
    codeTypes = $codeTypes
    officialSections = $officialSections
    landOldNew = $landOldNew
}
if ($legacyPresets) {
    $result['legacyPresets'] = $legacyPresets
}

$json = $result | ConvertTo-Json -Depth 12 -Compress
$outputDirectory = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $outputDirectory)) {
    [void](New-Item -ItemType Directory -Path $outputDirectory)
}
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($OutputPath, $json, $utf8NoBom)

Write-Output ("Exported {0} code rows in {1} types, {2} official sections and {3} land mappings to {4}" -f $codeRowCount, $codeTypes.Count, $officialSections.Count, $landOldNew.Count, $OutputPath)
